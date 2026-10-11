import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { verifyAlgebra } from '../api/verification'
import { algebraSubmission, ALGEBRA_LABELS, ALGEBRA_PREDICTIONS, newAlgebraAttempt, retryAlgebraAttempt, type AlgebraAttempt, type AlgebraPrediction } from '../domain/algebra'
import type { AtlasPackage, CourseAlgebraActivity } from '../domain/course-packages'
import { database, recordHelp, saveAlgebraAttempt } from '../local/database'
import { registerIdentityFlusher } from '../local/identity'
import { useAuth } from '../local/AuthProvider'
import { useLocal } from '../local/LocalProvider'

type Lesson = { course: AtlasPackage; activity: CourseAlgebraActivity; objective: string }
const verdict = (value: unknown) => value === true ? '是' : value === false ? '否' : '未检查'
function witnesses(report: Record<string, unknown>, mode: string): string[] {
  const items: string[] = []
  const inspect = (value: Record<string, unknown>, symbol: string) => {
    const closure = value.closure_witness
    if (Array.isArray(closure)) items.push(`${closure[0]} ${symbol} ${closure[1]} = ${closure[2]}，结果不在集合内。`)
    const associativity = value.associativity_witness
    if (Array.isArray(associativity)) items.push(`(${associativity[0]} ${symbol} ${associativity[1]}) ${symbol} ${associativity[2]} = ${associativity[3]}，而 ${associativity[0]} ${symbol} (${associativity[1]} ${symbol} ${associativity[2]}) = ${associativity[4]}。`)
  }
  if (mode === 'group') inspect(report, '·')
  if (mode === 'ring') {
    if (report.addition && typeof report.addition === 'object') inspect(report.addition as Record<string, unknown>, '+')
    if (report.multiplication && typeof report.multiplication === 'object') inspect(report.multiplication as Record<string, unknown>, '·')
    const distributivity = report.distributivity_witness
    if (Array.isArray(distributivity)) {
      const [, a, b, c, left, right] = distributivity
      items.push(distributivity[0] === 'left' ? `${a} · (${b} + ${c}) = ${left}，而 ${a} · ${b} + ${a} · ${c} = ${right}。` : `(${a} + ${b}) · ${c} = ${left}，而 ${a} · ${c} + ${b} · ${c} = ${right}。`)
    }
    if (report.nonzero_inverse_state === 'missing') items.push(`非零元素 ${report.nonzero_inverse_witness} 没有双侧乘法逆元。`)
    if (report.nonzero_inverse_state === 'not_applicable_no_identity') items.push('没有乘法单位元，不能将“没有返回缺失逆元”理解为逆元全部存在。')
    if (Array.isArray(report.zero_divisor_witness)) items.push(`非零元素 ${report.zero_divisor_witness.join(' 与 ')} 的乘积是加法零元。`)
  }
  if (mode === 'homomorphism') {
    const preservation = report.preservation_witness
    if (Array.isArray(preservation)) items.push(`f(${preservation[0]} · ${preservation[1]}) = ${preservation[2]}，而 f(${preservation[0]}) · f(${preservation[1]}) = ${preservation[3]}。`)
    const collision = report.collision_witness
    if (Array.isArray(collision)) items.push(`不同源元素 ${collision[0]}、${collision[1]} 的像都是 ${collision[2]}，不是单射。`)
  }
  return items
}

export default function AlgebraWorkspace({ lesson }: { lesson: Lesson }) {
  const { course, activity, objective } = lesson
  const { spaceId, algebraAttempts, help, refresh } = useLocal()
  const auth = useAuth()
  const [attempt, setAttempt] = useState<AlgebraAttempt | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState<'loading' | 'saved' | 'saving' | 'failed'>('loading')
  const [message, setMessage] = useState('')
  const [answerOpen, setAnswerOpen] = useState(false)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const request = useRef<AbortController | null>(null)
  const identity = `${spaceId}:${auth.epoch}:${activity.version_id}`
  const currentIdentity = useRef(identity); currentIdentity.current = identity
  const goal = course.objectives.find(item => item.code === objective)!

  useEffect(() => registerIdentityFlusher(async () => { await queue.current }), [])
  useEffect(() => {
    let active = true
    request.current?.abort(); setBusy(false); setAttempt(null); setSaved('loading'); setMessage(''); setAnswerOpen(false)
    database.algebraAttempts.where('spaceId').equals(spaceId).toArray().then(records => {
      const latest = records.filter(record => record.courseVersionId === course.course_version_id && record.activityVersionId === activity.version_id && record.objectiveCode === objective).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)).at(-1)
      if (active && currentIdentity.current === identity) { setAttempt(latest ?? newAlgebraAttempt(spaceId, { objectiveCode: objective, courseCode: course.course_code, courseVersionId: course.course_version_id, activityVersionId: activity.version_id, activityVersion: activity.version }, activity.algebra_prompt)); setSaved('saved') }
    }).catch(() => { if (active) { setSaved('failed'); setMessage('本地作品未能打开，请检查浏览器存储权限。') } })
    return () => { active = false; request.current?.abort() }
  }, [identity, spaceId, course, activity, objective])

  function edit(change: Partial<AlgebraAttempt>) {
    if (!attempt || attempt.submittedAt || busy) return
    const next = { ...attempt, ...change, updatedAt: new Date().toISOString() }
    setAttempt(next); setSaved('saving')
    const saving = queue.current.catch(() => undefined).then(() => saveAlgebraAttempt(next))
    queue.current = saving
    void saving.then(() => { if (currentIdentity.current === identity) setSaved('saved') }, () => { if (currentIdentity.current === identity) { setSaved('failed'); setMessage('保存失败，请先导出本版，修复存储后再核验。') } })
  }
  async function retry() {
    if (!attempt || busy) return
    try {
      await queue.current
      const next = retryAlgebraAttempt(attempt)
      await saveAlgebraAttempt(next)
      if (currentIdentity.current !== identity) return
      setAttempt(next); setSaved('saved'); setMessage('新版本已建立；修改表格与预测后再次核验。'); await refresh()
    } catch (error) { if (currentIdentity.current === identity) setMessage(error instanceof Error ? error.message : '新版本未能保存。') }
  }
  async function verify() {
    if (!attempt || busy || attempt.result) return
    try { algebraSubmission(attempt); if (!attempt.explanation.trim()) throw new Error('请先记录反例或修改理由。') } catch (error) { setMessage(error instanceof Error ? error.message : '请检查表格与预测。'); return }
    const frozen = attempt.submittedAt ? attempt : { ...attempt, submittedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    const controller = new AbortController(); request.current = controller
    setBusy(true); setMessage('正在检查完整有限表，本机作品先保存。')
    try {
      await queue.current
      if (!attempt.submittedAt) { await saveAlgebraAttempt(frozen); if (currentIdentity.current !== identity) return; setAttempt(frozen) }
      const { result, acknowledge } = await verifyAlgebra(frozen, course.course_id, goal.id, controller.signal)
      if (currentIdentity.current !== identity || controller.signal.aborted) return
      const completed = { ...frozen, result, updatedAt: new Date().toISOString() }
      await saveAlgebraAttempt(completed)
      if (currentIdentity.current !== identity) return
      setAttempt(completed); setSaved('saved'); await refresh()
      const cleaned = await acknowledge().then(() => true).catch(() => false)
      if (currentIdentity.current === identity) setMessage(cleaned ? '核验结果已保存；解释和独立新结构仍待验证。' : '结果已保存；服务端临时结果将在租约到期后清理。')
    } catch (error) { if (currentIdentity.current === identity) setMessage(error instanceof Error ? error.message : '核验未完成，作品保留在本机。') }
    finally { if (currentIdentity.current === identity) setBusy(false); if (request.current === controller) request.current = null }
  }
  async function showExample() {
    if (!attempt) return
    if (answerOpen) { setAnswerOpen(false); return }
    try {
      await recordHelp({ id: crypto.randomUUID(), spaceId, objectiveId: objective, kind: 'answer', disclosureVersion: activity.version, revisionId: attempt.id, artifactId: attempt.artifactId, courseVersion: course.course_version_id, activityVersion: activity.version_id, createdAt: new Date().toISOString() })
      if (currentIdentity.current === identity) { setAnswerOpen(true); await refresh() }
    } catch { if (currentIdentity.current === identity) setMessage('查看记录未能保存，请检查本地存储。') }
  }
  function tableEditor(rows: string[][], name: string, second = false) {
    return <div className="algebra-table-wrap"><table className="algebra-table"><caption>{name} · 标签集合 {'{'}{rows.map((_, index) => index).join(', ')}{'}'}</caption><thead><tr><th scope="col">{attempt?.mode === 'ring' && !second ? '+' : '·'}</th>{rows.map((_, index) => <th scope="col" key={index}>{index}</th>)}</tr></thead><tbody>{rows.map((row, r) => <tr key={r}><th scope="row">{r}</th>{row.map((value, c) => <td key={c}><input inputMode="numeric" aria-label={`${name}，第 ${r + 1} 行，第 ${c + 1} 列`} value={value} maxLength={20} disabled={!!attempt?.submittedAt || busy} onChange={event => { const next = rows.map((cells, i) => cells.map((cell, j) => i === r && j === c ? event.target.value : cell)); edit(second ? { secondTable: next } : { table: next }) }}/></td>)}</tr>)}</tbody></table></div>
  }
  if (!attempt) return <div className="page page-loading" role="status">{message || '正在恢复有限运算表…'}</div>
  const result = attempt.result
  const history = algebraAttempts.filter(record => record.courseVersionId === course.course_version_id && record.activityVersionId === activity.version_id && record.id !== attempt.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const keys = ALGEBRA_PREDICTIONS[attempt.mode]
  const examples = activity.reference_note ?? '从核验返回的反例定位相关单元格或映射，再重新检查完整有限表；没有预设一个修正答案。'
  return <div className="page logic-page algebra-page">
    <div className="workspace-top"><div><Link className="breadcrumb" to={`/atlas?course=${course.course_code}&edition=core&goal=${objective}`}>{course.title} / 代数结构 ↗</Link><h1>{activity.title}</h1></div><div className={`save-state ${saved}`} role="status"><span className="status-dot"/>{saved === 'saved' ? '本地已保存' : saved === 'saving' ? '正在本地保存' : saved === 'failed' ? '本地保存失败' : '正在恢复'}</div></div>
    <div className="workspace-meta"><span className="small-tag">直接操作表格 · 无需编写代码</span><span>{auth.account ? '账号空间 · 本机先保存并同步' : '未登录 · 仅保存在本设备'}</span><Link className="text-link" to={`?courseVersion=${course.course_version_id}&task=code`}>可选代码探索 →</Link></div>
    <div className="logic-intro"><div><h2>让每一个反例都有出处。</h2><p>{activity.student_action}</p></div><div className="algebra-domain-summary"><strong>{attempt.table.length} 个元素</strong><span>完整有限表 · 每项条件分别检查</span></div></div>
    <div className="logic-layout"><section className="logic-practice"><div className="panel-heading"><h2>操作、预测，再验证</h2><span className="small-tag">{attempt.mode === 'ring' ? '两个运算' : attempt.mode === 'homomorphism' ? '两个集合与映射' : '一个运算'}</span></div>
      <p className="practice-intro">行标签是左操作数，列标签是右操作数。可保留越界结果作为反例；核验后表格和预测会冻结。</p>
      <div className="algebra-tables">{tableEditor(attempt.table, attempt.mode === 'ring' ? '加法表' : attempt.mode === 'homomorphism' ? '源运算表' : '运算表')}{attempt.secondTable && tableEditor(attempt.secondTable, attempt.mode === 'ring' ? '乘法表' : '目标运算表', true)}</div>
      {attempt.mapping && <fieldset className="algebra-mapping"><legend>映射 f：源集合 → 目标集合</legend>{attempt.mapping.map((value, index) => <label key={index}>f({index}) = <input aria-label={`源元素 ${index} 的像`} inputMode="numeric" maxLength={20} value={value} disabled={!!attempt.submittedAt || busy} onChange={event => edit({ mapping: attempt.mapping!.map((cell, i) => i === index ? event.target.value : cell) })}/></label>)}</fieldset>}
      <fieldset className="algebra-predictions"><legend>先预测性质，核验后逐项比较</legend>{keys.map(key => <label key={key}><span>{ALGEBRA_LABELS[key]}</span><select aria-label={`${ALGEBRA_LABELS[key]}的预测`} value={attempt.predictions[key]} disabled={!!attempt.submittedAt || busy} onChange={event => edit({ predictions: { ...attempt.predictions, [key]: event.target.value as AlgebraPrediction } })}><option value="">待判断</option><option value="true">是</option><option value="false">否</option><option value="unchecked">前置条件不成立，不能检查</option></select></label>)}</fieldset>
      <label className="logic-explanation" htmlFor="algebra-explanation">反例与修改理由<span>指出具体元素和结果；解释修改会影响哪些公理。</span></label><textarea id="algebra-explanation" rows={4} maxLength={4000} value={attempt.explanation} disabled={!!attempt.submittedAt || busy} onChange={event => edit({ explanation: event.target.value })}/>
      <div className="practice-actions">{!result && <button className="button primary" disabled={busy || saved === 'failed'} onClick={verify}>{busy ? '正在核验…' : '保存并核验运算表'}</button>}{attempt.submittedAt && <button className="button secondary" disabled={busy} onClick={retry}>修改并开始新版本</button>}<button className="text-link" onClick={() => { const url = URL.createObjectURL(new Blob([JSON.stringify(attempt, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = `${objective}-${attempt.id}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }}>导出本版作品 ↓</button></div>
      {message && <p role="status" className="logic-message">{message}</p>}
    </section><aside className="logic-theory"><div className="panel-heading"><h2>与操作一起理解公理</h2><span className="mini-orbit" aria-hidden="true">◌</span></div>{activity.theory.map((text, index) => <div className="logic-rule" key={text}><span>{index + 1}</span><p>{text}</p></div>)}<button className="text-link" onClick={showExample}>{answerOpen ? '收起修正示例 ↑' : '自主查看一种修正示例 →'}</button>{answerOpen && <div className="logic-answer"><p>{examples}</p><p>只供自学对照，查看不会替你修改表格或增加达标数。</p></div>}<p className="field-note">本活动修正示例已查看 {help.filter(event => event.objectiveId === objective && event.activityVersion === activity.version_id && event.kind === 'answer').length} 次。</p><p className="field-note">{activity.completion_limit}</p>{course.sources?.filter(source => activity.source_refs.includes(source.id)).map(source => <a className="text-link algebra-source" href={source.url} target="_blank" rel="noreferrer" key={source.id}>{source.title} ↗</a>)}</aside></div>
    <section className="logic-results"><div className="section-heading"><h2>实际性质、反例与下一步</h2><Link className="text-link" to={`/atlas?course=${course.course_code}&edition=core&goal=${objective}`}>查看图谱证据 →</Link></div>{result ? <><div className={`result-summary ${result.prediction_correct ? 'partial' : 'consolidate'}`}><strong>{result.prediction_correct ? '本版预测与完整有限表一致' : '预测与实际性质有差异，请查看具体条件'}</strong><p>正确判断“不成立”也是有效证据。文字解释和独立新结构仍待审阅，目标未确认掌握。</p>{attempt.resultTrust && <p>这是从账号恢复的客户端报告；须重新核验才能建立当前设备的可信证据。</p>}</div><div className="algebra-facts">{keys.map(key => <div key={key}><span>{ALGEBRA_LABELS[key]}</span><strong>{verdict(result.report[key])}</strong></div>)}</div><div className="algebra-witnesses">{witnesses(result.report, attempt.mode).map(text => <p key={text}>{text}</p>)}</div><div className="criterion-results">{result.criteria.map(criterion => <div className="criterion-row" key={criterion.id}><span className={`criterion-icon ${criterion.status}`}>{criterion.status === 'met' ? '✓' : criterion.status === 'not_met' ? '↻' : '◌'}</span><div><strong>{ALGEBRA_LABELS[criterion.id] ?? (criterion.id === 'explanation' ? '反例与推理解释' : '独立新结构与迁移')}</strong><p>{criterion.reason}</p></div><span>{criterion.status === 'met' ? '满足' : criterion.status === 'not_met' ? '未满足' : '待审阅'}</span></div>)}</div></> : <div className="result-empty"><span aria-hidden="true">◌</span><div><strong>等待你的预测与实际作品。</strong><p>系统会检查完整有限表，反馈不是靠几个样本推断出来的。</p></div></div>}</section>
    {history.length > 0 && <section className="logic-history"><div className="section-heading"><h2>修改前的证据仍保留</h2><span>{history.length} 个历史版本</span></div>{history.slice(0, 20).map(record => <button key={record.id} disabled={busy} aria-label={`历史版本 ${record.id}`} onClick={async () => { try { await queue.current; if (currentIdentity.current === identity) { setAttempt(record); setSaved('saved'); setMessage('正在查看历史版本；可据此创建新修改版。') } } catch { setMessage('当前草稿尚未保存，请先导出。') } }}><time>{new Date(record.createdAt).toLocaleString('zh-CN')}</time><span>{record.result ? record.result.prediction_correct ? '预测一致 · 未确认掌握' : '预测存在差异' : '尚未完成核验'}</span><span>{record.resultTrust ? '恢复报告' : '本机记录'}</span></button>)}</section>}
  </div>
}
