import type { ReviewAssignment } from '../api/reviews'
import type { ObjectiveState } from './course-map'

type Goal = { code: string; criteria: Array<{ id: string }> }
export function reviewedGoalEvidence(rows: readonly ReviewAssignment[], owner: string, courseVersion: string, goal: Goal, activityVersion: string) {
  const required = ['fixed_condition', 'explanation', 'independent_transfer']
  if (goal.criteria.length !== 3 || !required.every(id => goal.criteria.some(row => row.id === id))) return null
  // Only fresh authenticated server responses enter this projection. Imported
  // local reports and offline caches never confer teacher-review authority.
  const row = rows.filter(item => item.owner_account_id === owner && item.course_version_id === courseVersion && item.objective_code === goal.code && item.activity_version === activityVersion)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]
  if (!row) return null
  if (row.status === 'in_appeal') return { state: 'partial' as ObjectiveState, assignment: row, revisionId: null, criteria: null }
  const decision = [...row.events].sort((a, b) => b.sequence - a.sequence).find(event => event.type === 'decision')
  const signature = decision?.teacher_signature
  if (!decision || !signature || decision.actor_role !== 'teacher' || signature.verification_state !== 'verified' || signature.teacher_account_id !== decision.actor_account_id || signature.teacher_account_id !== row.claimed_by_account_id) return null
  const kindToCriterion = { objective: 'fixed_condition', explanation: 'explanation', independent_transfer: 'independent_transfer' } as const
  if (row.rubric.length !== 3 || new Set(row.rubric.map(item => item.kind)).size !== 3) return null
  const results = decision.rubric_results ?? []
  if (results.length !== 3 || new Set(results.map(item => item.id)).size !== 3) return null
  const criteria = row.rubric.map(item => {
    const result = results.find(value => value.id === item.id)
    return { id: kindToCriterion[item.kind], status: result?.status ?? 'needs_review', reason: `授权教师审阅：${result?.note ?? ''}` }
  })
  if (row.status === 'changes_requested' && decision.decision === 'changes_requested') return { state: criteria.some(item => item.status === 'not_met') ? 'consolidate' as ObjectiveState : 'partial' as ObjectiveState, assignment: row, revisionId: null, criteria }
  if (row.status !== 'approved' || decision.decision !== 'approved' || criteria.some(item => item.status !== 'met')) return null
  const work = row.work_snapshot.at(-1)
  if (work?.kind !== 'code_attempt' || work.server_verification?.provenance !== 'server_execution' || work.server_verification.outcome !== 'met') return null
  return { state: 'verified' as ObjectiveState, assignment: row, revisionId: work.artifact_revision_id, criteria }
}
