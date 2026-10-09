import { describe, expect, it } from 'vitest'
import {
  courseMapFromPackage,
  courseMapObjectiveNavigation,
  personalCourseMap,
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
  it('projects only learner-declared topics and keeps their self-reported status unverified', () => {
    const result = personalCourseMap({
      id: 'personal-course-1', spaceId: 'space-1', title: '操作系统', goal: '比较调度策略',
      topics: [
        { id: 'topic-scheduling', title: '进程调度', expectedPerformance: '比较等待时间' },
        { id: 'topic-pages', title: '页面置换', expectedPerformance: '比较缺页次数' },
      ],
      createdAt: '2026-10-07T10:00:00Z', updatedAt: '2026-10-07T10:00:00Z',
    })
    const projection = projectCourseMap(result, new Map())

    expect(result.nodes.map(node => [node.id, node.kind])).toEqual([
      ['course:personal-course-1:personal-draft', 'course'],
      ['objective:topic-scheduling', 'objective'],
      ['objective:topic-pages', 'objective'],
    ])
    expect(result.relations.map(relation => [relation.kind, relation.to])).toEqual([
      ['contains', 'objective:topic-scheduling'],
      ['contains', 'objective:topic-pages'],
    ])
    expect(projection.summary).toEqual({ total: 2, verified: 0, partial: 0, consolidate: 0, unknown: 2 })
  })

  it('rejects duplicate personal learning point IDs instead of producing an ambiguous graph', () => {
    const course = {
      id: 'personal-course-1', spaceId: 'space-1', title: '操作系统', goal: '',
      topics: [
        { id: 'topic-1', title: '进程调度', expectedPerformance: '比较等待时间' },
        { id: 'topic-1', title: '页面置换', expectedPerformance: '比较缺页次数' },
      ],
      createdAt: '2026-10-07T10:00:00Z', updatedAt: '2026-10-07T10:00:00Z',
    }

    expect(() => personalCourseMap(course)).toThrow('Duplicate personal learning point ID: topic-1')
  })

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

  it('rejects duplicate stable objective IDs so the course denominator cannot collapse silently', () => {
    expect(() => courseMapFromPackage({
      course_id: 'CS42', version: 'CS42-1.0.0', title: '算法设计',
      objectives: [
        { id: 'goal-duplicate', code: 'CS42-SEARCH', title: '分析搜索' },
        { id: 'goal-duplicate', code: 'CS42-SORT', title: '比较排序' },
      ],
    })).toThrow('Duplicate course objective ID: goal-duplicate')
  })

  it('rejects objective ID and code collisions that would make outline references ambiguous', () => {
    expect(() => courseMapFromPackage({
      course_id: 'CS42', version: 'CS42-1.0.0', title: '算法设计',
      objectives: [
        { id: 'goal-search', code: 'CS42-SEARCH', title: '分析搜索' },
        { id: 'CS42-SEARCH', code: 'CS42-SORT', title: '比较排序' },
      ],
    })).toThrow('Duplicate course objective reference: CS42-SEARCH')
  })

  it('projects authored chapters and units without flattening the course outline', () => {
    const result = courseMapFromPackage({
      course_id: 'CS42',
      version: 'CS42-1.0.0',
      title: '算法设计',
      objectives: [
        { id: 'goal-search', code: 'CS42-SEARCH', title: '分析搜索' },
        { id: 'goal-sort', code: 'CS42-SORT', title: '比较排序' },
      ],
      outline: [
        { kind: 'chapter', id: 'complexity', title: '复杂度分析', objective_refs: ['CS42-SEARCH'] },
        { kind: 'chapter', id: 'ordering', title: '排序方法', children: [
          { kind: 'unit', id: 'comparison-sort', title: '比较排序', objective_refs: ['CS42-SORT'] },
        ] },
      ],
    })

    expect(result.nodes.map(node => [node.id, node.kind])).toEqual([
      ['course:CS42:CS42-1.0.0', 'course'],
      ['objective:goal-search', 'objective'],
      ['objective:goal-sort', 'objective'],
      ['chapter:complexity', 'chapter'],
      ['chapter:ordering', 'chapter'],
      ['unit:comparison-sort', 'unit'],
    ])
    expect(result.relations.filter(relation => relation.kind === 'contains').map(relation => [relation.from, relation.to])).toEqual([
      ['course:CS42:CS42-1.0.0', 'chapter:complexity'],
      ['chapter:complexity', 'objective:goal-search'],
      ['course:CS42:CS42-1.0.0', 'chapter:ordering'],
      ['chapter:ordering', 'unit:comparison-sort'],
      ['unit:comparison-sort', 'objective:goal-sort'],
    ])
    expect(courseMapObjectiveNavigation(result, new Map([['goal-sort', 'partial']]))).toEqual([
      { nodeId: 'objective:goal-search', objectiveRef: 'CS42-SEARCH', title: '分析搜索', path: ['复杂度分析'], state: 'unknown' },
      { nodeId: 'objective:goal-sort', objectiveRef: 'CS42-SORT', title: '比较排序', path: ['排序方法', '比较排序'], state: 'partial' },
    ])
  })

  it.each([
    { name: 'missing objectives', outline: [{ kind: 'chapter' as const, id: 'one', title: '第一章', objective_refs: ['CS42-SEARCH'] }] },
    { name: 'unknown objective reference', outline: [{ kind: 'chapter' as const, id: 'one', title: '第一章', objective_refs: ['CS42-MISSING'] }] },
    { name: 'empty structure nodes', outline: [{ kind: 'chapter' as const, id: 'one', title: '空章节' }] },
    { name: 'duplicate structure IDs', outline: [
      { kind: 'chapter' as const, id: 'same', title: '第一章', objective_refs: ['CS42-SEARCH'] },
      { kind: 'chapter' as const, id: 'same', title: '第二章', objective_refs: ['CS42-SORT'] },
    ] },
    { name: 'invalid nested units', outline: [{ kind: 'chapter' as const, id: 'one', title: '第一章', children: [
      { kind: 'unit' as const, id: 'unit-one', title: '第一单元', objective_refs: ['CS42-SEARCH'], children: [
        { kind: 'unit' as const, id: 'unit-two', title: '嵌套单元', objective_refs: ['CS42-SORT'] },
      ] },
    ] }] },
    { name: 'duplicate references within one placement', outline: [
      { kind: 'chapter' as const, id: 'one', title: '第一章', objective_refs: ['CS42-SEARCH'] },
      { kind: 'chapter' as const, id: 'two', title: '第二章', objective_refs: ['CS42-SORT', 'CS42-SORT'] },
    ] },
  ])('rejects $name in an authored course outline', ({ outline }) => {
    expect(() => courseMapFromPackage({
      course_id: 'CS42', version: 'CS42-1.0.0', title: '算法设计',
      objectives: [
        { id: 'goal-search', code: 'CS42-SEARCH', title: '分析搜索' },
        { id: 'goal-sort', code: 'CS42-SORT', title: '比较排序' },
      ],
      outline,
    })).toThrow('Course outline')
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

  it('allows a stable objective in different chapters and counts it only once', () => {
    const definition = courseMapFromPackage({
      course_id: 'shared-course', version: '1', title: '重复引用课程',
      objectives: [{ id: 'stable-goal', code: 'SHARED', title: '共享目标' }],
      outline: [
        { kind: 'chapter', id: 'first', title: '第一章', objective_refs: ['SHARED'] },
        { kind: 'chapter', id: 'second', title: '第二章', objective_refs: ['SHARED'] },
      ],
    })
    const projection = projectCourseMap(definition, new Map([['stable-goal', 'partial']]))
    expect(projection.summary.total).toBe(1)
    expect(projection.summary.partial).toBe(1)
    for (const chapter of projection.nodes.filter(node => node.kind === 'chapter')) {
      expect(chapter.summary.total).toBe(1)
      expect(chapter.summary.partial).toBe(1)
    }
  })

  it('rejects strict prerequisite cycles while allowing conceptual cycles', () => {
    const course = {
      course_id: 'cycle-course', version: '1', title: '关系校验',
      objectives: [{ code: 'A', title: '目标 A' }, { code: 'B', title: '目标 B' }],
    }
    expect(() => courseMapFromPackage({ ...course, relations: [
      { from: 'A', to: 'B', kind: 'mandatory_prerequisite' },
      { from: 'B', to: 'A', kind: 'mandatory_prerequisite' },
    ] })).toThrow('prerequisite')
    expect(() => courseMapFromPackage({ ...course, relations: [
      { from: 'A', to: 'B', kind: 'conceptual_association' },
      { from: 'B', to: 'A', kind: 'conceptual_association' },
    ] })).not.toThrow()
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
