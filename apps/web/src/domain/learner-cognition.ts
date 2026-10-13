import type { ReviewAssignment } from '../api/reviews'
import type { AlgebraAttempt } from './algebra'
import { currentAlgebraAttempt } from './algebra'
import {
  bestCodeObjectiveState,
  currentCodeAssessment,
  currentSuiteAssessment,
} from './code-assessment'
import type { CodeAttempt } from './code'
import type { AtlasPackage } from './course-packages'
import { algebraActivityForObjective, codeActivityForObjective } from './course-packages'
import type { ObjectiveState } from './course-map'
import { currentObjectiveEvidence, objectiveStates, type EvidenceRecord, type HelpEvent } from './learning'
import {
  LOGIC_ACTIVITY,
  LOGIC_OBJECTIVE,
  LOGIC_STANDARD,
  LOGIC_VERSION,
  logicObjectiveState,
  type CourseAttempt,
} from './logic'
import { reviewedGoalEvidence } from './review-evidence'
import type { StructuredAttempt } from './structured'
import { currentStructuredAttempt } from './structured'
import { structuredGoalEvidence, structuredObjectiveState } from './structured-evidence'

/** A single condition row shared by every evidence source that reports per-criterion results. */
export type GoalCondition = { id: string; status: 'met' | 'not_met' | 'needs_review'; reason: string }

/** Where a recorded signal about one objective actually came from. */
export type EvidenceSourceKind =
  | 'teacher_review'
  | 'semantic_suite'
  | 'code_task'
  | 'structured_trace'
  | 'trace_run'
  | 'truth_table'
  | 'finite_algebra'

export type EvidenceFacet = {
  kind: EvidenceSourceKind
  label: string
  detail: string
  /** How strong this source is for the current objective, not a mastery grade. */
  strength: 'verified' | 'partial' | 'caution' | 'unverified'
  at: string | null
}

/** A discovered problem or an open item. Never invented: always tied to a record. */
export type CognitionFlag = {
  id: string
  label: string
  detail: string
  tone: 'caution' | 'info'
}

export type HelpUsage = { hint: number; answer: number; agent: number }

export type ObjectiveCognition = {
  objectiveId: string
  code: string
  title: string
  state: ObjectiveState
  /** Real evidence sources found for this objective, strongest first. */
  evidence: EvidenceFacet[]
  /** Evidence-derived problems / open items. Empty means nothing reliable was found. */
  flags: CognitionFlag[]
  /** The per-criterion conditions of the strongest available source, when it reports them. */
  criteria: GoalCondition[] | null
  help: HelpUsage
  /** Latest trustworthy observation time across every source. */
  lastObservedAt: string | null
  /** Whether any attempt/work exists at all (used to distinguish "start" from "review"). */
  hasAttempt: boolean
}

export type LearnerSnapshot = {
  evidence: EvidenceRecord[]
  courseAttempts: CourseAttempt[]
  structuredAttempts: StructuredAttempt[]
  codeAttempts: CodeAttempt[]
  algebraAttempts: AlgebraAttempt[]
  help: HelpEvent[]
  reviews: { rows: readonly ReviewAssignment[]; owner: string | null; unavailable: boolean }
}

const newest = (...times: (string | null | undefined)[]): string | null =>
  times.filter((time): time is string => !!time).sort((a, b) => b.localeCompare(a))[0] ?? null

function goalConditionsOf(result: { criteria?: ReadonlyArray<{ id: string; status: string; reason?: string }> } | null | undefined): GoalCondition[] | null {
  if (!result?.criteria?.length) return null
  return result.criteria.map(row => ({ id: row.id, status: row.status as GoalCondition['status'], reason: row.reason ?? '' }))
}

/**
 * Project the learner's real records into a per-objective cognitive view.
 *
 * This is the single source of truth for the four reliable states, and it also
 * carries the extra dimensions the old atlas merged into one status field:
 * which sources produced the state, which help was used, what problems were
 * actually observed, and when the last trustworthy observation happened.
 *
 * Nothing here is inferred from the course structure. A missing source stays
 * missing; "no evidence" is never rendered as "not mastered".
 */
export function deriveObjectiveCognition(data: AtlasPackage, snap: LearnerSnapshot): {
  byId: ReadonlyMap<string, ObjectiveCognition>
  byCode: ReadonlyMap<string, ObjectiveCognition>
} {
  const evidenceStates = objectiveStates(snap.evidence)
  const currentLogic = snap.courseAttempts.filter(
    attempt =>
      attempt.result?.course_version === LOGIC_VERSION
      && attempt.result.activity_version === LOGIC_ACTIVITY
      && attempt.result.standard_version === LOGIC_STANDARD,
  )
  const logicLatest = currentLogic
    .filter(attempt => attempt.result && !attempt.resultTrust)
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    .at(-1)

  const helpByObjective = new Map<string, HelpUsage>()
  for (const event of snap.help) {
    const usage = helpByObjective.get(event.objectiveId) ?? { hint: 0, answer: 0, agent: 0 }
    if (event.kind === 'hint') usage.hint += 1
    else if (event.kind === 'answer') usage.answer += 1
    else usage.agent += 1
    helpByObjective.set(event.objectiveId, usage)
  }

  const byId = new Map<string, ObjectiveCognition>()
  for (const goal of data.objectives) {
    const objectiveId = goal.id ?? goal.code
    const codeActivity = codeActivityForObjective(data, goal.code)
    const algebraActivity = algebraActivityForObjective(data, goal.code)

    const legacy = data.course_code === 'CS03' ? currentObjectiveEvidence(snap.evidence, goal.code) : undefined
    const structured = currentStructuredAttempt(snap.structuredAttempts, goal.code, data.course_version_id)
    const structuredIsLatest = !!structured
      && (!legacy || (structured.submittedAt ?? structured.createdAt) >= legacy.createdAt)
    const suite = currentSuiteAssessment(snap.codeAttempts, goal.code, data.course_version_id)
    const fixed = currentCodeAssessment(snap.codeAttempts, goal.code, data.course_version_id)
    const algebra = algebraActivity
      ? currentAlgebraAttempt(snap.algebraAttempts, goal.code, data.course_version_id, algebraActivity.version_id)
      : undefined
    const review = snap.reviews.owner && codeActivity
      ? reviewedGoalEvidence(snap.reviews.rows, snap.reviews.owner, data.course_version_id, goal, codeActivity.version_id)
      : null
    const logic = goal.code === LOGIC_OBJECTIVE ? logicLatest : undefined

    // --- State: reproduce the shipped precedence exactly, no new assumptions. ---
    let state: ObjectiveState
    if (data.course_code === 'CS03') {
      const structuredState = structured && structuredIsLatest && structured.result
        ? structuredObjectiveState(structured.result, goal.code)
        : undefined
      state = structuredState ?? evidenceStates.get(objectiveId) ?? 'unknown'
    } else {
      state = goal.code === LOGIC_OBJECTIVE ? logicObjectiveState(currentLogic) : 'unknown'
    }
    const codeState = bestCodeObjectiveState(snap.codeAttempts, goal.code, data.course_version_id)
    if (codeState !== 'unknown') state = codeState
    if (algebra?.result && (!(suite ?? fixed) || algebra.updatedAt >= (suite ?? fixed)!.updatedAt)) {
      state = algebra.result.prediction_correct ? 'partial' : 'consolidate'
    }
    if (review) state = review.state

    // --- Evidence facets: only sources that actually produced a record. ---
    const evidence: EvidenceFacet[] = []
    if (review) {
      evidence.push({
        kind: 'teacher_review',
        label: '授权教师审阅',
        detail: review.state === 'verified'
          ? '已按完整标准签署当前课程版本的冻结作品。'
          : '审阅仍在进行或需要补充材料；暂不作为完整达标结论。',
        strength: review.state === 'verified' ? 'verified' : 'partial',
        at: review.assignment.updated_at,
      })
    }
    if (suite?.result?.suite_assessment) {
      const independent = suite.result.suite_assessment.cases.filter(row => row.kind === 'independent')
      const met = independent.filter(row => row.status === 'met').length
      evidence.push({
        kind: 'semantic_suite',
        label: '独立语义核验',
        detail: `保密独立用例 ${met}/${independent.length} 通过；有限用例不证明一般正确，本核验不授予独立掌握。`,
        strength: suite.result.suite_assessment.suspected_hardcoding ? 'caution' : 'partial',
        at: suite.updatedAt,
      })
    }
    if (!suite && fixed?.result?.task_assessment) {
      evidence.push({
        kind: 'code_task',
        label: '固定条件核验',
        detail: '服务端固定条件检查；原理解释与独立迁移仍待复核。',
        strength: 'partial',
        at: fixed.updatedAt,
      })
    }
    if (structuredIsLatest && structured?.result) {
      evidence.push({
        kind: 'structured_trace',
        label: '结构逐步推演',
        detail: '逐步状态、边界与解释按当前活动版本核验。',
        strength: structuredObjectiveState(structured.result, goal.code) === 'consolidate' ? 'caution' : 'partial',
        at: structured.submittedAt ?? structured.createdAt,
      })
    }
    if (legacy) {
      evidence.push({
        kind: 'trace_run',
        label: '本机栈推演核验',
        detail: '本机记录的历史推演结果；与更新版本证据分开保存。',
        strength: 'partial',
        at: legacy.createdAt,
      })
    }
    if (algebra?.result) {
      evidence.push({
        kind: 'finite_algebra',
        label: '有限运算表核验',
        detail: '完整有限表与预测已比对；没有把一次预测正确标记成掌握。',
        strength: algebra.result.prediction_correct ? 'partial' : 'caution',
        at: algebra.updatedAt,
      })
    }
    if (logic?.result) {
      evidence.push({
        kind: 'truth_table',
        label: '真值表核验',
        detail: '四组赋值的真值判定结果。',
        strength: logic.result.truth_correct ? 'partial' : 'caution',
        at: logic.updatedAt,
      })
    }

    // --- Flags: only observed problems / genuinely open items. ---
    const flags: CognitionFlag[] = []
    if (suite?.result?.suite_assessment?.suspected_hardcoding) {
      flags.push({ id: 'hardcoding', label: '疑似只针对样例硬编码', detail: '学习可见输入通过，但保密独立输入未通过。', tone: 'caution' })
    }
    if (algebra?.result && !algebra.result.prediction_correct) {
      flags.push({ id: 'algebra_mismatch', label: '预测与完整有限表不一致', detail: '已填写的性质预测与完整表结论不同，需回到定义逐项检查。', tone: 'caution' })
    }
    if (logic?.result && !logic.result.truth_correct) {
      flags.push({ id: 'truth_mismatch', label: '真值判定存在错误', detail: '部分赋值组合的真值填写与标准结论不一致。', tone: 'caution' })
    }
    if (structuredIsLatest && structured?.result) {
      const conditions = structuredGoalEvidence(structured.result, goal.code)
      for (const row of conditions.filter(item => item.status === 'not_met')) {
        flags.push({ id: `structured_${row.id}`, label: '推演条件未满足', detail: row.reason, tone: 'caution' })
      }
    }
    const strongest = review?.criteria
      ?? goalConditionsOf(suite?.result?.suite_assessment)
      ?? goalConditionsOf(fixed?.result?.task_assessment)
      ?? goalConditionsOf(legacy?.result)
      ?? (structuredIsLatest && structured?.result ? structuredGoalEvidence(structured.result, goal.code) : null)
      ?? goalConditionsOf(logic?.result)
    if (strongest?.some(row => row.status === 'needs_review')) {
      flags.push({ id: 'open_review', label: '存在待复核条目', detail: '原理解释与独立迁移等条目始终需要人工或新情境复核，规则核验不负责它们。', tone: 'info' })
    }
    if (snap.reviews.unavailable) {
      flags.push({ id: 'review_unavailable', label: '教师审阅暂时不可确认', detail: '联网审阅结论无法读取；本机练习证据仍然保留。', tone: 'info' })
    }

    const hasAttempt = !!(legacy || structuredIsLatest || suite || fixed || algebra?.result || logic?.result || review)
    const criteria = review?.criteria ?? strongest
    const cognition: ObjectiveCognition = {
      objectiveId,
      code: goal.code,
      title: goal.title,
      state,
      evidence,
      flags,
      criteria: criteria ?? null,
      help: helpByObjective.get(goal.code) ?? { hint: 0, answer: 0, agent: 0 },
      lastObservedAt: newest(
        review?.assignment.updated_at,
        suite?.updatedAt,
        fixed?.updatedAt,
        structuredIsLatest ? structured?.submittedAt ?? structured?.createdAt : null,
        legacy?.createdAt,
        algebra?.updatedAt,
        logic?.updatedAt,
      ),
      hasAttempt,
    }
    byId.set(objectiveId, cognition)
  }

  const byCode = new Map([...byId.values()].map(item => [item.code, item]))
  return { byId, byCode }
}
