import mapping from '../../../../content/courses/CS03.structured-evidence.json'
import type { StructuredResult } from './structured'
import type { ObjectiveState } from './course-map'

type GoalCondition = { id: string; status: 'met' | 'not_met' | 'needs_review'; reason: string }

/** Only projects a previously validated result. Supporting evidence never satisfies a full condition. */
export function structuredGoalEvidence(result: StructuredResult, objective: string): GoalCondition[] {
  if (result.course_version_id !== mapping.course_version_id) return []
  const rules = mapping.mappings.find(rule => rule.objective === objective && rule.activities.includes(result.activity_version))
  if (!rules) return []
  return rules.conditions.map(rule => {
    const checked = rule.requires.map(id => result.criteria.find(item => item.id === id))
    if (rule.coverage === 'supporting') return { id: rule.id, status: 'needs_review', reason: rule.reason }
    const missing = checked.some(item => !item)
    const failed = checked.some(item => item?.status === 'not_met')
      || ('requires_correct_trace' in rule && rule.requires_correct_trace && 'trace_correct' in result && !result.trace_correct)
    const status = failed ? 'not_met' : missing || checked.some(item => item?.status === 'needs_review') ? 'needs_review' : 'met'
    return { id: rule.id, status, reason: rule.reason + (failed ? '本次仍有步骤或条件需要修正。' : missing ? '当前报告未覆盖全部所需条件。' : '') }
  })
}

export function structuredObjectiveState(result: StructuredResult, objective: string): ObjectiveState {
  const conditions = structuredGoalEvidence(result, objective)
  if (conditions.some(item => item.status === 'not_met')) return 'consolidate'
  return conditions.some(item => item.status === 'met') ? 'partial' : 'unknown'
}
