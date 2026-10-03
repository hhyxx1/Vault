import catalog from '../../../../content/courses/catalog.json'
import stackExample from '../../../../content/courses/CS03.stack-example.json'

export const COURSE_VERSION = stackExample.version
export const TRACE_ACTIVITY = stackExample.activities[0].version
export const STANDARD_VERSION = stackExample.activities[0].standard_version
export const TRACE_OBJECTIVE = stackExample.objectives[0].code
export const IMPLEMENT_OBJECTIVE = stackExample.objectives[1].code

const coursePresentation = [
  ['CS01', '程序设计基础', '从一行代码，到解决一个问题', '基础'],
  ['CS02', '面向对象程序设计', '用对象表达关系与职责', '基础'],
  ['CS03', '数据结构', '让数据以合适的方式组织起来', '基础'],
  ['CS04', '算法设计与分析', '寻找解法，也理解解法的边界', '基础'],
  ['CS05', '离散数学', '用逻辑、关系与证明严谨思考', '理论'],
  ['CS06', '计算机组成原理', '从位与门，走进机器内部', '系统'],
  ['CS07', '操作系统', '理解资源如何协作与竞争', '系统'],
  ['CS08', '计算机网络', '让连接、协议与报文变得可见', '系统'],
  ['CS09', '数据库', '组织数据，守住一致性', '系统'],
  ['CS10', '软件工程', '把想法建设成可维护的软件', '应用'],
  ['CS11', '编译原理', '从语言规则到程序执行', '理论'],
  ['CS12', '人工智能基础', '搜索、表示与推理的起点', '智能'],
  ['CS13', '机器学习基础', '从数据、实验到可靠结论', '智能'],
].map(([code, , description, group]) => ({ code, description, group }))

// The public immutable course package also supports offline browsing. Identity,
// title/version and activity operations share the same source with the API.
export const courses = catalog.courses.map(course => ({
  code: course.code, title: course.title,
  description: coursePresentation.find(item => item.code === course.code)?.description ?? course.scope_note,
  group: coursePresentation.find(item => item.code === course.code)?.group ?? '专业',
}))

export const traceOperations = stackExample.activities[0].operations.map(operation => ({
  kind: operation.kind as 'push' | 'pop', value: operation.value,
  label: operation.kind === 'push' ? `push(${operation.value})` : 'pop()',
}))

export type TraceInput = { stack: string; output: string; underflow: boolean }
export type TracePrediction = { after_stack: number[]; output: number | null; underflow: boolean }
export type CriterionStatus = 'met' | 'not_met' | 'needs_review'
export type ObjectiveState = 'unknown' | 'partial' | 'consolidate' | 'verified'
export type VerificationResult = import('../../../../packages/contracts/api.generated').components['schemas']['VerificationResult']
export type Draft = {
  id: string; spaceId: string; goal: string; goalConfirmed: boolean
  trace: TraceInput[]; explanation: string; code: string; updatedAt: string
}
export type ArtifactRevision = Draft & { artifactId: string; revisionId: string; version: string }
export type HelpEvent = {
  id: string; spaceId: string; objectiveId: string; kind: 'hint' | 'answer'
  disclosureVersion: string; createdAt: string
}
export type EvidenceRecord = {
  id: string; spaceId: string; objectiveId: string; revisionId: string
  revisionVersion: string; submittedAt: string
  submittedWork: { trace: TracePrediction[]; explanation: string }
  createdAt: string; result: VerificationResult; helpEventIds: string[]
}
export type TeacherDraft = { id: string; spaceId: string; title: string; outline: string; studentVisible: false; updatedAt: string }

export function newDraft(id: string, spaceId: string): Draft {
  return {
    id, spaceId, goal: id === TRACE_OBJECTIVE ? '逐步推演栈的状态，解释后进先出，并处理空栈出栈。' : '实现限定括号输入的匹配方法，并解释边界情况。',
    goalConfirmed: false, trace: traceOperations.map(() => ({ stack: '', output: '', underflow: false })),
    explanation: '', code: 'def brackets_match(text: str) -> bool:\n    # 请从限定输入与空输入开始，写下自己的实现。\n    pass\n', updatedAt: new Date().toISOString(),
  }
}

export function parseTrace(rows: TraceInput[]): TracePrediction[] {
  if (rows.length !== traceOperations.length) throw new Error('请保留完整的七步推演。')
  return rows.map((row, index) => {
    if (!row.stack.trim()) throw new Error(`第 ${index + 1} 步：请填写栈内容；空栈填 []。`)
    let stack: unknown
    try { stack = JSON.parse(row.stack) } catch { throw new Error(`第 ${index + 1} 步：栈内容请使用 [8, 3] 这样的数组格式。`) }
    if (!Array.isArray(stack) || stack.length > 16 || stack.some(value => !Number.isSafeInteger(value) || Math.abs(value) > 1000000)) throw new Error(`第 ${index + 1} 步：栈最多16项，元素应为 -1000000 到 1000000 的整数。`)
    const output = row.output.trim()
    if (output && output !== 'null' && !/^-?\d+$/.test(output)) throw new Error(`第 ${index + 1} 步：输出填整数，无输出可留空。`)
    const value = output && output !== 'null' ? Number(output) : null
    if (value !== null && (!Number.isSafeInteger(value) || Math.abs(value) > 1000000)) throw new Error(`第 ${index + 1} 步：输出应为 -1000000 到 1000000 的整数。`)
    return { after_stack: stack as number[], output: value, underflow: row.underflow }
  })
}

export function evidenceState(result?: VerificationResult): ObjectiveState {
  if (!result) return 'unknown'
  if (result.criteria.some(c => c.status === 'not_met')) return 'consolidate'
  // This engineering checker explicitly does not assert mastery. Human review and
  // independent transfer must be implemented before the verified state can exist.
  return 'partial'
}

export function currentTraceEvidence(records: EvidenceRecord[]): EvidenceRecord | undefined {
  return records.filter(record => record.objectiveId === TRACE_OBJECTIVE && record.result.course_version === COURSE_VERSION && record.result.activity_version === TRACE_ACTIVITY && record.result.standard_version === STANDARD_VERSION)
    .sort((a, b) => BigInt(a.revisionVersion) < BigInt(b.revisionVersion) ? -1 : BigInt(a.revisionVersion) > BigInt(b.revisionVersion) ? 1 : a.submittedAt.localeCompare(b.submittedAt)).at(-1)
}

export function evidenceMatchesDraft(record: EvidenceRecord, draft: Draft): boolean {
  try { return JSON.stringify({ trace: parseTrace(draft.trace), explanation: draft.explanation }) === JSON.stringify(record.submittedWork) } catch { return false }
}

export function objectiveSummary(records: EvidenceRecord[]): { total: number; verified: number; partial: number; consolidate: number; unknown: number } {
  const state = evidenceState(currentTraceEvidence(records)?.result)
  return { total: 2, verified: state === 'verified' ? 1 : 0, partial: state === 'partial' ? 1 : 0, consolidate: state === 'consolidate' ? 1 : 0, unknown: state === 'unknown' ? 2 : 1 }
}

export const stateLabels: Record<ObjectiveState, string> = { unknown: '尚未有效评估', partial: '部分条件满足', consolidate: '有条件需要巩固', verified: '有达标证据' }
export const criterionLabels: Record<string, string> = { state_trace: '逐步状态与输出', boundary_condition: '空栈边界处理', explanation: '原理解释', independent_transfer: '独立新条件应用' }
