import { expect, it } from 'vitest'
import { currentCodeAssessment, codeObjectiveState, hasCodeSuiteBinding, currentSuiteAssessment, suiteObjectiveState, bestCodeObjectiveState } from './code-assessment'
import { SUITE_CONTEXT_TASK_CODE, type CodeAttempt } from './code'

function attempt(status: 'met' | 'not_met' | 'needs_review' = 'met'): CodeAttempt {
  const context = { courseId: 'course', courseVersionId: 'version', activityVersionId: 'activity', objectiveCode: 'goal', taskCode: 'base', helpViewed: [] }
  return { id: 'revision', artifactId: 'artifact', spaceId: 'space', activityKey: 'activity:base', request: { language: 'c17', entry: 'main.c', files: { 'main.c': '' }, stdin: '' }, requestHash: 'hash', createdAt: '2026-10-10T00:00:00Z', updatedAt: '2026-10-10T00:00:00Z', resultTrust: null, learning: { context, prediction: '' }, result: { status: 'success', phase: 'run', stdout: '5\n', stderr: '', truncated: false, metadata: {}, runtime_profile: 'test', request_sha256: 'hash', client_revision_id: 'revision', client_artifact_id: 'artifact', mastery_asserted: false, task_assessment: { course_version_id: 'version', activity_version_id: 'activity', objective_code: 'goal', task_code: 'base', standard_version: 'cs01-fixed-condition-v1', provenance: 'server_deterministic_checker', mastery_asserted: false, criteria: [{ id: 'fixed_condition', status, reason: '' }, { id: 'explanation', status: 'needs_review', reason: '' }, { id: 'independent_transfer', status: 'needs_review', reason: '' }] } } }
}

it('shows only partial or unmet evidence and keeps uncertain runs unassessed', () => {
  expect(codeObjectiveState(attempt())).toBe('partial')
  expect(codeObjectiveState(attempt('not_met'))).toBe('consolidate')
  expect(codeObjectiveState(attempt('needs_review'))).toBe('unknown')
  expect(currentCodeAssessment([attempt()], 'goal', 'version')?.id).toBe('revision')
})

it('supports the shared code standard without granting complete mastery', () => {
  const row = attempt()
  row.result!.task_assessment!.standard_version = 'code-fixed-condition-v1'
  expect(codeObjectiveState(row)).toBe('partial')
})

it('does not reuse recovered, wrong-version, wrong-goal or malformed feedback as trusted evidence', () => {
  const row = attempt()
  expect(currentCodeAssessment([{ ...row, resultTrust: 'client_reported' }], 'goal', 'version')).toBeUndefined()
  expect(currentCodeAssessment([row], 'goal', 'other')).toBeUndefined()
  expect(currentCodeAssessment([row], 'other', 'version')).toBeUndefined()
  row.result!.task_assessment!.criteria[1] = { id: 'fixed_condition', status: 'met', reason: '' }
  expect(currentCodeAssessment([row], 'goal', 'version')).toBeUndefined()
})

function suiteAttempt(fixed: 'met' | 'not_met' | 'needs_review' = 'met', hardcoding = false): CodeAttempt {
  const context = { courseId: 'course', courseVersionId: 'version', activityVersionId: 'activity', objectiveCode: 'goal', taskCode: SUITE_CONTEXT_TASK_CODE, helpViewed: [] }
  return { id: 'suite-revision', artifactId: 'artifact', spaceId: 'space', activityKey: 'activity:semantic-suite', request: { language: 'c17', entry: 'main.c', files: { 'main.c': '' }, stdin: '' }, requestHash: 'hash', createdAt: '2026-10-11T00:00:00Z', updatedAt: '2026-10-11T00:00:00Z', resultTrust: null, learning: { context, prediction: '' }, result: { status: 'success', phase: 'run', stdout: '0\n', stderr: '', truncated: false, metadata: {}, runtime_profile: 'test', request_sha256: 'hash', client_revision_id: 'suite-revision', client_artifact_id: 'artifact', mastery_asserted: false, suite_assessment: { course_version_id: 'version', activity_version_id: 'activity', objective_code: 'goal', standard_version: 'code-semantic-suite-v1', provenance: 'server_deterministic_checker', comparator: 'integer', oracle_id: 'parking_fee_three_tier', scope_note: '有限用例', suspected_hardcoding: hardcoding, cases: [{ case_code: 'visible-30', kind: 'visible', stdin: '30\n', expected_stdout: '0\n', observed_status: 'success', observed_stdout: '0\n', status: fixed, reason: '' }, { case_code: 'independent-0', kind: 'independent', stdin: '0\n', expected_stdout: '0\n', observed_status: 'success', observed_stdout: '0\n', status: fixed, reason: '' }], criteria: [{ id: 'fixed_condition', status: fixed, reason: '' }, { id: 'explanation', status: 'needs_review', reason: '' }, { id: 'independent_transfer', status: 'needs_review', reason: '' }], mastery_asserted: false } } }
}

it('trusts a bound semantic suite but never above partial mastery', () => {
  expect(hasCodeSuiteBinding(suiteAttempt())).toBe(true)
  expect(suiteObjectiveState(suiteAttempt())).toBe('partial')
  expect(suiteObjectiveState(suiteAttempt('not_met', true))).toBe('consolidate')
  expect(suiteObjectiveState(suiteAttempt('needs_review'))).toBe('unknown')
  expect(currentSuiteAssessment([suiteAttempt()], 'goal', 'version')?.id).toBe('suite-revision')
})

it('prefers suite evidence over the fixed task for objective state', () => {
  const fixed = attempt('not_met')
  const suite = suiteAttempt('met')
  // Suite passes independent inputs even though an older fixed run was unmet.
  expect(bestCodeObjectiveState([fixed, suite], 'goal', 'version')).toBe('partial')
  expect(bestCodeObjectiveState([fixed], 'goal', 'version')).toBe('consolidate')
})

it('rejects recovered, misbound, spoofed or mastery-granting suite assessments', () => {
  expect(suiteObjectiveState({ ...suiteAttempt(), resultTrust: 'client_reported' })).toBe('unknown')
  expect(currentSuiteAssessment([{ ...suiteAttempt(), resultTrust: 'client_reported' }], 'goal', 'version')).toBeUndefined()
  expect(currentSuiteAssessment([suiteAttempt()], 'other', 'version')).toBeUndefined()
  expect(currentSuiteAssessment([suiteAttempt()], 'goal', 'other')).toBeUndefined()
  const wrongMarker = suiteAttempt(); wrongMarker.learning!.context!.taskCode = 'base'
  expect(hasCodeSuiteBinding(wrongMarker)).toBe(false)
  const spoofedProvenance = suiteAttempt(); spoofedProvenance.result!.suite_assessment!.provenance = 'client_reported'
  expect(hasCodeSuiteBinding(spoofedProvenance)).toBe(false)
  const spoofedStandard = suiteAttempt(); spoofedStandard.result!.suite_assessment!.standard_version = 'code-fixed-condition-v1'
  expect(hasCodeSuiteBinding(spoofedStandard)).toBe(false)
  const grantsMastery = suiteAttempt(); (grantsMastery.result!.suite_assessment!.mastery_asserted as boolean) = true
  expect(hasCodeSuiteBinding(grantsMastery)).toBe(false)
  const explainsMastery = suiteAttempt(); explainsMastery.result!.suite_assessment!.criteria[1] = { id: 'explanation', status: 'met', reason: '' }
  expect(hasCodeSuiteBinding(explainsMastery)).toBe(false)
  const noCases = suiteAttempt(); noCases.result!.suite_assessment!.cases = []
  expect(hasCodeSuiteBinding(noCases)).toBe(false)
})
