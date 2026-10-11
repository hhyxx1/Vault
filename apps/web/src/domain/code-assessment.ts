import { SUITE_CONTEXT_TASK_CODE, type CodeAttempt } from './code'
import type { ObjectiveState } from './course-map'

const CRITERION_IDS = ['fixed_condition', 'explanation', 'independent_transfer']

export function hasCodeAssessmentBinding(attempt: CodeAttempt): boolean {
  const context = attempt.learning?.context; const result = attempt.result; const check = result?.task_assessment
  if (!context || !result || !check || result.client_revision_id !== attempt.id || result.client_artifact_id !== attempt.artifactId || result.request_sha256 !== attempt.requestHash || result.mastery_asserted !== false || check.mastery_asserted !== false || check.provenance !== 'server_deterministic_checker' || !['cs01-fixed-condition-v1', 'code-fixed-condition-v1'].includes(check.standard_version)) return false
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

/**
 * A semantic suite result is trusted only when it binds the same revision/artifact/request
 * hash, the frozen course/activity/objective under the semantic-suite context marker, the
 * server deterministic provenance/standard, and never asserts mastery. Independent cases are
 * run server-side; this only validates the envelope, it never recomputes verdicts client-side.
 */
export function hasCodeSuiteBinding(attempt: CodeAttempt): boolean {
  const context = attempt.learning?.context; const result = attempt.result; const suite = result?.suite_assessment
  if (!context || !result || !suite) return false
  if (result.client_revision_id !== attempt.id || result.client_artifact_id !== attempt.artifactId || result.request_sha256 !== attempt.requestHash || result.mastery_asserted !== false) return false
  if (context.taskCode !== SUITE_CONTEXT_TASK_CODE) return false
  if (suite.mastery_asserted !== false || suite.provenance !== 'server_deterministic_checker' || suite.standard_version !== 'code-semantic-suite-v1') return false
  if (suite.course_version_id !== context.courseVersionId || suite.activity_version_id !== context.activityVersionId || suite.objective_code !== context.objectiveCode) return false
  if (suite.criteria.length !== 3 || !CRITERION_IDS.every(id => suite.criteria.filter(row => row.id === id).length === 1)) return false
  if (!suite.criteria.every(row => ['met', 'not_met', 'needs_review'].includes(row.status))) return false
  if (suite.criteria.filter(row => row.id !== 'fixed_condition').some(row => row.status !== 'needs_review')) return false
  if (!Array.isArray(suite.cases) || suite.cases.length < 1) return false
  return true
}

export function currentSuiteAssessment(attempts: CodeAttempt[], goal: string, version: string): CodeAttempt | undefined {
  return attempts.filter(attempt => !attempt.resultTrust && hasCodeSuiteBinding(attempt) && attempt.learning?.context?.objectiveCode === goal && attempt.learning.context.courseVersionId === version).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).at(0)
}

export function suiteObjectiveState(attempt: CodeAttempt): ObjectiveState {
  if (attempt.resultTrust || !hasCodeSuiteBinding(attempt)) return 'unknown'
  const condition = attempt.result!.suite_assessment!.criteria.find(row => row.id === 'fixed_condition')!
  return condition.status === 'met' ? 'partial' : condition.status === 'not_met' ? 'consolidate' : 'unknown'
}

/**
 * Objective-level objective state: a trusted semantic suite (which includes independent
 * inputs) is stronger evidence than the fixed-condition task; use it when present, otherwise
 * fall back to the fixed task. Either way the ceiling is 'partial': explanation and
 * independent transfer always remain needs_review.
 */
export function bestCodeObjectiveState(attempts: CodeAttempt[], goal: string, version: string): ObjectiveState {
  const suite = currentSuiteAssessment(attempts, goal, version)
  if (suite) return suiteObjectiveState(suite)
  const fixed = currentCodeAssessment(attempts, goal, version)
  return fixed ? codeObjectiveState(fixed) : 'unknown'
}
