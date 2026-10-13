import { describe, expect, it } from 'vitest'
import { loadCoursePackage, workspaceForObjective, codeActivityForObjective } from './course-packages'

describe('versioned course loading', () => {
  it('opens every approved core scope without claiming completed content', async () => {
    const packages = await Promise.all(Array.from({ length: 13 }, (_, i) => loadCoursePackage(`CS${String(i + 1).padStart(2, '0')}`, 'core')))
    expect(packages.every(Boolean)).toBe(true)
    expect(packages.reduce((n, course) => n + course!.objectives.length, 0)).toBe(377)
    expect(packages.every(course => course!.status === 'structured_validated')).toBe(true)
  })
  it('keeps legacy goal IDs separate from new core scopes', async () => {
    const previous = await loadCoursePackage('CS03', 'current', 'c47c1551-76d5-4b80-aeae-33cd253d8ca0')
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

it('selects only a ready code activity from the exact course version and objective', () => {
  const data = { course_id: 'course', course_version_id: 'version', objectives: [{ code: 'CUSTOM-01' }], activities: [
    { code: 'CUSTOM-A', kind: 'code', availability: 'practice_ready', objective_codes: ['CUSTOM-01'], code_request: { language: 'c17', entry: 'main.c', files: { 'main.c': 'int main(void){return 0;}' }, stdin: '' } },
  ] }
  expect(codeActivityForObjective(data as never, 'CUSTOM-01')?.code).toBe('CUSTOM-A')
  expect(codeActivityForObjective(data as never, 'CUSTOM-OTHER')).toBeNull()
  expect(codeActivityForObjective({ ...data, activities: [{ ...data.activities[0], availability: 'pending' }] } as never, 'CUSTOM-01')).toBeNull()
})

it('loads an archived graph by exact course version and rejects wrong-course IDs', async () => {
  const old = await loadCoursePackage('CS03', 'core', '2ddb5945-157f-5611-bfed-e1e84b96f7cd')
  expect(old?.version).toBe('CS03-core-practice-0.2.0')
  expect(await loadCoursePackage('CS01', 'core', '2ddb5945-157f-5611-bfed-e1e84b96f7cd')).toBeNull()
})


it('opens the maintained data-structures learning package by default', async () => {
  const course = await loadCoursePackage('CS03')
  expect(course?.version).toBe('CS03-core-practice-0.6.0')
  expect(course?.objectives).toHaveLength(41)
  expect(course?.objectives.some(objective => objective.code === 'CS03-M03-O04')).toBe(true)
})
