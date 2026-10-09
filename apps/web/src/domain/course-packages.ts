import catalog from '../../../../content/courses/catalog.json'
import scopeCatalog from '../../../../content/courses/scope-catalog.json'
import { courseMapFromPackage } from './course-map'

export type AtlasGoal = { id: string; code: string; title: string; criteria: Array<{ id: string; title: string; verification: string }> }
export type AtlasUnit = { kind?: string; id: string; title: string; objective_refs: string[] }
export type AtlasChapter = { kind?: string; id: string; title: string; children: AtlasUnit[] }
export type AtlasPackage = {
  course_id: string; course_version_id: string; course_code: string; title: string
  version: string; status: string; scope_note: string; objectives: AtlasGoal[]
  relations: Array<{ from: string; to: string; kind: string; source?: string }>
  outline?: AtlasChapter[]; content_sources?: string[]
}
// Public navigation bundles only. Checker fixtures and protected answers must never
// be placed under this glob; course package schemas reject private payload fields.
const bundles = import.meta.glob<AtlasPackage>(['../../../../content/courses/*-example.json', '../../../../content/courses/*/*/manifest.json'], { import: 'default' })

export async function loadCoursePackage(code: string, edition: 'current' | 'core' = 'current'): Promise<AtlasPackage | null> {
  const current = catalog.courses.find(course => course.code === code)
  const core = scopeCatalog.courses.find(course => course.code === code)
  const entry = edition === 'core' ? core : current?.package_path ? current : core
  if (!entry?.package_path) return null
  const load = bundles[`../../../../content/courses/${entry.package_path}`]
  if (!load) return null
  const data = await load()
  if (data.course_code !== code || data.course_id !== entry.id || data.course_version_id !== entry.version_id) {
    throw new Error('课程版本与目录不一致，请刷新后重试。')
  }
  courseMapFromPackage(data as Parameters<typeof courseMapFromPackage>[0])
  return data
}

export function workspaceForObjective(objective: string): 'stack_trace' | 'code_draft' | 'truth_table' | 'structured_trace' | null {
  const binding = catalog.courses.flatMap(course => course.workspace_bindings ?? []).find(item => item.objective_code === objective)
  switch (binding?.workspace) {
    case 'stack_trace': return 'stack_trace'
    case 'code_draft': return 'code_draft'
    case 'truth_table': return 'truth_table'
    case 'structured_trace': return 'structured_trace'
    default: return null
  }
}

export function hasCurrentActivityPackage(code: string): boolean {
  return !!catalog.courses.find(course => course.code === code)?.package_path
}
