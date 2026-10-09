import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLocal } from '../local/LocalProvider'
import { useAuth } from '../local/AuthProvider'
import { database, saveStructuredAttempt } from '../local/database'
import { registerIdentityFlusher } from '../local/identity'
import { verifyBracketJudgements, verifyStructuredTrace } from '../api/verification'
import {
  emptyAttempt,
  isTraceResult,
  machineTitles,
  nextStructuredActivity,
  objectiveTitle,
  operationLabel,
  parseBracketJudgements,
  parseTraceSteps,
  structuredActivityByVersion,
  structuredActivityForObjective,
  traceStatusLabels,
  type BracketRowInput,
  type StructuredActivityPrompt,
  type StructuredAttempt,
  type TraceActivityPrompt,
  type TraceRowInput,
} from '../domain/structured'

function fieldFormatHint(activity: TraceActivityPrompt): string {
  if (activity.machine === 'ring_queue') {
    return '物理数组按槽位填写、空槽写 null，例如 [1, null, 2]；head、tail、size 填整数；出队值没有则留空。'
  }
  if (activity.machine === 'linked_queue') {
    return '按队头到队尾填写逻辑内容，例如 [1, 2]，空队列填 []；出队值没有则留空。'
  }
  return '栈按栈底在左、栈顶在右填写数组，例如 [4, 9]，空栈填 []；弹出值没有则留空。'
}

export default function StructuredWorkspace() {
  const { objectiveId, activityVersion: routeVersion } = useParams()
  const activity: StructuredActivityPrompt | undefined = routeVersion
    ? structuredActivityByVersion(routeVersion)
    : objectiveId
      ? structuredActivityForObjective(objectiveId)
      : undefined
  const { spaceId, structuredAttempts, refresh } = useLocal()
  const { account, epoch } = useAuth()
  const [attempt, setAttempt] = useState<StructuredAttempt | null>(null)
  const [busy, setBusy] = useState(false)
  const [saveState, setSaveState] = useState<'loading' | 'saved' | 'saving' | 'failed'>('loading')
  const [message, setMessage] = useState('')
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const context = `${spaceId}:${epoch}:${activity?.version ?? ''}`
  const currentContext = useRef(context)
  currentContext.current = context
  const mounted = useRef(false)
  const request = useRef<AbortController | null>(null)
  const saveError = useRef<unknown>(null)

  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => registerIdentityFlusher(async () => {
    request.current?.abort()
    await queue.current
    if (saveError.current) throw saveError.current
  }), [])
  const isCurrent = () => mounted.current && currentContext.current === context

  useEffect(() => {
    request.current?.abort()
    request.current = null
    setAttempt(null); setSaveState('loading'); setMessage(''); setBusy(false)
    if (!spaceId || !activity) return
    let cancelled = false
    database.structuredAttempts.where('spaceId').equals(spaceId).toArray().then(records => {
      const recent = records
        .filter(record => record.activityVersion === activity.version)
        .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)).at(-1)
      const selected = recent ?? emptyAttempt(activity, spaceId)
      if (!cancelled && isCurrent()) { setAttempt(selected); setSaveState('saved') }
    }).catch(() => { if (!cancelled) setSaveState('failed') })
    return () => { cancelled = true; request.current?.abort() }
  }, [spaceId, activity?.version, epoch])

  function queueSave(value: StructuredAttempt) {
    setSaveState('saving')
    queue.current = queue.current.catch(() => undefined).then(() => saveStructuredAttempt(value))
      .then(() => { saveError.current = null; if (isCurrent()) setSaveState('saved') })
      .catch(error => { saveError.current = error; if (isCurrent()) { setSaveState('failed'); setMessage('本地保存失败。请勿关闭页面，检查浏览器存储权限后重试。') } })
  }

  function edit(next: Partial<StructuredAttempt>) {
    if (!attempt || attempt.submittedAt || busy) return
    const value = { ...attempt, ...next, updatedAt: new Date().toISOString() }
    setAttempt(value); queueSave(value)
  }

  async function beginAgain() {
    if (!attempt || !activity || busy) return
    try {
      await queue.current
      if (!isCurrent()) return
      const next = emptyAttempt(activity, spaceId, attempt)
      await saveStructuredAttempt(next)
      if (!isCurrent()) return
      setAttempt(next); setSaveState('saved'); setMessage('新作品已建立。请修改后再次核验。')
      await refresh()
    } catch { if (isCurrent()) setMessage('创建新作品失败；上一版仍保留在本机。') }
  }

  async function verify() {
    if (!attempt || !activity || busy) return
    try {
      if (activity.kind === 'structured_trace') parseTraceSteps(activity, attempt.traceRows)
      else parseBracketJudgements(attempt.bracketRows)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '请填完本次活动再提交。')
      return
    }
    if (!attempt.explanation.trim()) { setMessage('请先写下你的解释，再提交核验。'); return }
    const frozen = attempt.submittedAt ? attempt : { ...attempt, submittedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    const controller = new AbortController(); request.current = controller
    setBusy(true); setMessage('正在逐格核对，本机作品会先保存。')
    try {
      await queue.current
      if (!isCurrent() || controller.signal.aborted) return
      if (!attempt.submittedAt) { await saveStructuredAttempt(frozen); if (isCurrent()) setAttempt(frozen) }
      if (!isCurrent() || controller.signal.aborted) return
      const outcome = activity.kind === 'structured_trace'
        ? await verifyStructuredTrace(activity, frozen, parseTraceSteps(activity, frozen.traceRows), controller.signal)
        : await verifyBracketJudgements(activity, frozen, parseBracketJudgements(frozen.bracketRows), controller.signal)
      if (!isCurrent() || controller.signal.aborted) return
      const completed = { ...frozen, result: outcome.result, updatedAt: new Date().toISOString() }
      await saveStructuredAttempt(completed)
      if (!isCurrent() || controller.signal.aborted) return
      setAttempt(completed); setSaveState('saved'); await refresh()
      const ackFailed = await outcome.acknowledge().then(() => false).catch(() => true)
      if (!isCurrent()) return
      setMessage(ackFailed ? '核验已保存在本机；服务端临时结果将在租约过期后清理。' : '逐格核验已保存。解释与独立迁移仍待复核。')
    } catch (error) {
      if (isCurrent()) setMessage(error instanceof Error ? error.message : '核验未完成，作品保留在本机。')
    } finally {
      if (isCurrent()) { setBusy(false); request.current = null }
    }
  }

  if (!activity) {
    return <div className="page"><h1>这个实践活动还在建设</h1><p>课程包声明了目标，但没有找到对应的可核验活动。</p><Link className="button primary" to="/atlas?course=CS03">返回数据结构图谱</Link></div>
  }
  if (!attempt) {
    return <div className="page page-loading" role="status">{saveState === 'failed' ? '本地作品无法打开，请检查浏览器存储权限。' : '正在恢复活动作品…'}</div>
  }

  const frozen = !!attempt.submittedAt
  const result = attempt.result
  const traceResult = result && isTraceResult(result) ? result : null
  const bracketResult = result && !isTraceResult(result) ? result : null
  const correct = result ? (isTraceResult(result) ? result.trace_correct : result.bracket_correct) : null
  const total = activity.kind === 'structured_trace' ? activity.operations.length : activity.cases.length
  const correctCount = traceResult
    ? traceResult.rows.filter(row => row.correct).length
    : bracketResult
      ? bracketResult.rows.filter(row => row.correct).length
      : null
  const history = structuredAttempts
    .filter(record => record.activityVersion === activity.version && record.id !== attempt.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const next = nextStructuredActivity(activity.version)
  const traceFeedbackAt = (index: number) => traceResult?.rows.find(row => row.index === index + 1)
  const bracketFeedbackAt = (index: number) => bracketResult?.rows[index]

  const editTraceState = (index: number, fieldName: string, value: string) => edit({
    traceRows: attempt.traceRows.map((row, position) =>
      position === index ? { ...row, state: { ...row.state, [fieldName]: value } } : row),
  })
  const editTraceValue = (index: number, value: string) => edit({
    traceRows: attempt.traceRows.map((row, position) => (position === index ? { ...row, value } : row)),
  })
  const editTraceStatus = (index: number, status: string) => edit({
    traceRows: attempt.traceRows.map((row, position) =>
      position === index ? { ...row, status: status as TraceRowInput['status'] } : row),
  })
  const editBracket = (index: number, patch: Partial<BracketRowInput>) => edit({
    bracketRows: attempt.bracketRows.map((row, position) => (position === index ? { ...row, ...patch } : row)),
  })

  return <div className="page logic-page structured-page">
    <div className="workspace-top">
      <div>
        <Link className="breadcrumb" to="/atlas?course=CS03">数据结构 / {objectiveTitle(attempt.objectiveCode)} ↗</Link>
        <h1>{machineTitles[activity.machine]}</h1>
      </div>
      <div className={`save-state ${saveState}`} role="status"><span className="status-dot" />{saveState === 'saved' ? '本地已保存' : saveState === 'saving' ? '正在本地保存' : saveState === 'failed' ? '本地保存失败' : '正在恢复'}</div>
    </div>
    <div className="workspace-meta">
      <span className="small-tag">局部工程样例 · 内容待审校</span>
      <span>{account ? '账号空间 · 本机先保存' : '未登录 · 仅保存在本设备'}</span>
      <span>{activity.code}</span>
    </div>
    <div className="logic-intro">
      <div>
        <span className="eyebrow">QUESTION / PRACTICE</span>
        <h2>{objectiveTitle(attempt.objectiveCode)}</h2>
        <p>{activity.studentAction}</p>
      </div>
      <div className="logic-progress">
        <strong>{correctCount === null ? '—' : correctCount}<span> / {total}</span></strong>
        <small>{result ? '本版逐行一致数' : '等待本版实际核验'}</small>
      </div>
    </div>
    <div className="logic-layout">
      <section className="logic-practice">
        <div className="panel-heading">
          <div><span className="eyebrow">01 / YOUR PREDICTION</span><h2>亲自填写每一步</h2></div>
          <span className="step-count">{total} STEPS</span>
        </div>
        {activity.kind === 'structured_trace' ? <>
          <p className="practice-intro">{fieldFormatHint(activity)} 失败的操作不改变状态，也要照实填写状态那一格。</p>
          <div className="logic-table-wrap structured-table-wrap">
            <table className={`logic-table structured-table${activity.stateFields.length >= 3 ? ' structured-table-wide' : ''}`}>
              <thead>
                <tr>
                  <th scope="col">步 / 操作</th>
                  {activity.stateFields.map(field => <th scope="col" key={field.name}>{field.label}</th>)}
                  <th scope="col">输出值</th>
                  <th scope="col">状态</th>
                </tr>
              </thead>
              <tbody>
                {activity.operations.map((operation, index) => {
                  const row = attempt.traceRows[index]
                  const feedback = traceFeedbackAt(index)
                  const wrong = !!feedback && feedback.issues.length > 0
                  return <tr key={index} className={wrong ? 'structured-row-wrong' : ''}>
                    <th scope="row"><span>{String(index + 1).padStart(2, '0')}</span><small><code>{operationLabel(operation)}</code></small></th>
                    {activity.stateFields.map(field => <td key={field.name} data-label={field.label} className={wrong ? 'logic-wrong' : ''}>
                      <input aria-label={`第${index + 1}步${field.label}`} value={row?.state[field.name] ?? ''} disabled={frozen} placeholder={field.format === 'int' ? '整数' : '如 [1, 2]'} onChange={event => editTraceState(index, field.name, event.target.value)} />
                    </td>)}
                    <td data-label="输出值" className={wrong ? 'logic-wrong' : ''}>
                      <input aria-label={`第${index + 1}步输出值`} value={row?.value ?? ''} disabled={frozen} placeholder="无输出留空" onChange={event => editTraceValue(index, event.target.value)} />
                    </td>
                    <td data-label="状态" className={wrong ? 'logic-wrong' : ''}>
                      <select aria-label={`第${index + 1}步状态`} value={row?.status ?? ''} disabled={frozen} onChange={event => editTraceStatus(index, event.target.value)}>
                        <option value="">待选择</option>
                        {activity.statuses.map(status => <option key={status} value={status}>{traceStatusLabels[status]}</option>)}
                      </select>
                      {feedback?.issues.map(issue => <small key={issue}>{issue}</small>)}
                    </td>
                  </tr>
                })}
              </tbody>
            </table>
          </div>
        </> : <>
          <p className="practice-intro">限定为英文小括号、中括号、大括号，空串视为匹配，索引从 0 开始。对每一组串判断是否匹配；不匹配时定位首个问题括号。</p>
          <div className="logic-table-wrap">
            <table className="logic-table bracket-table">
              <thead>
                <tr><th scope="col">序号</th><th scope="col">括号串</th><th scope="col">是否匹配</th><th scope="col">首个问题括号索引</th></tr>
              </thead>
              <tbody>
                {activity.cases.map((caseValue, index) => {
                  const row = attempt.bracketRows[index]
                  const feedback = bracketFeedbackAt(index)
                  const wrong = !!feedback && !feedback.correct
                  return <tr key={index} className={wrong ? 'structured-row-wrong' : ''}>
                    <th scope="row"><span>{String(index + 1).padStart(2, '0')}</span></th>
                    <td data-label="括号串"><code>{caseValue === '' ? '（空串）' : caseValue}</code></td>
                    <td data-label="是否匹配" className={wrong ? 'logic-wrong' : ''}>
                      <select aria-label={`第${index + 1}组串是否匹配`} value={row?.matched ?? ''} disabled={frozen} onChange={event => editBracket(index, { matched: event.target.value as BracketRowInput['matched'], mismatchIndex: event.target.value === 'mismatch' ? (row?.mismatchIndex ?? '') : '' })}>
                        <option value="">待判定</option>
                        <option value="matched">匹配</option>
                        <option value="mismatch">不匹配</option>
                      </select>
                    </td>
                    <td data-label="首个问题括号索引" className={wrong ? 'logic-wrong' : ''}>
                      <input aria-label={`第${index + 1}组串首个问题括号索引`} value={row?.mismatchIndex ?? ''} disabled={frozen || row?.matched !== 'mismatch'} placeholder="如 0、2" onChange={event => editBracket(index, { mismatchIndex: event.target.value })} />
                      {wrong && feedback && <small>正确索引：{feedback.index}；{feedback.issues.join('；')}</small>}
                    </td>
                  </tr>
                })}
              </tbody>
            </table>
          </div>
        </>}
        <label className="logic-explanation" htmlFor="structured-explanation">把你的解释留下来<span>说明你判断状态与边界的理由；解释会与作品一起等待人工复核。</span></label>
        <textarea id="structured-explanation" rows={5} maxLength={4000} value={attempt.explanation} disabled={frozen} onChange={event => edit({ explanation: event.target.value })} placeholder={activity.kind === 'structured_trace' ? '每一步为什么是这个状态和输出？失败的操作为什么不改变状态？' : '闭括号应匹配什么？失配和残留分别如何定位第一个问题括号？'} />
        <div className="practice-actions">
          {!result && <button className="button primary" disabled={busy || saveState === 'failed'} onClick={verify}>{busy ? '逐格核对中…' : frozen ? '重试同一版核验' : '保存并核验这一版'} ↗</button>}
          {frozen && <button className="button secondary" disabled={busy} onClick={beginAgain}>修改并开始新版本</button>}
          <button className="text-link" onClick={() => { const blob = new Blob([JSON.stringify(attempt, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${activity.code}.json`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000) }}>导出本版作品 ↓</button>
        </div>
        {message && <p className="logic-message" role="status">{message}</p>}
      </section>
      <aside className="logic-theory">
        <div className="panel-heading"><div><span className="eyebrow">02 / REASON</span><h2>必要原理</h2></div><span className="mini-orbit" aria-hidden="true">◌</span></div>
        {activity.theory.map((point, index) => <div className="logic-rule" key={index}><span>{String(index + 1).padStart(2, '0')}</span><div><p>{point}</p></div></div>)}
        <h3>本次核验的条件</h3>
        <ul className="structured-criteria">
          {activity.criteria.map(criterion => <li key={criterion.id}><strong>{criterion.title}</strong></li>)}
          <li>你的解释与独立迁移：始终等待人工复核，不自动宣称掌握。</li>
        </ul>
        <p className="field-note">{activity.completionLimit}</p>
      </aside>
    </div>
    <section className="logic-results">
      <div className="section-heading">
        <div><span className="eyebrow">03 / REFLECT & RETRY</span><h2>核对结果与下一步</h2></div>
        <Link className="text-link" to="/atlas?course=CS03">回到知识图谱 →</Link>
      </div>
      {result && correct !== null ? <>
        <div className={`result-summary ${correct ? 'partial' : 'consolidate'}`}>
          <strong>{correct ? '逐格核验通过，完整目标仍待复核。' : '有条件需要修正。'}</strong>
          <p>{result.summary}</p>
          {attempt.resultTrust && <p>这是从账号同步恢复的客户端报告，需要重新核验来源。</p>}
        </div>
        <div className="criterion-results">
          {result.criteria.map(criterion => <div className="criterion-row" key={criterion.id}>
            <span className={`criterion-icon ${criterion.status}`}>{criterion.status === 'met' ? '✓' : criterion.status === 'not_met' ? '↻' : '◌'}</span>
            <div><strong>{criterion.title}</strong><p>{criterion.reason}</p></div>
            <span>{criterion.status === 'met' ? '满足' : criterion.status === 'not_met' ? '未满足' : '待人工复核'}</span>
          </div>)}
        </div>
        <div className="next-action">
          {correct && next ? <p>下一步：进入教学顺序中的下一个活动。解释与独立迁移仍待人工复核。</p> : <p>下一步：回到不一致的步骤修改后重新核验。</p>}
          {correct && next && <Link className="button primary" to={`/practice/${next.version}`}>下一个活动：{machineTitles[next.machine]} →</Link>}
          {correct && !next && <Link className="button primary" to="/atlas?course=CS03">回到数据结构图谱 →</Link>}
        </div>
      </> : <div className="result-empty"><span aria-hidden="true">◌</span><div><strong>这里等待你提交的实际作品。</strong><p>核对之前不会替你填写或推断掌握状态。</p></div></div>}
    </section>
    {history.length > 0 && <section className="logic-history">
      <div className="section-heading"><div><span className="eyebrow">VERSION HISTORY</span><h2>过去的尝试</h2></div><small>{history.length} 个本地版本</small></div>
      {history.slice(0, 12).map(record => {
        const recordCorrect = record.result ? (isTraceResult(record.result) ? record.result.trace_correct : record.result.bracket_correct) : null
        return <button key={record.id} onClick={() => { request.current?.abort(); setAttempt(record); setMessage('已打开历史版本。可从这里新建修改版。') }}>
          <time>{new Date(record.createdAt).toLocaleString('zh-CN')}</time>
          <span>{recordCorrect === null ? '尚未完成核验' : recordCorrect ? '逐格一致 · 待审阅' : '存在不一致'}</span>
          <span>{record.resultTrust ? '账号恢复报告' : '本机记录'}</span>
        </button>
      })}
    </section>}
  </div>
}
