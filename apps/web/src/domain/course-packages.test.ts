import { describe, expect, it } from 'vitest'
import { loadCoursePackage, workspaceForObjective } from './course-packages'

describe('versioned course loading', () => {
  it('opens every approved core scope without claiming completed content', async () => {
    const packages = await Promise.all(Array.from({ length: 13 }, (_, i) => loadCoursePackage(`CS${String(i + 1).padStart(2, '0')}`, 'core')))
    expect(packages.every(Boolean)).toBe(true)
    expect(packages.reduce((n, course) => n + course!.objectives.length, 0)).toBe(366)
    expect(packages.every(course => course!.status === 'structured_validated')).toBe(true)
  })
  it('keeps legacy goal IDs separate from new core scopes', async () => {
    const previous = await loadCoursePackage('CS03')
    const core = await loadCoursePackage('CS03', 'core')
    expect(previous?.objectives.some(goal => goal.code === 'CS03-STACK-01')).toBe(true)
    expect(core?.objectives.some(goal => goal.code === 'CS03-M03-O01')).toBe(true)
    expect(core?.course_version_id).not.toBe(previous?.course_version_id)
  })
  it('rejects unknown courses instead of opening a stack exercise', async () => {
    expect(await loadCoursePackage('../CS03')).toBeNull()
  })
})

it('dispatches only registered activities, never arbitrary course prefixes', () => {
  expect(workspaceForObjective('CS03-STACK-01')).toBe('stack_trace')
  expect(workspaceForObjective('CS05-LOGIC-01')).toBe('truth_table')
  expect(workspaceForObjective('CS05-M01-O01')).toBeNull()
  expect(workspaceForObjective('CS01-UNKNOWN')).toBeNull()
})
