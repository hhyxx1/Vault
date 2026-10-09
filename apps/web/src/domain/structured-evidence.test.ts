import { describe, expect, it } from 'vitest'
import type { StructuredResult } from './structured'
import { structuredGoalEvidence, structuredObjectiveState } from './structured-evidence'
import mapping from '../../../../content/courses/CS03.structured-evidence.json'
import course from '../../../../content/courses/CS03.stack-example.json'
import { structuredActivityByVersion } from './structured'

const result = (activity: string, ids: string[]) => ({
  course_version_id: 'c47c1551-76d5-4b80-aeae-33cd253d8ca0', activity_version: activity,
  criteria: ids.map(id => ({ id, title: id, status: 'met', reason: 'checked' })),
  trace_correct: true,
} as StructuredResult)

describe('activity conditions are not interchangeable with goal conditions', () => {
  it('requires both order and boundaries to cover the complete stack trace', () => {
    const full = result('CS03-STACK-U01-TRACE@0.1.0', ['stack.order', 'stack.bounds'])
    expect(structuredGoalEvidence(full, 'CS03-STACK-01').find(item => item.id === 'state_trace')?.status).toBe('met')
    expect(structuredGoalEvidence({ ...full, criteria: full.criteria.slice(0, 1) }, 'CS03-STACK-01').find(item => item.id === 'state_trace')?.status).toBe('needs_review')
  })

  it('never turns correct bracket predictions into a verified implementation', () => {
    const checked = result('CS03-STACK-U04-JUDGE@0.1.0', ['brackets.nesting', 'brackets.diagnose'])
    const implementation = structuredGoalEvidence(checked, 'CS03-STACK-02').find(item => item.id === 'implementation')
    expect(implementation?.status).toBe('needs_review')
    expect(implementation?.reason).toContain('实现')
    expect(structuredObjectiveState(checked, 'CS03-STACK-02')).toBe('unknown')
    expect(structuredGoalEvidence(checked, 'CS03-STACK-01')).toEqual([])
    expect(structuredGoalEvidence({ ...checked, course_version_id: 'old-version' }, 'CS03-STACK-02')).toEqual([])
  })
  it('maps only existing activities to actual necessary goal conditions', () => {
    for (const rule of mapping.mappings) {
      const goal = course.objectives.find(item => item.code === rule.objective)!
      expect(rule.conditions.map(item => item.id).sort()).toEqual(goal.criteria.map(item => item.id).sort())
      for (const version of rule.activities) {
        const activity = structuredActivityByVersion(version)!
        expect(activity.objectiveCodes).toContain(goal.code)
        const available = [...activity.criteria.map(item => item.id), 'explanation', 'independent_transfer']
        for (const condition of rule.conditions) for (const required of condition.requires) expect(available).toContain(required)
      }
    }
  })
})
