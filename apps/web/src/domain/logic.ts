import logicExample from '../../../../content/courses/CS05.logic-example.json'
import { courseMapFromPackage, type ObjectiveState } from './course-map'
import type { components } from '../../../../packages/contracts/api.generated'

export const logicCourseMap = courseMapFromPackage(logicExample)
export const LOGIC_OBJECTIVE = logicExample.objectives[0].code
export const LOGIC_ACTIVITY = logicExample.activities[0].version
export const LOGIC_VERSION = logicExample.version
export const LOGIC_STANDARD = logicExample.activities[0].standard_version
export const logicAssignments = logicExample.activities[0].assignments.map(([p, q]) => ({ p, q }))

export type TruthCell = { implication: boolean | null; contrapositive: boolean | null; biconditional: boolean | null }
export type CompleteTruthCell = { implication: boolean; contrapositive: boolean; biconditional: boolean }
export type LogicResult = components['schemas']['LogicVerificationResult']
export type CourseAttempt = {
  id: string; spaceId: string; artifactId: string; objectiveId: typeof LOGIC_OBJECTIVE
  courseCode: 'CS05'; activityVersion: typeof LOGIC_ACTIVITY
  rows: TruthCell[]; explanation: string; result: LogicResult | null
  createdAt: string; updatedAt: string; submittedAt?: string
  resultTrust?: 'client_reported'
}

export function newLogicAttempt(spaceId: string, previous?: CourseAttempt): CourseAttempt {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(), spaceId, artifactId: previous?.artifactId ?? crypto.randomUUID(),
    objectiveId: LOGIC_OBJECTIVE, courseCode: 'CS05', activityVersion: LOGIC_ACTIVITY,
    rows: previous ? structuredClone(previous.rows) : logicAssignments.map(() => ({ implication: null, contrapositive: null, biconditional: null })),
    explanation: previous?.explanation ?? '', result: null, createdAt: now, updatedAt: now,
  }
}

export function completeLogicRows(rows: TruthCell[]): CompleteTruthCell[] {
  if (rows.length !== logicAssignments.length) throw new Error('请完成四组赋值。')
  if (rows.some(row => Object.values(row).some(value => typeof value !== 'boolean'))) throw new Error('请填完每一格真值，再提交核验。')
  return rows as CompleteTruthCell[]
}

export function logicObjectiveState(records: CourseAttempt[]): ObjectiveState {
  const latest = records.filter(record => record.objectiveId === LOGIC_OBJECTIVE && record.result && !record.resultTrust)
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)).at(-1)
  if (!latest?.result) return 'unknown'
  return latest.result.truth_correct ? 'partial' : 'consolidate'
}
