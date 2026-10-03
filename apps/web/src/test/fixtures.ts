import { COURSE_VERSION, STANDARD_VERSION, TRACE_ACTIVITY, TRACE_OBJECTIVE, newDraft, type EvidenceRecord, type VerificationResult } from '../domain/learning'

export const correctTrace = [
  { after_stack: [8], output: null, underflow: false },
  { after_stack: [8, 3], output: null, underflow: false },
  { after_stack: [8], output: 3, underflow: false },
  { after_stack: [8, 5], output: null, underflow: false },
  { after_stack: [8], output: 5, underflow: false },
  { after_stack: [], output: 8, underflow: false },
  { after_stack: [], output: null, underflow: true },
]
export const explanation = '后加入且未取出的元素先取出；空栈不改变并标记下溢。'
export const normativeHash = '98e6c5abbe187ebb7f89b7d50f6840993c5d7267058cbe0aee70a1797b529ef7'
export function sampleResult(): VerificationResult {
  return { verification_id: crypto.randomUUID(), course_id: crypto.randomUUID(), course_version_id: crypto.randomUUID(), activity_id: crypto.randomUUID(), activity_version_id: crypto.randomUUID(), objective_ids: [crypto.randomUUID()], course_code: 'CS03', course_version: COURSE_VERSION, activity_version: TRACE_ACTIVITY, standard_version: STANDARD_VERSION, client_artifact_id: crypto.randomUUID(), client_revision_id: crypto.randomUUID(), artifact_hash: normativeHash, checker_version: 'test-fixture-checker', runtime: 'test-fixture-runtime', provenance: 'server_deterministic_checker', trace_correct: true, rows: correctTrace.map((_, index) => ({ index: index + 1, correct: true, issues: [] })), criteria: [{ id: 'state_trace', status: 'met', reason: 'Fixture' }, { id: 'boundary_condition', status: 'met', reason: 'Fixture' }, { id: 'explanation', status: 'needs_review', reason: 'Fixture' }, { id: 'independent_transfer', status: 'needs_review', reason: 'Fixture' }], objective_state: 'evidence_pending_review', mastery_asserted: false, summary: 'Test fixture only, not live learning evidence.' }
}
export function sampleEvidence(version = '1'): EvidenceRecord {
  const result = sampleResult()
  return { id: result.verification_id, spaceId: 'test-space', objectiveId: TRACE_OBJECTIVE, revisionId: result.client_revision_id, revisionVersion: version, submittedAt: '2026-10-03T10:00:00Z', submittedWork: { trace: correctTrace, explanation }, createdAt: '2026-10-03T10:00:02Z', result, helpEventIds: [] }
}
export function completeDraft(spaceId: string) {
  return { ...newDraft(TRACE_OBJECTIVE, spaceId), goalConfirmed: true, trace: correctTrace.map(row => ({ stack: JSON.stringify(row.after_stack), output: row.output === null ? '' : String(row.output), underflow: row.underflow })), explanation }
}
