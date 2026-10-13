import { describe, expect, it } from 'vitest'
import type { ReviewAssignment } from '../api/reviews'
import { reviewedGoalEvidence } from './review-evidence'

const goal = { code: 'CS03-M03-O02', criteria: [{ id: 'fixed_condition' }, { id: 'explanation' }, { id: 'independent_transfer' }] }
const approved = {
  id: 'review', owner_account_id: 'student', course_version_id: 'version', objective_code: goal.code,
  activity_version: 'activity', claimed_by_account_id: 'teacher', status: 'approved', updated_at: '2026-10-13T00:00:00Z',
  rubric: [{ id: 'objective', kind: 'objective' }, { id: 'explanation', kind: 'explanation' }, { id: 'independent', kind: 'independent_transfer' }],
  work_snapshot: [{ kind: 'code_attempt', artifact_revision_id: 'revision', artifact_hash: 'hash', server_verification: { provenance: 'server_execution', outcome: 'met' } }],
  events: [{ type: 'decision', sequence: 3, actor_role: 'teacher', actor_account_id: 'teacher', decision: 'approved',
    rubric_results: [{ id: 'objective', status: 'met' }, { id: 'explanation', status: 'met' }, { id: 'independent', status: 'met' }],
    teacher_signature: { teacher_account_id: 'teacher', verification_state: 'verified', signed_at: '2026-10-13T00:00:00Z' } }],
} as unknown as ReviewAssignment
const project = (row = approved, owner = 'student', version = 'version') => reviewedGoalEvidence([row], owner, version, goal, 'activity')

describe('server-reviewed goal evidence', () => {
  it('uses a signed complete decision bound to the account, course and actual work', () => {
    expect(project()?.state).toBe('verified')
    expect(project()?.revisionId).toBe('revision')
  })
  it('cannot reuse another account or course version', () => {
    expect(project(approved, 'another')).toBeNull()
    expect(project(approved, 'student', 'new-version')).toBeNull()
  })
  it('does not upgrade an unsigned or incomplete decision', () => {
    const row = structuredClone(approved)
    row.events[0].teacher_signature = null
    expect(project(row)).toBeNull()
    row.events[0] = structuredClone(approved.events[0])
    row.events[0].rubric_results![1].status = 'needs_review'
    expect(project(row)).toBeNull()
  })
  it('withdraws current attainment during an appeal and rejects a failed new frozen work', () => {
    expect(project({ ...approved, status: 'in_appeal' })?.state).toBe('partial')
    const row = structuredClone(approved)
    row.work_snapshot[0].server_verification!.outcome = 'not_met'
    expect(project(row)).toBeNull()
  })
})
