import type { components } from '../../../../packages/contracts/api.generated'
import type { ObjectiveState } from './course-map'
import stackExample from '../../../../content/courses/CS03.stack-example.json'

export type TraceMachine = 'stack' | 'ring_queue' | 'linked_queue'
export type StructuredMachine = TraceMachine | 'bracket_judgement'
export type TraceStatus = 'ok' | 'underflow' | 'full'
export type StateFieldFormat = 'int_list' | 'nullable_int_list' | 'int'

export type StateFieldSpec = { name: string; label: string; format: StateFieldFormat }
export type CriterionSpec = { id: string; title: string }
export type PromptOperation = { kind: string; value?: number }

type BasePrompt = {
  id: string
  versionId: string
  code: string
  title: string
  version: string
  objectiveCodes: string[]
  standardVersion: string
  studentAction: string
  theory: string[]
  criteria: CriterionSpec[]
  completionLimit: string
}

export type TraceActivityPrompt = BasePrompt & {
  kind: 'structured_trace'
  machine: TraceMachine
  capacity: number | null
  statuses: TraceStatus[]
  stateFields: StateFieldSpec[]
  operations: PromptOperation[]
}

export type BracketActivityPrompt = BasePrompt & {
  kind: 'bracket_judgement'
  machine: 'bracket_judgement'
  cases: string[]
}

export type StructuredActivityPrompt = TraceActivityPrompt | BracketActivityPrompt

export type StructuredTraceResult = components['schemas']['StructuredVerificationResult']
export type BracketVerificationResult = components['schemas']['BracketVerificationResult']
export type StructuredResult = StructuredTraceResult | BracketVerificationResult
export type StructuredTraceStep = components['schemas']['StructuredTraceStep']
export type BracketJudgement = components['schemas']['BracketJudgement']

export type TraceRowInput = { state: Record<string, string>; value: string; status: TraceStatus | '' }
export type BracketVerdict = '' | 'matched' | 'mismatch'
export type BracketRowInput = { case: string; matched: BracketVerdict; mismatchIndex: string }

export type StructuredAttempt = {
  /** Per-version UUID; doubles as client_revision_id and the Dexie row key. */
  id: string
  /** Stable artifact UUID kept across retries; doubles as client_artifact_id. */
  artifactId: string
  spaceId: string
  courseCode: 'CS03'
  activityVersion: string
  /** Primary objective code (first binding); used to light the atlas node. */
  objectiveCode: string
  kind: 'structured_trace' | 'bracket_judgement'
  explanation: string
  traceRows: TraceRowInput[]
  bracketRows: BracketRowInput[]
  result: StructuredResult | null
  resultTrust: string | null
  createdAt: string
  updatedAt: string
  submittedAt?: string
}

type RawActivity = {
  id: string
  version_id: string
  code: string
  title?: string
  version: string
  objective_codes: string[]
  standard_version: string
  student_action: string
  theory: string[]
  completion_limit: string
  machine?: StructuredMachine
  capacity?: number | null
  statuses?: TraceStatus[]
  state_fields?: StateFieldSpec[]
  criteria?: CriterionSpec[]
  operations?: PromptOperation[]
  cases?: string[]
}

function toPrompt(raw: RawActivity): StructuredActivityPrompt {
  const base: BasePrompt = {
    id: raw.id,
    versionId: raw.version_id,
    code: raw.code,
    title: raw.title ?? raw.code,
    version: raw.version,
    objectiveCodes: raw.objective_codes,
    standardVersion: raw.standard_version,
    studentAction: raw.student_action,
    theory: raw.theory,
    criteria: raw.criteria ?? [],
    completionLimit: raw.completion_limit,
  }
  if (raw.machine === 'bracket_judgement') {
    return { ...base, kind: 'bracket_judgement', machine: 'bracket_judgement', cases: raw.cases ?? [] }
  }
  const machine: TraceMachine =
    raw.machine === 'ring_queue' || raw.machine === 'linked_queue' ? raw.machine : 'stack'
  return {
    ...base,
    kind: 'structured_trace',
    machine,
    capacity: raw.capacity ?? null,
    statuses: raw.statuses ?? ['ok', 'underflow', 'full'],
    stateFields: raw.state_fields ?? [],
    operations: raw.operations ?? [],
  }
}

/** New data-driven activities; the legacy demo activity (no `machine`) is excluded. */
export const STRUCTURED_ACTIVITIES: StructuredActivityPrompt[] = (
  stackExample as { activities: RawActivity[] }
).activities
  .filter(activity => activity.machine !== undefined)
  .map(toPrompt)

const TRACE_ACTIVITIES = STRUCTURED_ACTIVITIES.filter(
  (activity): activity is TraceActivityPrompt => activity.kind === 'structured_trace',
)

export function structuredActivityByVersion(version: string): StructuredActivityPrompt | undefined {
  return STRUCTURED_ACTIVITIES.find(activity => activity.version === version)
}

/**
 * Activities entered through the objective route `/learn/:objectiveCode`.
 * Stack/bracket objectives keep their legacy workspace on that route, so their
 * new variants are only reachable via `/practice/:activityVersion`.
 */
export function structuredActivityForObjective(objectiveCode: string): TraceActivityPrompt | undefined {
  return TRACE_ACTIVITIES.find(
    activity =>
      (activity.machine === 'ring_queue' || activity.machine === 'linked_queue') &&
      activity.objectiveCodes.includes(objectiveCode),
  )
}

export function operationLabel(operation: PromptOperation): string {
  if (operation.kind === 'push') return `push(${operation.value ?? ''})`
  if (operation.kind === 'pop') return 'pop()'
  if (operation.kind === 'enqueue') return `enqueue(${operation.value ?? ''})`
  if (operation.kind === 'dequeue') return 'dequeue()'
  return operation.value === undefined ? operation.kind : `${operation.kind}(${operation.value})`
}

export const traceStatusLabels: Record<TraceStatus, string> = {
  ok: '正常',
  underflow: '空（下溢/空队）',
  full: '满（拒绝入队/入栈）',
}

export function emptyTraceRows(activity: TraceActivityPrompt): TraceRowInput[] {
  return activity.operations.map(() => ({
    state: Object.fromEntries(activity.stateFields.map(field => [field.name, ''])),
    value: '',
    status: '',
  }))
}

export function emptyBracketRows(activity: BracketActivityPrompt): BracketRowInput[] {
  return activity.cases.map(value => ({ case: value, matched: '', mismatchIndex: '' }))
}

export function emptyAttempt(
  activity: StructuredActivityPrompt,
  spaceId: string,
  previous?: StructuredAttempt,
): StructuredAttempt {
  const now = new Date().toISOString()
  // "修改并开始新版本" carries the previous answers forward so the learner only
  // edits what was wrong, mirroring the truth-table workspace's retry behaviour.
  const traceRows = activity.kind === 'structured_trace'
    ? previous?.kind === 'structured_trace' && previous.traceRows.length === activity.operations.length
      ? previous.traceRows.map(row => ({ ...row, state: { ...row.state } }))
      : emptyTraceRows(activity)
    : []
  const bracketRows = activity.kind === 'bracket_judgement'
    ? previous?.kind === 'bracket_judgement' && previous.bracketRows.length === activity.cases.length
      ? previous.bracketRows.map(row => ({ ...row }))
      : emptyBracketRows(activity)
    : []
  return {
    id: crypto.randomUUID(),
    artifactId: previous?.artifactId ?? crypto.randomUUID(),
    spaceId,
    courseCode: 'CS03',
    activityVersion: activity.version,
    objectiveCode: activity.objectiveCodes[0] ?? '',
    kind: activity.kind,
    explanation: previous?.explanation ?? '',
    traceRows,
    bracketRows,
    result: null,
    resultTrust: null,
    createdAt: now,
    updatedAt: now,
  }
}

const INTEGER_PATTERN = /^-?\d+$/

function parseField(format: StateFieldFormat, text: string, label: string): number | (number | null)[] {
  const trimmed = text.trim()
  if (format === 'int') {
    if (!INTEGER_PATTERN.test(trimmed)) throw new Error(`${label}需要填写整数，例如 0、1、2。`)
    return Number(trimmed)
  }
  if (trimmed === '' || trimmed === '[]') return []
  const body = trimmed.replace(/^\[/, '').replace(/\]$/, '')
  const parts = body.split(',').map(part => part.trim())
  return parts.map(part => {
    if (INTEGER_PATTERN.test(part)) return Number(part)
    if (format === 'nullable_int_list' && (part === 'null' || part === '')) return null
    throw new Error(`${label}需要是逗号分隔的整数列表，空槽写 null，例如 [1, null, 2]。`)
  })
}

export function parseTraceSteps(activity: TraceActivityPrompt, rows: TraceRowInput[]): StructuredTraceStep[] {
  if (rows.length !== activity.operations.length) {
    throw new Error(`需要填写全部 ${activity.operations.length} 步，不能留空或增减行数。`)
  }
  return rows.map((row, index) => {
    if (!row.status) throw new Error(`第 ${index + 1} 步还没有选择状态（正常/空/满）。`)
    const state: StructuredTraceStep['state'] = {}
    for (const field of activity.stateFields) {
      state[field.name] = parseField(field.format, row.state[field.name] ?? '', field.label)
    }
    const output = row.value.trim()
    const value = output === '' ? null : (() => {
      if (!INTEGER_PATTERN.test(output)) throw new Error(`第 ${index + 1} 步的输出需要是整数；没有输出请留空。`)
      return Number(output)
    })()
    return { state, value, status: row.status }
  })
}

export function parseBracketJudgements(rows: BracketRowInput[]): BracketJudgement[] {
  return rows.map((row, index) => {
    if (!row.matched) throw new Error(`第 ${index + 1} 组串还没有选择“匹配/不匹配”。`)
    if (row.matched === 'matched') return { case: row.case, matched: true, mismatch_index: null }
    const indexText = row.mismatchIndex.trim()
    if (!INTEGER_PATTERN.test(indexText) || Number(indexText) < 0) {
      throw new Error(`第 ${index + 1} 组串不匹配，需要填写首个问题括号的索引（从 0 开始的非负整数）。`)
    }
    return { case: row.case, matched: false, mismatch_index: Number(indexText) }
  })
}

/** A deterministic result never asserts mastery: full trace => partial, any miss => consolidate. */
export function structuredAttemptState(attempt: StructuredAttempt): ObjectiveState {
  if (!attempt.result || attempt.resultTrust) return 'unknown'
  const missed = attempt.result.criteria.some(criterion => criterion.status === 'not_met')
  return missed ? 'consolidate' : 'partial'
}

const objectiveTitles = new Map(
  (stackExample as { objectives: Array<{ code: string; title: string }> }).objectives.map(objective => [
    objective.code,
    objective.title,
  ]),
)
export function objectiveTitle(code: string): string {
  return objectiveTitles.get(code) ?? code
}

export function nextStructuredActivity(version: string): StructuredActivityPrompt | undefined {
  const index = STRUCTURED_ACTIVITIES.findIndex(activity => activity.version === version)
  return index >= 0 ? STRUCTURED_ACTIVITIES[index + 1] : undefined
}

export const machineTitles: Record<StructuredMachine, string> = {
  stack: '容量受限的顺序栈',
  ring_queue: '循环队列（顺序存储）',
  linked_queue: '链式队列',
  bracket_judgement: '括号匹配判定',
}

export function isTraceResult(result: StructuredResult): result is StructuredTraceResult {
  return 'trace_correct' in result
}

export function structuredResultCorrect(result: StructuredResult): boolean {
  return isTraceResult(result) ? result.trace_correct : result.bracket_correct
}
