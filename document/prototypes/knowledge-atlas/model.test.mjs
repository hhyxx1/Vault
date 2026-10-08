import test from 'node:test'
import assert from 'node:assert/strict'
import { chapters, goals, relations, summary, goalIdsForChapter, simulateOutcome } from './model.mjs'

test('the complete design fixture resolves chapter references without double-counting a cross-chapter goal', () => {
  assert.equal(chapters.length, 8)
  assert.equal(chapters.flatMap(chapter => chapter.units).length, 16)
  const references = chapters.flatMap(chapter => chapter.units.flatMap(unit => unit.goalIds))
  assert.equal(references.length, 33)
  assert.equal(new Set(references).size, 32)
  assert.equal(goals.length, 32)
  assert.equal(new Set(goals.map(goal => goal.id)).size, goals.length)
  assert.equal(summary(references).total, 32)
  for (const id of references) assert.ok(goals.some(goal => goal.id === id), `Missing goal ${id}`)
  assert.ok(goalIdsForChapter('foundations').includes('cost-analysis'))
  assert.ok(goalIdsForChapter('sorting').includes('cost-analysis'))
})

test('summary derives all four state counts from the supplied goals and deduplicates selected IDs', () => {
  const fixture = [
    { id: 'a', state: 'verified' }, { id: 'b', state: 'partial' },
    { id: 'c', state: 'consolidate' }, { id: 'd', state: 'unknown' },
  ]
  assert.deepEqual(summary(['a', 'a', 'b', 'c', 'd'], fixture), { total: 4, verified: 1, partial: 1, consolidate: 1, unknown: 1 })
  assert.deepEqual(summary(['d'], fixture), { total: 1, verified: 0, partial: 0, consolidate: 0, unknown: 1 })
  assert.deepEqual(summary([], fixture), { total: 0, verified: 0, partial: 0, consolidate: 0, unknown: 0 })
  assert.throws(() => summary(['missing'], fixture), /Unknown goal/)
})

test('all visible fixture details are explicitly simulated and every relationship resolves to two goals', () => {
  assert.ok(goals.length > 0)
  for (const goal of goals) {
    assert.equal(goal.simulation, true)
    assert.ok(goal.title && goal.description && goal.action)
    assert.ok(['supported', 'review', 'unavailable'].includes(goal.support))
    assert.ok(goal.criteria.length > 0)
    assert.ok(goal.criteria.every(item => item.label && ['pass', 'pending', 'gap'].includes(item.status)))
    assert.ok(goal.evidence.every(item => item.title.includes('模拟') && item.detail))
    if (goal.state === 'verified') assert.ok(goal.criteria.every(item => item.status === 'pass'))
  }
  assert.ok(relations.length > 0)
  assert.equal(new Set(relations.map(relation => relation.id)).size, relations.length)
  for (const relation of relations) {
    assert.ok(goals.some(goal => goal.id === relation.from))
    assert.ok(goals.some(goal => goal.id === relation.to))
    assert.notEqual(relation.from, relation.to)
    assert.ok(['prerequisite', 'association', 'application'].includes(relation.kind))
    assert.ok(relation.reason && relation.source.includes('模拟'))
  }
})

test('passing the new independent stack condition updates only that goal and cannot mutate source evidence', () => {
  const before = structuredClone(goals)
  const result = simulateOutcome(goals, 'pass')
  const stack = result.find(goal => goal.id === 'stack-trace')
  assert.equal(before.find(goal => goal.id === 'stack-trace')?.state, 'partial')
  assert.equal(stack?.state, 'verified')
  assert.ok(stack.criteria.every(item => item.status === 'pass'))
  assert.ok(stack.evidence.some(item => item.detail.includes('独立') && item.detail.includes('新条件')))
  assert.deepEqual(result.filter(goal => goal.id !== 'stack-trace'), before.filter(goal => goal.id !== 'stack-trace'))
  assert.deepEqual(goals, before)
  stack.criteria[0].status = 'gap'
  assert.deepEqual(goals, before)
})

test('a later conflict preserves the simulated success history and exposes a concrete gap', () => {
  const passed = simulateOutcome(goals, 'pass')
  const result = simulateOutcome(passed, 'conflict')
  const priorStack = passed.find(goal => goal.id === 'stack-trace')
  const stack = result.find(goal => goal.id === 'stack-trace')
  assert.equal(stack.state, 'consolidate')
  assert.ok(stack.criteria.some(item => item.status === 'gap'))
  assert.ok(priorStack.evidence.every(item => stack.evidence.some(record => record.title === item.title && record.detail === item.detail)))
  assert.equal(priorStack.state, 'verified')
  assert.deepEqual(simulateOutcome(result, 'baseline'), goals)
  assert.throws(() => simulateOutcome(goals, 'unsupported'), /Unknown outcome/)
})
