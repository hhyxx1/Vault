import { describe, expect, it } from 'vitest'
import {
  courseMapFromPackage,
  projectCourseMap,
  type CourseMapDefinition,
  type ObjectiveState,
} from './course-map'

const map: CourseMapDefinition = {
  courseId: 'CSX',
  version: 'CSX-1.0.0',
  rootNodeId: 'course:CSX:1.0.0',
  nodes: [
    { id: 'course:CSX:1.0.0', title: '课程 X', kind: 'course' },
    { id: 'chapter-a', title: '章节 A', kind: 'chapter' },
    { id: 'unit-a', title: '单元 A', kind: 'unit' },
    { id: 'goal-a-first-view', title: '目标 A', kind: 'objective', objectiveId: 'goal-a', objectiveRef: 'A' },
    { id: 'chapter-b', title: '章节 B', kind: 'chapter' },
    { id: 'goal-a-second-view', title: '目标 A 的再次引用', kind: 'objective', objectiveId: 'goal-a', objectiveRef: 'A' },
    { id: 'goal-b', title: '目标 B', kind: 'objective', objectiveId: 'goal-b', objectiveRef: 'B' },
  ],
  relations: [
    { id: 'course-chapter-a', from: 'course:CSX:1.0.0', to: 'chapter-a', kind: 'contains' },
    { id: 'chapter-unit-a', from: 'chapter-a', to: 'unit-a', kind: 'contains' },
    { id: 'unit-goal-a', from: 'unit-a', to: 'goal-a-first-view', kind: 'contains' },
    { id: 'course-chapter-b', from: 'course:CSX:1.0.0', to: 'chapter-b', kind: 'contains' },
    { id: 'chapter-goal-a-ref', from: 'chapter-b', to: 'goal-a-second-view', kind: 'contains' },
    { id: 'chapter-goal-b', from: 'chapter-b', to: 'goal-b', kind: 'contains' },
    { id: 'prerequisite-a-b', from: 'goal-a-first-view', to: 'goal-b', kind: 'mandatory_prerequisite' },
  ],
}

describe('course map contract', () => {
  it('builds map structure only from declared course objectives and relationships', () => {
    const result = courseMapFromPackage({
      course_id: 'CS03',
      version: 'CS03-example-1.0.0',
      title: '栈样例',
      objectives: [
        { id: 'objective-a', code: 'CS03-A', title: '推演栈状态' },
        { id: 'objective-b', code: 'CS03-B', title: '设计括号匹配' },
      ],
      relations: [{ from: 'CS03-A', to: 'CS03-B', kind: 'mandatory_prerequisite', source: 'reviewed-plan' }],
    })

    expect(result.nodes.map(node => node.kind)).toEqual(['course', 'objective', 'objective'])
    expect(result.nodes[1]).toMatchObject({ id: 'objective:objective-a', objectiveId: 'objective-a', objectiveRef: 'CS03-A' })
    expect(result.relations.map(relation => relation.kind)).toEqual(['contains', 'contains', 'mandatory_prerequisite'])
    expect(result.relations[2].source).toBe('reviewed-plan')
  })

  it('deduplicates objective counts and never propagates evidence into parent or relation states', () => {
    const states = new Map<string, ObjectiveState>([['goal-a', 'partial']])
    const result = projectCourseMap(map, states)
    const root = result.nodes.find(node => node.id === map.rootNodeId)

    expect(result.objectiveIds).toEqual(['goal-a', 'goal-b'])
    expect(result.summary).toEqual({ total: 2, verified: 0, partial: 1, consolidate: 0, unknown: 1 })
    expect(root?.summary).toEqual(result.summary)
    expect(root?.state).toBeUndefined()
    expect(result.relations.find(relation => relation.id === 'prerequisite-a-b')).not.toHaveProperty('state')
  })

  it('keeps the full denominator when a branch is collapsed or relation types are filtered', () => {
    const collapsed = projectCourseMap(map, new Map(), { collapsedNodeIds: new Set(['unit-a']) })
    const filtered = projectCourseMap(map, new Map(), { visibleRelationKinds: new Set(['contains']) })

    expect(collapsed.nodes.some(node => node.id === 'goal-a-first-view')).toBe(false)
    expect(collapsed.objectiveIds).toHaveLength(2)
    expect(collapsed.summary.total).toBe(2)
    expect(filtered.relations.every(relation => relation.kind === 'contains')).toBe(true)
    expect(filtered.objectiveIds).toHaveLength(2)
    expect(filtered.summary.total).toBe(2)
  })

  it('rejects cyclic containment before projecting a graph', () => {
    const cyclic: CourseMapDefinition = {
      ...map,
      relations: [...map.relations, { id: 'cycle', from: 'unit-a', to: 'chapter-a', kind: 'contains' }],
    }
    expect(() => projectCourseMap(cyclic, new Map())).toThrow('acyclic')
  })
})
