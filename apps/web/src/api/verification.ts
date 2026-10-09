import { hasStructuredResultBinding } from '../domain/structured'
import { COURSE_VERSION, STANDARD_VERSION, TRACE_ACTIVITY, TRACE_OBJECTIVE, type ArtifactRevision, type TracePrediction, type VerificationResult } from '../domain/learning'
import { artifactContent, canonicalHash, traceSubmission } from '../domain/integrity'
import type { components } from '../../../../packages/contracts/api.generated'
import { completeLogicRows, LOGIC_ACTIVITY, LOGIC_STANDARD, LOGIC_VERSION, type CourseAttempt, type LogicResult } from '../domain/logic'
import type {
  BracketActivityPrompt,
  BracketJudgement,
  BracketVerificationResult,
  StructuredAttempt,
  StructuredTraceResult,
  StructuredTraceStep,
  TraceActivityPrompt,
} from '../domain/structured'

type Lease = components['schemas']['LeaseResponse']
type Operation = components['schemas']['OperationResponse'] & { result: VerificationResult }
let lease: Lease | null = null

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = ''
    try { const body = await response.json(); message = typeof body.detail === 'string' ? body.detail : typeof body.message === 'string' ? body.message : '' } catch { /* HTTP error without body */ }
    throw new Error(message || (response.status === 429 ? '当前临时核验请求较多，请稍后重试。' : `核验服务暂不可用（${response.status}）。作品仍保留在本地。`))
  }
  return response.json() as Promise<T>
}

async function activeLease(signal?: AbortSignal) {
  if (lease && Date.parse(lease.absolute_expires_at) > Date.now() + 10000) return lease
  const nonce = await readJson<{ nonce: string }>(await fetch('/api/v1/guest-nonce', { method: 'POST', credentials: 'same-origin', cache: 'no-store', signal }))
  lease = await readJson<Lease>(await fetch('/api/v1/guest-leases', { method: 'POST', credentials: 'same-origin', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nonce: nonce.nonce }) }))
  return lease
}


export type LearningAssistIntent = 'diagnose' | 'explain' | 'hint' | 'practice' | 'result_feedback'
export type ModelProfile = { id: string; label: string; provider: string; capabilities: string[] }
export type ModelCatalog = { profiles: ModelProfile[]; task_defaults: Partial<Record<LearningAssistIntent, string>> }
export async function listModelProfiles(signal?: AbortSignal): Promise<ModelCatalog> {
  return readJson<ModelCatalog>(await fetch('/api/v1/model-profiles', { credentials: 'same-origin', cache: 'no-store', signal }))
}
export type LearningAssistInput = {
  request_id: string
  model_profile_id?: string
  course_code: 'CS03'
  course_version: typeof COURSE_VERSION
  activity_version: typeof TRACE_ACTIVITY
  objective_code: typeof TRACE_OBJECTIVE
  intent: LearningAssistIntent
  disclosure_accepted: true
  artifact_id: string
  revision_id: string
  goal: string
  question: string
  work_excerpt: string
  explanation: string
  operation_id?: string
}
export type LearningAssistReply = { message: string; next_action: string; mastery_asserted: false }

export type PersonalLearningAssistInput = {
  request_id: string
  model_profile_id?: string
  course_id: string
  scope_version_id: string
  topic_id: string
  attempt_id: string
  course_title: string
  course_goal: string
  topic_title: string
  expected_performance: string
  attempt_excerpt: string
  question: string
  intent: Exclude<LearningAssistIntent, 'result_feedback'>
  disclosure_accepted: true
}

export async function requestPersonalLearningAssist(input: PersonalLearningAssistInput, signal?: AbortSignal): Promise<LearningAssistReply> {
  const current = await activeLease(signal)
  signal?.throwIfAborted()
  const response = await fetch(`/api/v1/guest-leases/${current.lease_id}/personal-learning-assist`, {
    method: 'POST', credentials: 'same-origin', signal,
    headers: { 'Content-Type': 'application/json', Authorization: `GuestLease ${current.token}` },
    body: JSON.stringify(input),
  })
  if (response.status === 401 || response.status === 410) lease = null
  const reply = await readJson<LearningAssistReply>(response)
  if (reply.mastery_asserted !== false || typeof reply.message !== 'string' || !reply.message.trim()
    || typeof reply.next_action !== 'string' || !reply.next_action.trim()) {
    throw new Error('助手返回的掌握状态不符合契约，建议未保存。')
  }
  return reply
}

export async function requestLearningAssist(input: LearningAssistInput, signal?: AbortSignal): Promise<LearningAssistReply> {
  const current = await activeLease(signal)
  signal?.throwIfAborted()
  const response = await fetch(`/api/v1/guest-leases/${current.lease_id}/learning-assist`, {
    method: 'POST', credentials: 'same-origin', signal,
    headers: { 'Content-Type': 'application/json', Authorization: `GuestLease ${current.token}` },
    body: JSON.stringify(input),
  })
  if (response.status === 401 || response.status === 410) lease = null
  return readJson<LearningAssistReply>(response)
}
export async function verifyTrace(revision: ArtifactRevision, trace: TracePrediction[], idempotencyKey: string, signal?: AbortSignal): Promise<{ operation: Operation; acknowledge: () => Promise<void> }> {
  const body = traceSubmission(revision, trace)
  const expectedHash = await canonicalHash(artifactContent(revision, trace))
  const current = await activeLease(signal)
  signal?.throwIfAborted()
  const response = await fetch(`/api/v1/guest-leases/${current.lease_id}/operations`, {
    method: 'POST', credentials: 'same-origin', signal,
    headers: { 'Content-Type': 'application/json', Authorization: `GuestLease ${current.token}`, 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(body),
  })
  if (response.status === 401 || response.status === 410) lease = null
  const operation = await readJson<Operation>(response)
  const result = operation.result
  if (!result || result.artifact_hash !== expectedHash || result.provenance !== 'server_deterministic_checker' || result.course_version !== COURSE_VERSION || result.standard_version !== STANDARD_VERSION || result.activity_version !== TRACE_ACTIVITY || result.client_revision_id !== revision.revisionId || result.client_artifact_id !== revision.artifactId || result.mastery_asserted !== false || !Array.isArray(result.criteria) || !result.criteria.length || result.criteria.some(criterion => !['met', 'not_met', 'needs_review'].includes(criterion.status))) {
    throw new Error('核验结果的来源或作品版本不一致，已停止写入学习证据。')
  }
  return {
    operation,
    acknowledge: async () => {
      await readJson(await fetch(`/api/v1/guest-leases/${current.lease_id}/operations/${operation.operation_id}/ack`, {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Authorization: `GuestLease ${current.token}` }, body: JSON.stringify({ expected_revision: operation.revision }),
      }))
    },
  }
}

export async function verifyTruthTable(attempt: CourseAttempt, signal?: AbortSignal): Promise<{ result: LogicResult; acknowledge: () => Promise<void> }> {
  const rows = completeLogicRows(attempt.rows)
  const expectedHash = await canonicalHash({ kind: 'truth_table_with_explanation', rows, explanation: attempt.explanation })
  const current = await activeLease(signal)
  signal?.throwIfAborted()
  const response = await fetch(`/api/v1/guest-leases/${current.lease_id}/operations`, {
    method: 'POST', credentials: 'same-origin', signal,
    headers: { 'Content-Type': 'application/json', Authorization: `GuestLease ${current.token}`, 'Idempotency-Key': attempt.id },
    body: JSON.stringify({ kind: 'verify_truth_table', course_code: 'CS05', activity_version: LOGIC_ACTIVITY, standard_version: LOGIC_STANDARD, client_artifact_id: attempt.artifactId, client_revision_id: attempt.id, rows, explanation: attempt.explanation }),
  })
  if (response.status === 401 || response.status === 410) lease = null
  const operation = await readJson<{ operation_id: string; revision: string; kind: string; result: LogicResult | null }>(response)
  const result = operation.result
  if (operation.kind !== 'verify_truth_table' || !result || result.artifact_hash !== expectedHash || result.provenance !== 'server_deterministic_checker' || result.course_code !== 'CS05' || result.course_version !== LOGIC_VERSION || result.standard_version !== LOGIC_STANDARD || result.activity_version !== LOGIC_ACTIVITY || result.client_revision_id !== attempt.id || result.client_artifact_id !== attempt.artifactId || result.mastery_asserted !== false || !Array.isArray(result.criteria) || result.criteria.length !== 5 || result.criteria.some(criterion => !['met', 'not_met', 'needs_review'].includes(criterion.status))) {
    throw new Error('真值表核验结果的来源或作品版本不一致，已停止写入学习证据。')
  }
  return {
    result,
    acknowledge: async () => { await readJson(await fetch(`/api/v1/guest-leases/${current.lease_id}/operations/${operation.operation_id}/ack`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Authorization: `GuestLease ${current.token}` }, body: JSON.stringify({ expected_revision: operation.revision }) })) },
  }
}

type StructuredOperationEnvelope = { operation_id: string; revision: string; kind: string }

function assertTrustedResult(result: {
  provenance: string
  course_code: string
  course_version: string
  standard_version: string
  activity_version: string
  client_revision_id: string
  client_artifact_id: string
  mastery_asserted: boolean
  criteria: Array<{ status: string }>
}, attempt: StructuredAttempt, standardVersion: string): void {
  if (
    result.provenance !== 'server_deterministic_checker' ||
    result.course_code !== 'CS03' ||
    result.course_version !== COURSE_VERSION ||
    result.standard_version !== standardVersion ||
    result.activity_version !== attempt.activityVersion ||
    result.client_revision_id !== attempt.id ||
    result.client_artifact_id !== attempt.artifactId ||
    result.mastery_asserted !== false ||
    !Array.isArray(result.criteria) ||
    !result.criteria.length ||
    result.criteria.some(criterion => !['met', 'not_met', 'needs_review'].includes(criterion.status))
  ) {
    throw new Error('核验结果的来源或活动版本不一致，已停止写入学习证据。')
  }
}

export async function verifyStructuredTrace(
  activity: TraceActivityPrompt,
  attempt: StructuredAttempt,
  steps: StructuredTraceStep[],
  signal?: AbortSignal,
): Promise<{ result: StructuredTraceResult; acknowledge: () => Promise<void> }> {
  const expectedHash = await canonicalHash({
    kind: `${activity.machine}_structured_trace_with_explanation`,
    steps,
    explanation: attempt.explanation,
  })
  const current = await activeLease(signal)
  signal?.throwIfAborted()
  const response = await fetch(`/api/v1/guest-leases/${current.lease_id}/operations`, {
    method: 'POST', credentials: 'same-origin', signal,
    headers: { 'Content-Type': 'application/json', Authorization: `GuestLease ${current.token}`, 'Idempotency-Key': attempt.id },
    body: JSON.stringify({
      kind: 'verify_structured_trace',
      course_code: 'CS03',
      activity_version: activity.version,
      client_artifact_id: attempt.artifactId,
      client_revision_id: attempt.id,
      steps,
      explanation: attempt.explanation,
    }),
  })
  if (response.status === 401 || response.status === 410) lease = null
  const operation = await readJson<StructuredOperationEnvelope & { result: StructuredTraceResult | null }>(response)
  const result = operation.result
  if (operation.kind !== 'verify_structured_trace' || !result || result.artifact_hash !== expectedHash) {
    throw new Error('状态推演核验结果的来源或作品版本不一致，已停止写入学习证据。')
  }
  assertTrustedResult(result, attempt, activity.standardVersion)
  if (!hasStructuredResultBinding({ ...attempt, result })) throw new Error('核验的课程身份、目标或条件与活动不一致，已停止写入。')
  return {
    result,
    acknowledge: async () => { await readJson(await fetch(`/api/v1/guest-leases/${current.lease_id}/operations/${operation.operation_id}/ack`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Authorization: `GuestLease ${current.token}` }, body: JSON.stringify({ expected_revision: operation.revision }) })) },
  }
}

export async function verifyBracketJudgements(
  activity: BracketActivityPrompt,
  attempt: StructuredAttempt,
  judgements: BracketJudgement[],
  signal?: AbortSignal,
): Promise<{ result: BracketVerificationResult; acknowledge: () => Promise<void> }> {
  const expectedHash = await canonicalHash({
    kind: 'bracket_judgement_with_explanation',
    judgements,
    explanation: attempt.explanation,
  })
  const current = await activeLease(signal)
  signal?.throwIfAborted()
  const response = await fetch(`/api/v1/guest-leases/${current.lease_id}/operations`, {
    method: 'POST', credentials: 'same-origin', signal,
    headers: { 'Content-Type': 'application/json', Authorization: `GuestLease ${current.token}`, 'Idempotency-Key': attempt.id },
    body: JSON.stringify({
      kind: 'verify_bracket_judgement',
      course_code: 'CS03',
      activity_version: activity.version,
      client_artifact_id: attempt.artifactId,
      client_revision_id: attempt.id,
      judgements,
      explanation: attempt.explanation,
    }),
  })
  if (response.status === 401 || response.status === 410) lease = null
  const operation = await readJson<StructuredOperationEnvelope & { result: BracketVerificationResult | null }>(response)
  const result = operation.result
  if (operation.kind !== 'verify_bracket_judgement' || !result || result.artifact_hash !== expectedHash) {
    throw new Error('括号判定核验结果的来源或作品版本不一致，已停止写入学习证据。')
  }
  assertTrustedResult(result, attempt, activity.standardVersion)
  if (!hasStructuredResultBinding({ ...attempt, result })) throw new Error('核验的课程身份、目标或条件与活动不一致，已停止写入。')
  return {
    result,
    acknowledge: async () => { await readJson(await fetch(`/api/v1/guest-leases/${current.lease_id}/operations/${operation.operation_id}/ack`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Authorization: `GuestLease ${current.token}` }, body: JSON.stringify({ expected_revision: operation.revision }) })) },
  }
}
