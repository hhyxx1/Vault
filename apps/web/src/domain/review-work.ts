import type { CourseAttempt } from './logic'
import type { StructuredAttempt } from './structured'
import type { AlgebraAttempt } from './algebra'
import { canonicalHash } from './integrity'

export type ManualWorkKind = 'course_attempt' | 'structured_attempt' | 'algebra_attempt'
export type ManualWork = CourseAttempt | StructuredAttempt | AlgebraAttempt
const fields: Record<ManualWorkKind, string[]> = {
  course_attempt: ['courseCode', 'objectiveId', 'activityVersion', 'rows', 'explanation'],
  structured_attempt: ['courseCode', 'objectiveCode', 'activityVersion', 'kind', 'traceRows', 'bracketRows', 'explanation'],
  algebra_attempt: ['courseCode', 'objectiveCode', 'courseVersionId', 'activityVersionId', 'activityVersion', 'mode', 'table', 'secondTable', 'mapping', 'predictions', 'explanation'],
}
export async function manualReviewContent(kind: ManualWorkKind, work: ManualWork) {
  const record = work as unknown as Record<string, unknown>
  const content = Object.fromEntries(fields[kind].map(key => [key, record[key] ?? null]))
  return { content, hash: await canonicalHash(content) }
}
