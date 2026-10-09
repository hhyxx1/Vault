import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import logicExample from '../../../../content/courses/CS05.logic-example.json'
import { verifyTruthTable } from '../api/verification'
import { completeLogicRows, LOGIC_OBJECTIVE, logicAssignments, newLogicAttempt, type CourseAttempt, type TruthCell } from '../domain/logic'
import { recordHelp, database, saveCourseAttempt } from '../local/database'
import { useLocal } from '../local/LocalProvider'
import { useAuth } from '../local/AuthProvider'

const columns = [
  { key: 'implication', title: 'P → Q', name: '蕴含' },
  { key: 'contrapositive', title: '¬Q → ¬P', name: '逆否' },
  { key: 'biconditional', title: 'P ↔ Q', name: '双条件' },
] as const
const expected = logicAssignments.map(({ p, q }) => ({ implication: !p || q, contrapositive: q || !p, biconditional: p === q }))
const boolLabel = (value: boolean) => value ? '真' : '假'

export default function LogicWorkspace() {
  const { objectiveId } = useParams()
  const { spaceId, courseAttempts, help, refresh } = useLocal()
  const { account } = useAuth()
  const [attempt, setAttempt] = useState<CourseAttempt | null>(null)
  const [busy, setBusy] = useState(false)
  const [saveState, setSaveState] = useState<'loading' | 'saved' | 'saving' | 'failed'>('loading')
  const [message, setMessage] = useState('')
  const [answerOpen, setAnswerOpen] = useState(false)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const currentSpace = useRef(spaceId)
  const request = useRef<AbortController | null>(null)

  useEffect(() => {
    currentSpace.current = spaceId
    request.current?.abort()
    request.current = null
    setAttempt(null); setSaveState('loading'); setMessage(''); setAnswerOpen(false)
    if (!spaceId || objectiveId !== LOGIC_OBJECTIVE) return
    let cancelled = false
    database.courseAttempts.where('spaceId').equals(spaceId).toArray().then(records => {
      const recent = records.filter(record => record.objectiveId === LOGIC_OBJECTIVE).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)).at(-1)
      const selected = recent ?? newLogicAttempt(spaceId)
      if (!cancelled && currentSpace.current === spaceId) { setAttempt(selected); setSaveState('saved') }
    }).catch(() => { if (!cancelled) setSaveState('failed') })
    return () => { cancelled = true; request.current?.abort() }
  }, [spaceId, objectiveId])

  function queueSave(value: CourseAttempt) {
    setSaveState('saving')
    queue.current = queue.current.catch(() => undefined).then(() => saveCourseAttempt(value))
      .then(() => { if (currentSpace.current === value.spaceId) setSaveState('saved') })
      .catch(() => { if (currentSpace.current === value.spaceId) { setSaveState('failed'); setMessage('本地保存失败。请勿关闭页面，检查浏览器存储权限后重试。') } })
  }

  function edit(next: Partial<CourseAttempt>) {
    if (!attempt || attempt.submittedAt || busy) return
    const value = { ...attempt, ...next, updatedAt: new Date().toISOString() }
    setAttempt(value); queueSave(value)
  }

  async function beginAgain() {
    if (!attempt || busy) return
    try {
      await queue.current
      const next = newLogicAttempt(spaceId, attempt)
      await saveCourseAttempt(next)
      setAttempt(next); setSaveState('saved'); setMessage('新作品已建立。保留上一版填写内容，请修改后再次核验。')
      await refresh()
    } catch { setMessage('创建新作品失败；上一版仍保留在本机。') }
  }

  async function revealAnswer() {
    if (answerOpen) { setAnswerOpen(false); return }
    try {
      await recordHelp({ id: crypto.randomUUID(), spaceId, objectiveId: LOGIC_OBJECTIVE, kind: 'answer', disclosureVersion: 'CS05-LOGIC-01@0.1.0', createdAt: new Date().toISOString() })
      setAnswerOpen(true)
      await refresh()
    } catch { setMessage('参考答案查看记录尚未保存，请检查本地存储后重试。') }
  }

  async function verify() {
    if (!attempt || busy) return
    try { completeLogicRows(attempt.rows) } catch (error) { setMessage(error instanceof Error ? error.message : '请填完真值表。'); return }
    if (!attempt.explanation.trim()) { setMessage('请先写下你找到的反例以及逆否关系。'); return }
    const frozen = attempt.submittedAt ? attempt : { ...attempt, submittedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    const controller = new AbortController(); request.current = controller
    setBusy(true); setMessage('正在逐格核对，本机作品会先保存。')
    try {
      await queue.current
      if (!attempt.submittedAt) { await saveCourseAttempt(frozen); setAttempt(frozen) }
      const { result, acknowledge } = await verifyTruthTable(frozen, controller.signal)
      if (currentSpace.current !== frozen.spaceId || controller.signal.aborted) return
      const completed = { ...frozen, result, updatedAt: new Date().toISOString() }
      await saveCourseAttempt(completed)
      setAttempt(completed); setSaveState('saved'); await refresh()
      const ackFailed = await acknowledge().then(() => false).catch(() => true)
      setMessage(ackFailed ? '核验已保存在本机；服务端临时结果将在租约过期后清理。' : '逐格核验已保存在本机。解释与独立迁移仍待复核。')
    } catch (error) {
      if (currentSpace.current === frozen.spaceId) setMessage(error instanceof Error ? error.message : '核验未完成，作品保留在本机。')
    } finally { if (currentSpace.current === frozen.spaceId) setBusy(false); request.current = null }
  }

  if (objectiveId !== LOGIC_OBJECTIVE) return <div className="page"><h1>这个目标的实践活动还在建设</h1><p>课程包声明了目标，但目前没有可核验的学生作品活动。</p><Link to="/atlas?course=CS05">返回离散数学图谱</Link></div>
  if (!attempt) return <div className="page page-loading" role="status">{saveState === 'failed' ? '本地作品无法打开，请检查浏览器存储权限。' : '正在恢复真值表作品…'}</div>
  const history = courseAttempts.filter(record => record.objectiveId === LOGIC_OBJECTIVE && record.id !== attempt.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const result = attempt.result
  const answered = help.filter(event => event.objectiveId === LOGIC_OBJECTIVE && event.kind === 'answer').length
  return <div className="page logic-page">
    <div className="workspace-top"><div><Link className="breadcrumb" to="/atlas?course=CS05">离散数学 / 命题逻辑 ↗</Link><h1>用四组赋值，拆开一句“如果”。</h1></div><div className={`save-state ${saveState}`} role="status"><span className="status-dot"/>{saveState === 'saved' ? '本地已保存' : saveState === 'saving' ? '正在本地保存' : saveState === 'failed' ? '本地保存失败' : '正在恢复'}</div></div>
    <div className="workspace-meta"><span className="small-tag">局部工程样例 · 内容待审校</span><span>{account ? '账号空间 · 本机先保存并同步' : '未登录 · 仅保存在本设备'}</span><span>目标 1 / 2 · 不代表整门课进度</span></div>
    <div className="logic-intro"><div><span className="eyebrow">QUESTION / 01</span><h2>“P 蕴含 Q”什么时候会失败？</h2><p>先预测三种命题的每一格真值，再解释一组反例。服务端只核对固定四行；你的推理和新情境应用仍需要独立审阅。</p></div><div className="logic-progress"><strong>{result ? result.rows.filter(row => row.correct).length : '—'}<span> / 4</span></strong><small>{result ? '本版逐行一致' : '等待本版实际核验'}</small></div></div>
    <div className="logic-layout"><section className="logic-practice"><div className="panel-heading"><div><span className="eyebrow">01 / PREDICT</span><h2>填入你自己的判断</h2></div><span className="step-count">4 ASSIGNMENTS</span></div><p className="practice-intro">P、Q 的四种赋值已固定。每个空格都要明确选择“真”或“假”；留空不能提交。先尝试，必要时回看右侧定义。</p>
      <div className="logic-table-wrap"><table className="logic-table"><thead><tr><th scope="col">赋值</th>{columns.map(column => <th scope="col" key={column.key}><span>{column.title}</span><small>{column.name}</small></th>)}</tr></thead><tbody>{logicAssignments.map(({ p, q }, index) => <tr key={`${p}-${q}`}><th scope="row"><span>{String(index + 1).padStart(2, '0')}</span><small>P = {boolLabel(p)}<br/>Q = {boolLabel(q)}</small></th>{columns.map(column => { const value = attempt.rows[index][column.key]; const wrong = result?.rows[index].issues.includes(column.key); return <td key={column.key} data-label={column.title} className={wrong ? 'logic-wrong' : result && value !== null ? 'logic-right' : ''}><select aria-label={`第${index + 1}行${column.name}的真值`} value={value === null ? '' : String(value)} disabled={!!attempt.submittedAt} onChange={event => { const rows = attempt.rows.map((row, position) => position === index ? { ...row, [column.key]: event.target.value === '' ? null : event.target.value === 'true' } : row); edit({ rows }) }}><option value="">待判断</option><option value="true">真</option><option value="false">假</option></select>{wrong && <small>应为 {boolLabel(result!.rows[index].expected[column.key])}</small>}</td> })}</tr>)}</tbody></table></div>
      <label className="logic-explanation" htmlFor="logic-explanation">你的反例与推理<span>为什么某一格能否定“总是为真”？逆否命题与原命题如何比较？</span></label><textarea id="logic-explanation" rows={5} maxLength={4000} value={attempt.explanation} disabled={!!attempt.submittedAt} onChange={event => edit({ explanation: event.target.value })} placeholder="我选择 P 真、Q 假这一行，因为……；逐行比较后……"/>
      <div className="practice-actions">{!result && <button className="button primary" disabled={busy || saveState === 'failed'} onClick={verify}>{busy ? '逐格核对中…' : attempt.submittedAt ? '重试同一版核验' : '保存并核验这一版'} ↗</button>}{attempt.submittedAt && <button className="button secondary" disabled={busy} onClick={beginAgain}>修改并开始新版本</button>}<button className="text-link" onClick={() => { const blob = new Blob([JSON.stringify(attempt, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `CS05-${attempt.id}.json`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000) }}>导出本版作品 ↓</button></div>
      {message && <p className="logic-message" role="status">{message}</p>}
    </section><aside className="logic-theory"><div className="panel-heading"><div><span className="eyebrow">02 / REASON</span><h2>定义就在手边</h2></div><span className="mini-orbit" aria-hidden="true">◌</span></div><div className="logic-rule"><span>01</span><div><strong>蕴含 P → Q</strong><p>仅当 P 真且 Q 假时为假。这里是材料蕴含的真值约定，不在断言因果。</p></div></div><div className="logic-rule"><span>02</span><div><strong>逆否 ¬Q → ¬P</strong><p>把结论取反放到前面，再把前提取反。试着逐行比较它与 P → Q。</p></div></div><div className="logic-rule"><span>03</span><div><strong>双条件 P ↔ Q</strong><p>两个方向都要成立；P 与 Q 同真值时为真。</p></div></div><button className="text-link logic-answer-trigger" onClick={revealAnswer}>{answerOpen ? '收起参考答案 ↑' : '自主查看参考答案 →'}</button>{answerOpen && <div className="logic-answer"><strong>固定四行参考真值</strong><ol>{expected.map((row, index) => <li key={index}>P = {boolLabel(logicAssignments[index].p)}，Q = {boolLabel(logicAssignments[index].q)}：{columns.map(column => `${column.name}${boolLabel(row[column.key])}`).join(' / ')}</li>)}</ol><p>查看答案仅用于自学对照，已记录查看次数，不增加达标目标数。</p></div>}<p className="field-note">参考答案已查看 {answered} 次。这个样例尚未经过完整课程教研验收。</p></aside></div>
    <section className="logic-results"><div className="section-heading"><div><span className="eyebrow">03 / REFLECT & RETRY</span><h2>核对结果与下一步</h2></div><Link className="text-link" to="/atlas?course=CS05">回到知识图谱 →</Link></div>{result ? <><div className={`result-summary ${result.truth_correct ? 'partial' : 'consolidate'}`}><strong>{result.truth_correct ? '固定真值表逐格一致，目标仍未宣称掌握。' : '有真值格需要修正。'}</strong><p>{result.summary}</p>{attempt.resultTrust && <p>这是从账号同步恢复的客户端报告，需要重新核验来源。</p>}</div><div className="criterion-results">{result.criteria.map(criterion => <div className="criterion-row" key={criterion.id}><span className={`criterion-icon ${criterion.status}`}>{criterion.status === 'met' ? '✓' : criterion.status === 'not_met' ? '↻' : '◌'}</span><div><strong>{logicExample.objectives[0].criteria.find(item => item.id === criterion.id)?.title ?? criterion.id}</strong><p>{criterion.reason}</p></div><span>{criterion.status === 'met' ? '满足' : criterion.status === 'not_met' ? '未满足' : '待审阅'}</span></div>)}</div><p className="field-note">下一步：结合不一致的格子修改新版本，再用不同条件独立解释；教师或独立评价尚未接入此样例。</p></> : <div className="result-empty"><span aria-hidden="true">◌</span><div><strong>这里等待你提交的实际作品。</strong><p>核对之前不会替你填写或推断掌握状态。</p></div></div>}</section>
    {history.length > 0 && <section className="logic-history"><div className="section-heading"><div><span className="eyebrow">VERSION HISTORY</span><h2>过去的尝试</h2></div><small>{history.length} 个本地版本</small></div>{history.slice(0, 12).map(record => <button key={record.id} onClick={() => { request.current?.abort(); setAttempt(record); setMessage('已打开历史版本。可从这里新建修改版。') }}><time>{new Date(record.createdAt).toLocaleString('zh-CN')}</time><span>{record.result ? record.result.truth_correct ? '逐格一致 · 待审阅' : '存在不一致' : '尚未完成核验'}</span><span>{record.resultTrust ? '账号恢复报告' : '本机记录'}</span></button>)}</section>}
  </div>
}
