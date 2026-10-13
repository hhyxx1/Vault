import { describe, expect, it } from 'vitest'
import type { AtlasPackage } from './course-packages'
import type { ObjectiveCognition } from './learner-cognition'
import { buildCognitiveGraph, constellationLayout, recommendNext } from './cognitive-graph'
import type { ObjectiveState } from './course-map'

const pkg: AtlasPackage = {
  course_id: 'c1',
  course_version_id: 'v1',
  course_code: 'CS99',
  title: '示例课程',
  version: 'CS99-0.1.0',
  status: 'structured_validated',
  scope_note: '仅用于测试',
  objectives: [
    { id: 'o1', code: 'CS99-M01-O01', title: '目标一', criteria: [{ id: 'a', title: 'A', verification: 'x' }] },
    { id: 'o2', code: 'CS99-M01-O02', title: '目标二', criteria: [{ id: 'a', title: 'A', verification: 'x' }] },
    { id: 'o3', code: 'CS99-M02-O01', title: '目标三', criteria: [{ id: 'a', title: 'A', verification: 'x' }] },
  ],
  relations: [{ from: 'CS99-M01-O01', to: 'CS99-M02-O01', kind: 'mandatory_prerequisite', source: 'test' }],
  outline: [
    { kind: 'chapter', id: 'M01', title: '第一章', children: [
      { kind: 'unit', id: 'U1', title: '单元一', objective_refs: ['CS99-M01-O01'] },
      { kind: 'unit', id: 'U2', title: '单元二', objective_refs: ['CS99-M01-O02'] },
    ] },
    { kind: 'chapter', id: 'M02', title: '第二章', children: [
      { kind: 'unit', id: 'U3', title: '单元三', objective_refs: ['CS99-M02-O01'] },
    ] },
  ],
}

function cognition(objectiveId: string, code: string, title: string, state: ObjectiveState): ObjectiveCognition {
  return {
    objectiveId, code, title, state, evidence: [], flags: [], criteria: null,
    help: { hint: 0, answer: 0, agent: 0 }, lastObservedAt: null, hasAttempt: state !== 'unknown',
  }
}

const cognitionByCode = new Map([
  ['CS99-M01-O01', cognition('o1', 'CS99-M01-O01', '目标一', 'consolidate')],
  ['CS99-M01-O02', cognition('o2', 'CS99-M01-O02', '目标二', 'unknown')],
  ['CS99-M02-O01', cognition('o3', 'CS99-M02-O01', '目标三', 'unknown')],
])

describe('buildCognitiveGraph', () => {
  it('lays out the discipline map and layers learner state on objectives only', () => {
    const graph = buildCognitiveGraph(pkg, cognitionByCode)
    const layers = graph.nodes.reduce<Record<string, number>>((acc, node) => ({ ...acc, [node.layer]: (acc[node.layer] ?? 0) + 1 }), {})
    expect(layers).toEqual({ course: 1, chapter: 2, unit: 3, objective: 3 })
    const root = graph.nodes.find(node => node.id === graph.rootId)
    expect(root?.summary).toEqual({ total: 3, verified: 0, partial: 0, consolidate: 1, unknown: 2 })
    // Containers carry no cognitive state of their own.
    expect(graph.nodes.filter(node => node.layer !== 'objective').every(node => node.state === undefined)).toBe(true)
  })

  it('keeps an unassessed objective unknown and never marks it as not mastered', () => {
    const graph = buildCognitiveGraph(pkg, cognitionByCode)
    const unassessed = graph.nodes.find(node => node.objectiveCode === 'CS99-M01-O02')
    expect(unassessed?.state).toBe('unknown')
    expect(unassessed?.unverified).toBe(true)
  })

  it('keeps declared relations curriculum-scoped and only infers influence from a real gap', () => {
    const graph = buildCognitiveGraph(pkg, cognitionByCode)
    const prerequisite = graph.edges.find(edge => edge.id === 'curriculum:mandatory_prerequisite:o1:o3')
    expect(prerequisite?.origin).toBe('curriculum')
    // CS99-M01-O01 is consolidate, so the potential influence edge is surfaced.
    expect(graph.edges.some(edge => edge.kind === 'influence' && edge.origin === 'learner')).toBe(true)
  })
})

describe('constellationLayout', () => {
  it('is deterministic and places every node inside positive bounds', () => {
    const graph = buildCognitiveGraph(pkg, cognitionByCode)
    const first = constellationLayout(graph, { width: 1200, height: 900 })
    const second = constellationLayout(graph, { width: 1200, height: 900 })
    expect(first.placements.size).toBe(graph.nodes.length)
    expect(first.bounds.width).toBeGreaterThan(0)
    expect(first.bounds.height).toBeGreaterThan(0)
    for (const node of graph.nodes) expect(first.placements.get(node.id)).toEqual(second.placements.get(node.id))
  })
})

describe('recommendNext', () => {
  it('resumes an explicit last objective first', () => {
    const next = recommendNext(pkg, cognitionByCode, { lastObjective: 'CS99-M01-O02' })
    expect(next?.code).toBe('CS99-M01-O02')
  })

  it('prefers a real gap over a fresh objective', () => {
    const next = recommendNext(pkg, cognitionByCode)
    expect(next?.code).toBe('CS99-M01-O01')
  })

  it('prefers finishing partial evidence before starting something new', () => {
    const partial = new Map(cognitionByCode)
    partial.set('CS99-M01-O01', cognition('o1', 'CS99-M01-O01', '目标一', 'partial'))
    const next = recommendNext(pkg, partial)
    expect(next?.code).toBe('CS99-M01-O01')
  })

  it('skips a startable-looking objective whose strict prerequisite is still unknown', () => {
    const gated: AtlasPackage = {
      ...pkg,
      relations: [{ from: 'CS99-M01-O02', to: 'CS99-M01-O01', kind: 'mandatory_prerequisite', source: 'test' }],
    }
    const fresh = new Map([
      ['CS99-M01-O01', cognition('o1', 'CS99-M01-O01', '目标一', 'unknown')],
      ['CS99-M01-O02', cognition('o2', 'CS99-M01-O02', '目标二', 'unknown')],
      ['CS99-M02-O01', cognition('o3', 'CS99-M02-O01', '目标三', 'unknown')],
    ])
    const next = recommendNext(gated, fresh)
    expect(next?.code).toBe('CS99-M01-O02')
    expect(next?.reason).toContain('先修')
  })
})
