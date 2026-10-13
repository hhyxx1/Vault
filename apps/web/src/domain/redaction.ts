const reason = '保密独立输入不公开；仅保留公开判定与汇总。'
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

/** Applied to stored history, sync and exports, including nested review snapshots. */
export function redactHiddenSuites<T>(value: T): T {
  if (Array.isArray(value)) return value.map(item => redactHiddenSuites(item)) as T
  if (!object(value)) return value
  const cleaned = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactHiddenSuites(item)]))
  const suite = cleaned.suite_assessment
  if (object(suite) && Array.isArray(suite.cases)) {
    let ordinal = 0
    suite.cases = suite.cases.map(item => {
      if (!object(item) || item.kind !== 'independent') return item
      return { ...item, stdin: null, expected_stdout: null, observed_stdout: null, case_code: `independent-${++ordinal}`, reason }
    })
    if (ordinal && Array.isArray(suite.criteria)) suite.criteria = suite.criteria.map(item => object(item) ? { ...item, reason } : item)
  }
  return cleaned as T
}
