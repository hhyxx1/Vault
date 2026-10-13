import { describe, expect, it } from 'vitest'
import { courseLearningStage, practiceHref } from './learning-journey'

describe('course learning entry', () => {
  it('opens a guided learning start when a student follows a graph node', () => {
    expect(courseLearningStage(new URLSearchParams())).toBe('orientation')
  })

  it('does not bypass the guide when a student opens a variant directly', () => {
    expect(courseLearningStage(new URLSearchParams('task=change-capacity'))).toBe('orientation')
  })

  it('opens the practical workspace only after an explicit action', () => {
    expect(courseLearningStage(new URLSearchParams('stage=practice'))).toBe('practice')
  })

  it('preserves the course version and chosen variant when starting practice', () => {
    const url = new URL(practiceHref('CS03-M01-O01', 'course-v6', 'change-capacity'), 'https://vault.test')
    expect(url.pathname).toBe('/learn/CS03-M01-O01')
    expect(url.searchParams.get('courseVersion')).toBe('course-v6')
    expect(url.searchParams.get('task')).toBe('change-capacity')
    expect(url.searchParams.get('stage')).toBe('practice')
  })
})
