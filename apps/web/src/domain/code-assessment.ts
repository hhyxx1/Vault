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

/**
 * Revision key for a suite attempt: the fixed-task revision it verified, falling
 * back to its content fingerprint for records produced before the binding field
 * existed. Two suite attempts with the same key were run on the same work.
 */
export function suiteRevisionKey(attempt: CodeAttempt): string {
  // Group by BOTH the source revision and its content fingerprint: an id alone
  // is not enough (a tampered or reused id with different content must not merge).
  return `${attempt.sourceRevisionId ?? 'legacy'}:${attempt.requestHash}`
}

function suiteFixedStatus(attempt: CodeAttempt): 'met' | 'not_met' | 'needs_review' {
  return attempt.result!.suite_assessment!.criteria.find(row => row.id === 'fixed_condition')!.status
}

/**
 * The current suite verdict for one objective/version. Verdicts are grouped by
 * the work revision they ran against; the latest revision decides, and inside
 * that revision a definitive met/not_met result is never erased by a later
 * environment failure (needs_review). A brand-new revision never inherits an
 * older revision's pass: if it only has an environment-failed run, the state
 * stays unassessed.
 */
export function currentSuiteAssessment(attempts: CodeAttempt[], goal: string, version: string): CodeAttempt | undefined {
  const valid = attempts.filter(attempt => !attempt.resultTrust && hasCodeSuiteBinding(attempt) && attempt.learning?.context?.objectiveCode === goal && attempt.learning.context.courseVersionId === version)
  if (!valid.length) return undefined
  const groups = new Map<string, CodeAttempt[]>()
  for (const attempt of valid) {
    const key = suiteRevisionKey(attempt)
    const list = groups.get(key)
    if (list) list.push(attempt); else groups.set(key, [attempt])
  }
  let latest: CodeAttempt[] | undefined
  let latestTime = ''
  for (const list of groups.values()) {
    const time = list.reduce((max, attempt) => attempt.updatedAt > max ? attempt.updatedAt : max, '')
    if (!latest || time > latestTime) { latest = list; latestTime = time }
  }
  const sorted = [...(latest ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return sorted.find(attempt => suiteFixedStatus(attempt) !== 'needs_review') ?? sorted[0]
}

/**
 * A suite attempt is bound to the viewed revision only when BOTH the source
 * revision id and the content fingerprint line up. Legacy records without a
 * source revision id fall back to the content fingerprint alone, never to an
 * id-only match.
 */
export function suiteBoundToRevision(attempt: CodeAttempt, revision: { id: string; requestHash: string }): boolean {
  if (attempt.requestHash !== revision.requestHash) return false
  return attempt.sourceRevisionId ? attempt.sourceRevisionId === revision.id : true
}

export type RevisionSuiteVerdict = {
  /** The most recent suite run for this revision (may be an environment failure). */
  latest: CodeAttempt | null
  /** The most recent definitive (met/not_met) run for this revision, if any. */
  valid: CodeAttempt | null
}

/**
 * Suite verdicts bound to one concrete fixed-task revision, split into the
 * latest run and the last valid conclusion. Editing, switching versions or
 * restoring must never surface another version's pass/fail, and a later
 * environment failure on the same work must not erase an earlier valid result
 * (the failure is still reported separately by the caller).
 */
export function suiteVerdictForRevision(attempts: CodeAttempt[], revision: { id: string; requestHash: string }): RevisionSuiteVerdict {
  const bound = attempts
    .filter(attempt => !attempt.resultTrust && hasCodeSuiteBinding(attempt) && attempt.result?.suite_assessment && suiteBoundToRevision(attempt, revision))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return {
    latest: bound[0] ?? null,
    valid: bound.find(attempt => suiteFixedStatus(attempt) !== 'needs_review') ?? null,
  }
}

/** Compatibility wrapper: the latest suite attempt bound to the revision. */
export function suiteAssessmentForRevision(attempts: CodeAttempt[], revision: { id: string; requestHash: string }): CodeAttempt | undefined {
  return suiteVerdictForRevision(attempts, revision).latest ?? undefined
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
