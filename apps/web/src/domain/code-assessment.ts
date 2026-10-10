import type { CodeAttempt } from './code'
import type { ObjectiveState } from './course-map'

export function hasCodeAssessmentBinding(attempt: CodeAttempt): boolean {
  const context = attempt.learning?.context; const result = attempt.result; const check = result?.task_assessment
  if (!context || !result || !check || result.client_revision_id !== attempt.id || result.client_artifact_id !== attempt.artifactId || result.request_sha256 !== attempt.requestHash || result.mastery_asserted !== false || check.mastery_asserted !== false || check.provenance !== 'server_deterministic_checker' || check.standard_version !== 'cs01-fixed-condition-v1') return false
  if (check.course_version_id !== context.courseVersionId || check.activity_version_id !== context.activityVersionId || check.objective_code !== context.objectiveCode || check.task_code !== context.taskCode) return false
  return check.criteria.length === 3 && ['fixed_condition', 'explanation', 'independent_transfer'].every(id => check.criteria.filter(row => row.id === id).length === 1) && check.criteria.every(row => ['met', 'not_met', 'needs_review'].includes(row.status)) && check.criteria.filter(row => row.id !== 'fixed_condition').every(row => row.status === 'needs_review')
}

export function currentCodeAssessment(attempts: CodeAttempt[], goal: string, version: string): CodeAttempt | undefined {
  return attempts.filter(attempt => !attempt.resultTrust && hasCodeAssessmentBinding(attempt) && attempt.learning?.context?.objectiveCode === goal && attempt.learning.context.courseVersionId === version).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).at(0)
}

export function codeObjectiveState(attempt: CodeAttempt): ObjectiveState {
  if (attempt.resultTrust || !hasCodeAssessmentBinding(attempt)) return 'unknown'
  const condition = attempt.result!.task_assessment!.criteria.find(row => row.id === 'fixed_condition')!
  return condition.status === 'met' ? 'partial' : condition.status === 'not_met' ? 'consolidate' : 'unknown'
}
