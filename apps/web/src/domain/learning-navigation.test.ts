import { describe, expect, it } from 'vitest'
import { learningNeighbors } from './learning-navigation'

describe('course learning navigation', () => {
  const goals = [{ code: 'A', title: 'one' }, { code: 'B', title: 'two' }, { code: 'C', title: 'three' }]
  it('keeps authored order and does not wrap at course ends', () => {
    expect(learningNeighbors(goals, 'A')).toEqual({ previous: null, next: goals[1], position: 1, total: 3 })
    expect(learningNeighbors(goals, 'C')).toEqual({ previous: goals[1], next: null, position: 3, total: 3 })
  })
  it('does not send an unknown objective into an arbitrary course route', () => {
    expect(learningNeighbors(goals, 'unknown')).toBeNull()
  })
})
