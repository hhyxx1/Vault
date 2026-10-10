import { hasStructuredResultBinding } from '../domain/structured'
import type { CodeAttempt, CodeResult } from '../domain/code'
import { hasCodeAssessmentBinding } from '../domain/code-assessment'
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
const guestLeaseStorageKey = 'vault:anonymous-execution-lease:v1'
class ApiRequestError extends Error {
  status: number
  code: string
  constructor(message: string, status: number, code: string) { super(message); this.status = status; this.code = code }
}
function clearLease(current: Lease) {
  if (lease?.lease_id === current.lease_id) lease = null
  try {
    const saved = JSON.parse(sessionStorage.getItem(guestLeaseStorageKey) ?? 'null')
    if (saved?.lease_id === current.lease_id) sessionStorage.removeItem(guestLeaseStorageKey)
  } catch { /* Storage may be blocked; in-memory learning still works. */ }
}
function reusableLease(value: Lease | null): value is Lease {
  return !!value && typeof value.lease_id === 'string' && typeof value.token === 'string'
    && Array.isArray(value.allowed_operations)
    && Date.parse(value.absolute_expires_at) > Date.now() + 10000
    && Date.parse(value.idle_expires_at ?? value.absolute_expires_at) > Date.now() + 10000
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = ''; let code = ''
    try { const body = await response.json(); message = typeof body.detail === 'string' ? body.detail : typeof body.message === 'string' ? body.message : ''; code = typeof body.code === 'string' ? body.code : '' } catch { /* HTTP error without body */ }
    throw new ApiRequestError(message || (response.status === 429 ? '当前临时核验请求较多，请稍后重试。' : `核验服务暂不可用（${response.status}）。作品仍保留在本地。`), response.status, code)
  }
  return response.json() as Promise<T>
}

async function activeLease(signal?: AbortSignal) {
  if (!lease) {
    try { const saved = JSON.parse(sessionStorage.getItem(guestLeaseStorageKey) ?? 'null'); if (reusableLease(saved)) lease = saved } catch { /* Anonymous capability only; no account session or learning data. */ }
  }
  if (reusableLease(lease)) return lease
  const nonce = await readJson<{ nonce: string }>(await fetch('/api/v1/guest-nonce', { method: 'POST', credentials: 'same-origin', cache: 'no-store', signal }))
  lease = await readJson<Lease>(await fetch('/api/v1/guest-leases', { method: 'POST', credentials: 'same-origin', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nonce: nonce.nonce }) }))
  try { sessionStorage.setItem(guestLeaseStorageKey, JSON.stringify(lease)) } catch { /* Keep the in-memory fallback. */ }
  return lease
}

/** Save the returned result before acknowledgement removes temporary server work. */
export async function runCode(attempt: CodeAttempt, signal?: AbortSignal, task?: components['schemas']['CodeTaskRef'], renewed = false): Promise<{ result: CodeResult; acknowledge: () => Promise<void> }> {
  const current = await activeLease(signal)
  if (!current.allowed_operations.includes('run_code')) throw new Error('代码运行服务尚未连接；这一版已保留本地，可稍后重新运行。')
  if (await canonicalHash({ ...attempt.request, stdin: attempt.request.stdin ?? '' }) !== attempt.requestHash) throw new Error('提交内容与版本摘要不一致。')
  type Snapshot = components['schemas']['OperationResponse']
  const headers = { 'Content-Type': 'application/json', Authorization: `GuestLease ${current.token}` }
  const root = `/api/v1/guest-leases/${current.lease_id}/operations`
  let operation: Snapshot | null = null
  const readSnapshot = async (response: Response) => {
    const next = await readJson<Snapshot>(response)
    if (next.kind !== 'run_code' || next.lease_id !== current.lease_id || (operation && next.operation_id !== operation.operation_id)) throw new Error('运行请求与服务返回不一致。')
    return next
  }
  try {
    operation = await readSnapshot(await fetch(root, { method: 'POST', credentials: 'same-origin', signal, headers: { ...headers, 'Idempotency-Key': attempt.id }, body: JSON.stringify({ kind: 'run_code', client_artifact_id: attempt.artifactId, client_revision_id: attempt.id, code: attempt.request, ...(task ? { task } : {}) }) }))
    const deadline = Date.now() + 120000
    while (operation.status === 'running' || operation.status === 'cancelling') {
      signal?.throwIfAborted()
      if (Date.now() > deadline) throw new Error('等待运行结果超时，已请求停止；作品仍在本地。')
      await new Promise<void>((resolve, reject) => {
        const abort = () => { clearTimeout(timer); reject(new DOMException('运行已停止。', 'AbortError')) }
        const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve() }, 300)
        signal?.addEventListener('abort', abort, { once: true })
        if (signal?.aborted) { signal.removeEventListener('abort', abort); abort() }
      })
      operation = await readSnapshot(await fetch(`${root}/${operation.operation_id}`, { credentials: 'same-origin', cache: 'no-store', headers, signal }))
    }
    signal?.throwIfAborted()
    if (operation.status !== 'completed') throw new Error('运行已取消；这一版代码仍保留本地。')
    const result = operation.result as CodeResult | null
    if (!result || result.client_artifact_id !== attempt.artifactId || result.client_revision_id !== attempt.id || result.request_sha256 !== attempt.requestHash || result.mastery_asserted !== false || !['success', 'compile_error', 'runtime_error', 'timeout', 'resource_limit', 'environment_error'].includes(result.status) || typeof result.stdout !== 'string' || typeof result.stderr !== 'string') throw new Error('运行结果与提交版本不一致，未保存结果。')
    const terminal = operation
    if ((task || result.task_assessment) && !hasCodeAssessmentBinding({ ...attempt, result })) throw new Error('课程核验与活动、目标或作品不一致，未保存结果。')
    return { result, acknowledge: async () => { await readJson(await fetch(`${root}/${terminal.operation_id}/ack`, { method: 'POST', credentials: 'same-origin', headers, body: JSON.stringify({ expected_revision: terminal.revision }) })) } }
  } catch (error) {
    if (!operation && !renewed && error instanceof ApiRequestError && (
      (error.status === 401 && error.code === 'GUEST_LEASE_EXPIRED') ||
      (error.status === 429 && error.code === 'GUEST_BUDGET_EXCEEDED')
    )) {
      clearLease(current)
      return runCode(attempt, signal, task, true)
    }
    if (operation && ['running', 'cancelling'].includes(operation.status)) {
      // Cancellation has its own lifetime: an aborted UI signal must not abort cleanup.
      const cleanupSignal = AbortSignal.timeout(30000)
      await fetch(`${root}/${operation.operation_id}/cancel`, { method: 'POST', credentials: 'same-origin', headers, signal: cleanupSignal, body: JSON.stringify({ expected_revision: operation.revision }) }).catch(() => undefined)
    }
    throw error
  }
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
  if (response.status === 401 || response.status === 410) clearLease(current)
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
  if (response.status === 401 || response.status === 410) clearLease(current)
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
  if (response.status === 401 || response.status === 410) clearLease(current)
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
  if (response.status === 401 || response.status === 410) clearLease(current)
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
  if (response.status === 401 || response.status === 410) clearLease(current)
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
  if (response.status === 401 || response.status === 410) clearLease(current)
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
