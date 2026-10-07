import { COURSE_VERSION, STANDARD_VERSION, TRACE_ACTIVITY, TRACE_OBJECTIVE, type ArtifactRevision, type TracePrediction, type VerificationResult } from '../domain/learning'
import { artifactContent, canonicalHash, traceSubmission } from '../domain/integrity'
import type { components } from '../../../../packages/contracts/api.generated'

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
  lease = await readJson<Lease>(await fetch('/api/v1/guest-leases', { method: 'POST', credentials: 'same-origin', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nonce: nonce.nonce, course_code: 'CS03' }) }))
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
