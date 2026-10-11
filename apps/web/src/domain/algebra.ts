import type { components } from '../../../../packages/contracts/api.generated'

export type AlgebraMode = 'group' | 'ring' | 'homomorphism'
export type AlgebraPrediction = '' | 'true' | 'false' | 'unchecked'
export type AlgebraPrompt = { mode: AlgebraMode; table: number[][]; second_table?: number[][] | null; mapping?: number[] | null }
export type AlgebraContext = { objectiveCode: string; courseCode: string; courseVersionId: string; activityVersionId: string; activityVersion: string }
export type AlgebraResult = components['schemas']['AlgebraVerificationResult']
export type AlgebraAttempt = AlgebraContext & {
  id: string; artifactId: string; spaceId: string; mode: AlgebraMode
  table: string[][]; secondTable: string[][] | null; mapping: string[] | null
  predictions: Record<string, AlgebraPrediction>; explanation: string
  result: AlgebraResult | null; resultTrust: 'client_reported' | null
  createdAt: string; updatedAt: string; submittedAt?: string
}

export const ALGEBRA_PREDICTIONS: Record<AlgebraMode, string[]> = {
  group: ['closed', 'associative', 'is_group'],
  ring: ['ring', 'unital_ring', 'field'],
  homomorphism: ['preserves_operation', 'injective', 'surjective', 'is_group_isomorphism'],
}
export const ALGEBRA_LABELS: Record<string, string> = {
  closed: '运算封闭', associative: '满足结合律', is_group: '构成群',
  ring: '构成环', unital_ring: '是有单位元的环', field: '构成域',
  preserves_operation: '保持指定运算', injective: '是单射', surjective: '是满射', is_group_isomorphism: '是群同构',
}

export function newAlgebraAttempt(spaceId: string, context: AlgebraContext, prompt: AlgebraPrompt): AlgebraAttempt {
  const stamp = new Date().toISOString()
  return {
    ...context, id: crypto.randomUUID(), artifactId: crypto.randomUUID(), spaceId, mode: prompt.mode,
    table: prompt.table.map(row => row.map(String)),
    secondTable: prompt.second_table?.map(row => row.map(String)) ?? null,
    mapping: prompt.mapping?.map(String) ?? null,
    predictions: Object.fromEntries(ALGEBRA_PREDICTIONS[prompt.mode].map(key => [key, ''])),
    explanation: '', result: null, resultTrust: null, createdAt: stamp, updatedAt: stamp,
  }
}

export function retryAlgebraAttempt(previous: AlgebraAttempt): AlgebraAttempt {
  const next = structuredClone(previous)
  const stamp = new Date().toISOString()
  next.id = crypto.randomUUID(); next.createdAt = stamp; next.updatedAt = stamp
  next.result = null; next.resultTrust = null; delete next.submittedAt
  return next
}

export function currentAlgebraAttempt(records: AlgebraAttempt[], objective: string, versionId: string, activityId: string): AlgebraAttempt | undefined {
  return records.filter(record => {
    const result = record.result
    return record.objectiveCode === objective && record.courseVersionId === versionId && record.activityVersionId === activityId && !!record.submittedAt && !record.resultTrust && !!result && result.client_artifact_id === record.artifactId && result.client_revision_id === record.id && result.course_version_id === versionId && result.activity_version_id === activityId && result.activity_version === record.activityVersion && result.course_code === record.courseCode && result.standard_version === 'finite-algebra-exhaustive-v1' && result.checker_version === 'finite-algebra-exhaustive-v1' && result.provenance === 'server_deterministic_checker' && result.mastery_asserted === false
  }).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)).at(-1)
}

function integer(value: string): number {
  if (!/^-?\d+$/.test(value.trim())) throw new Error('请填写完整整数标签，不能留空或使用小数。')
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || Math.abs(parsed) > 1_000_000) throw new Error('整数标签超过实验限制。')
  return parsed
}

function table(rows: string[][]): number[][] {
  if (rows.length < 1 || rows.length > 12 || rows.some(row => row.length !== rows.length)) throw new Error('请填写完整的方形运算表。')
  return rows.map(row => row.map(integer))
}

export function algebraSubmission(attempt: AlgebraAttempt): components['schemas']['AlgebraSubmission'] {
  const keys = ALGEBRA_PREDICTIONS[attempt.mode]
  if (Object.keys(attempt.predictions).length !== keys.length || keys.some(key => !['true', 'false', 'unchecked'].includes(attempt.predictions[key]))) throw new Error('请先填写每项性质预测。')
  const first = table(attempt.table)
  const second = attempt.secondTable ? table(attempt.secondTable) : null
  const mapping = attempt.mapping?.map(integer) ?? null
  if (attempt.mode === 'group' && (second || mapping)) throw new Error('群实验只使用一个运算表。')
  if (attempt.mode !== 'group' && !second) throw new Error('请填写第二个完整运算表。')
  if (attempt.mode === 'ring' && (second?.length !== first.length || mapping)) throw new Error('环的两个运算表必须使用同一标签集合。')
  if (attempt.mode === 'homomorphism' && (!mapping || mapping.length !== first.length || mapping.some(value => value < 0 || value >= second!.length))) throw new Error('映射须覆盖源集合，且每个结果在目标集合内。')
  if (attempt.explanation.length > 4000) throw new Error('解释最多 4000 字符。')
  return {
    kind: 'verify_finite_algebra', course_version_id: attempt.courseVersionId,
    activity_version_id: attempt.activityVersionId, objective_code: attempt.objectiveCode,
    client_artifact_id: attempt.artifactId, client_revision_id: attempt.id,
    mode: attempt.mode, table: first, second_table: second, mapping,
    predictions: Object.fromEntries(keys.map(key => [key, attempt.predictions[key] === 'unchecked' ? null : attempt.predictions[key] === 'true'])),
    explanation: attempt.explanation,
  }
}
