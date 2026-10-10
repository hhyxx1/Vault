import { expect, it } from 'vitest'
import { currentCodeAssessment, codeObjectiveState } from './code-assessment'
import type { CodeAttempt } from './code'

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

it('does not reuse recovered, wrong-version, wrong-goal or malformed feedback as trusted evidence', () => {
  const row = attempt()
  expect(currentCodeAssessment([{ ...row, resultTrust: 'client_reported' }], 'goal', 'version')).toBeUndefined()
  expect(currentCodeAssessment([row], 'goal', 'other')).toBeUndefined()
  expect(currentCodeAssessment([row], 'other', 'version')).toBeUndefined()
  row.result!.task_assessment!.criteria[1] = { id: 'fixed_condition', status: 'met', reason: '' }
  expect(currentCodeAssessment([row], 'goal', 'version')).toBeUndefined()
})
