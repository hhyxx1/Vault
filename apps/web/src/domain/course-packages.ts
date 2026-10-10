import catalog from '../../../../content/courses/catalog.json'
import scopeCatalog from '../../../../content/courses/scope-catalog.json'
import { courseMapFromPackage } from './course-map'
import type { CodeRequest } from './code'
export type CodeVariant = { code: string; title: string; student_action: string; code_request: CodeRequest; reference_answer?: CodeRequest; prediction_prompt: string; reflection_prompt: string }
export type CourseCodeActivity = {
  id: string; version_id: string; code: string; version: string; objective_codes: string[]
  kind: 'code'; availability: 'pending' | 'practice_ready'; title?: string
  student_action: string; theory: string[]; code_request: CodeRequest
  prediction_prompt?: string; reflection_prompt?: string; hints?: string[]
  reference_answer?: CodeRequest; variants?: CodeVariant[]; source_refs: string[]; completion_limit: string
  check_version?: string | null
}

export type AtlasGoal = { id: string; code: string; title: string; criteria: Array<{ id: string; title: string; verification: string }> }
export type AtlasUnit = { kind?: string; id: string; title: string; objective_refs: string[] }
export type AtlasChapter = { kind?: string; id: string; title: string; children: AtlasUnit[] }
export type AtlasPackage = {
  course_id: string; course_version_id: string; course_code: string; title: string
  version: string; status: string; scope_note: string; objectives: AtlasGoal[]
  relations: Array<{ from: string; to: string; kind: string; source?: string }>
  outline?: AtlasChapter[]; content_sources?: string[]
  activities?: Array<CourseCodeActivity | { kind: string; objective_codes: string[]; availability?: string }>
  sources?: Array<{ id: string; title: string; url: string; locator: string; status: string }>
}
export function codeActivityForObjective(data: AtlasPackage, objective: string): CourseCodeActivity | null {
  if (!data.objectives.some(goal => goal.code === objective)) return null
  return data.activities?.find((activity): activity is CourseCodeActivity => activity.kind === 'code' && activity.availability === 'practice_ready' && activity.objective_codes.includes(objective) && 'code_request' in activity && !!activity.code_request) ?? null
}

export async function loadCodeActivity(objective: string, versionId?: string): Promise<{ course: AtlasPackage; activity: CourseCodeActivity } | null> {
  const archived = (scopeCatalog as typeof scopeCatalog & { archived_courses?: typeof scopeCatalog.courses }).archived_courses ?? []
  const entries = [...scopeCatalog.courses, ...catalog.courses, ...(versionId ? archived : [])].filter(entry => entry.package_path && (!versionId || entry.version_id === versionId))
  for (const entry of entries) {
    const load = bundles[`../../../../content/courses/${entry.package_path}`]
    if (!load) continue
    const course = await load()
    if (course.course_id !== entry.id || course.course_version_id !== entry.version_id) throw new Error('课程版本与目录不一致。')
    const activity = codeActivityForObjective(course, objective)
    if (activity) return { course, activity }
  }
  return null
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
