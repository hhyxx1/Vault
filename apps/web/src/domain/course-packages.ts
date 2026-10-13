import catalog from '../../../../content/courses/catalog.json'
import stackExample from '../../../../content/courses/CS03.stack-example.json'
import scopeCatalog from '../../../../content/courses/scope-catalog.json'
import { courseMapFromPackage } from './course-map'
import type { CodeRequest } from './code'
import type { AlgebraPrompt } from './algebra'
/** Extra published packages outside the platform-default course list (e.g. the C01 synthetic workshop). */
const extraCourses = (scopeCatalog as typeof scopeCatalog & { extra_courses?: typeof scopeCatalog.courses }).extra_courses ?? []
export type CourseAlgebraActivity = { id: string; version_id: string; code: string; version: string; objective_codes: string[]; kind: 'finite_algebra'; title?: string; reference_note?: string; student_action: string; theory: string[]; source_refs: string[]; completion_limit: string; availability: 'practice_ready' | 'pending'; algebra_prompt: AlgebraPrompt }
export type CodeVariant = { code: string; title: string; student_action: string; code_request: CodeRequest; reference_answer?: CodeRequest; prediction_prompt: string; reflection_prompt: string }
/** Learning-visible discovery metadata only. Expected outputs and independent inputs never appear here. */
export type PublicSemanticCase = { code: string; stdin: string }
export type PublicSemanticSuite = {
  standard_version: 'code-semantic-suite-v1'
  oracle_id: string
  comparator: 'exact' | 'integer' | 'number_tol' | 'token_multiset' | 'line_set' | 'sorted_lines' | 'huffman_codebook' | 'topological_order' | 'sorted_records' | 'external_project' | 'graph_search_order' | 'minimum_forest'
  language: CodeRequest['language']
  visible_cases: PublicSemanticCase[]
  independent_case_count: number
  scope_note: string
}
export type CourseCodeActivity = {
  id: string; version_id: string; code: string; version: string; objective_codes: string[]
  kind: 'code'; availability: 'pending' | 'practice_ready'; title?: string
  student_action: string; theory: string[]; code_request: CodeRequest
  prediction_prompt?: string; reflection_prompt?: string; hints?: string[]
  reference_answer?: CodeRequest; variants?: CodeVariant[]; source_refs: string[]; completion_limit: string
  check_version?: string | null
  semantic_suite?: PublicSemanticSuite | null
}

export type AtlasGoal = { id: string; code: string; title: string; criteria: Array<{ id: string; title: string; verification: string }> }
export type AtlasUnit = { kind?: string; id: string; title: string; objective_refs: string[] }
export type AtlasChapter = { kind?: string; id: string; title: string; children: AtlasUnit[] }
export type AtlasPackage = {
  course_id: string; course_version_id: string; course_code: string; title: string
  version: string; status: string; scope_note: string; objectives: AtlasGoal[]
  relations: Array<{ from: string; to: string; kind: string; source?: string }>
  outline?: AtlasChapter[]; content_sources?: string[]
  activities?: Array<CourseCodeActivity | CourseAlgebraActivity | { kind: string; objective_codes: string[]; availability?: string }>
  sources?: Array<{ id: string; title: string; url: string; locator: string; status: string }>
}
export function codeActivityForObjective(data: AtlasPackage, objective: string): CourseCodeActivity | null {
  if (!data.objectives.some(goal => goal.code === objective)) return null
  return data.activities?.find((activity): activity is CourseCodeActivity => activity.kind === 'code' && activity.availability === 'practice_ready' && activity.objective_codes.includes(objective) && 'code_request' in activity && !!activity.code_request) ?? null
}
export function algebraActivityForObjective(data: AtlasPackage, objective: string): CourseAlgebraActivity | null {
  if (!data.objectives.some(goal => goal.code === objective)) return null
  return data.activities?.find((activity): activity is CourseAlgebraActivity => activity.kind === 'finite_algebra' && activity.availability === 'practice_ready' && activity.objective_codes.includes(objective) && 'algebra_prompt' in activity) ?? null
}

export async function loadAlgebraActivity(objective: string, versionId?: string): Promise<{ course: AtlasPackage; activity: CourseAlgebraActivity } | null> {
  const archived = (scopeCatalog as typeof scopeCatalog & { archived_courses?: typeof scopeCatalog.courses }).archived_courses ?? []
  const entries = [...scopeCatalog.courses, ...extraCourses, ...(versionId ? archived : [])].filter(entry => entry.package_path && (!versionId || entry.version_id === versionId))
  for (const entry of entries) {
    if (!objective.startsWith(entry.code + '-')) continue
    const load = bundles[`../../../../content/courses/${entry.package_path}`]
    if (!load) continue
    const course = await load()
    if (course.course_id !== entry.id || course.course_version_id !== entry.version_id) throw new Error('课程版本与目录不一致。')
    const activity = algebraActivityForObjective(course, objective)
    if (activity) return { course, activity }
  }
  return null
}

export async function loadCodeActivity(objective: string, versionId?: string): Promise<{ course: AtlasPackage; activity: CourseCodeActivity } | null> {
  const archived = (scopeCatalog as typeof scopeCatalog & { archived_courses?: typeof scopeCatalog.courses }).archived_courses ?? []
  const entries = [...scopeCatalog.courses, ...extraCourses, ...catalog.courses, ...(versionId ? archived : [])].filter(entry => entry.package_path && (!versionId || entry.version_id === versionId))
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

export async function loadCoursePackage(code: string, edition: 'current' | 'core' = 'current', versionId?: string): Promise<AtlasPackage | null> {
  const current = catalog.courses.find(course => course.code === code)
  const core = [...scopeCatalog.courses, ...extraCourses].find(course => course.code === code)
  const archived = (scopeCatalog as typeof scopeCatalog & { archived_courses?: typeof scopeCatalog.courses }).archived_courses ?? []
  const preferred = (core as (typeof core & { preferred_for_learning?: boolean }) | undefined)?.preferred_for_learning
  const entry = versionId
    ? [...scopeCatalog.courses, ...extraCourses, ...catalog.courses, ...archived].find(item => item.code === code && item.version_id === versionId)
    : edition === 'core' || preferred ? core : current?.package_path ? current : core
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


export function legacyVersionForObjective(course: string, objective: string): string | undefined {
  if (course === stackExample.course_code && stackExample.objectives.some(goal => goal.code === objective)) return stackExample.course_version_id
  return catalog.courses.find(item => item.code === course && item.workspace_bindings?.some(binding => binding.objective_code === objective))?.version_id
}
