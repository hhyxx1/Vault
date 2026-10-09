import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useBlocker, useParams } from 'react-router-dom'
import { COURSE_VERSION, TRACE_ACTIVITY, TRACE_OBJECTIVE, IMPLEMENT_OBJECTIVE, traceOperations, parseTrace, criterionLabels, currentTraceEvidence, evidenceMatchesDraft, type Draft, type EvidenceRecord, type ArtifactRevision } from '../domain/learning'
import { database, loadDraft, saveDraft, saveRevision, recordEvidence, recordHelp } from '../local/database'
import { useLocal } from '../local/LocalProvider'
import { verifyTrace, requestLearningAssist, listModelProfiles, type LearningAssistIntent, type ModelCatalog } from '../api/verification'
import CodeEditor from './CodeEditor'
import { useAuth } from '../local/AuthProvider'
import { registerIdentityFlusher } from '../local/identity'
import { liveQuery } from 'dexie'
import { canonicalJson } from '../domain/integrity'

const correctRows = [
  { stack: '[8]', output: '—', underflow: false }, { stack: '[8, 3]', output: '—', underflow: false },
  { stack: '[8]', output: '3', underflow: false }, { stack: '[8, 5]', output: '—', underflow: false },
  { stack: '[8]', output: '5', underflow: false }, { stack: '[]', output: '8', underflow: false },
  { stack: '[]', output: '—', underflow: true },
]
const modelCapabilityLabels: Record<string, string> = { text: '文本', reasoning: '推理', vision: '视觉', json: '结构化输出', tools: '工具' }

export default function Workspace() {
  const { objectiveId = TRACE_OBJECTIVE } = useParams()
  const isTrace = objectiveId === TRACE_OBJECTIVE
  const { spaceId, help, evidence, refresh } = useLocal()
  const { account } = useAuth()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saveState, setSaveState] = useState<'loading' | 'dirty' | 'saving' | 'saved' | 'failed'>('loading')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [assistantBusy, setAssistantBusy] = useState(false)
  const [assistantIntent, setAssistantIntent] = useState<Exclude<LearningAssistIntent, 'result_feedback'>>('hint')
  const [assistantQuestion, setAssistantQuestion] = useState('')
  const [assistantConsent, setAssistantConsent] = useState(false)
  const [modelCatalog, setModelCatalog] = useState<ModelCatalog | null>(null)
  const [modelProfileId, setModelProfileId] = useState('')
  const [feedbackAfterVerify, setFeedbackAfterVerify] = useState(false)
  const [theoryTab, setTheoryTab] = useState<'concept' | 'hint' | 'answer'>('concept')
  const [tab, setTab] = useState<'practice' | 'theory' | 'result'>('practice')
  const [returnToPractice, setReturnToPractice] = useState(false)
  const [result, setResult] = useState<EvidenceRecord | null>(null)
  const generation = useRef(0)
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve())
  const mounted = useRef(true)
  const retry = useRef<{ revision: ArtifactRevision; key: string; helpEventIds: string[]; submittedAt: string } | null>(null)
  const lastSaved = useRef('')
  const storedBaseline = useRef('')
  const queuedSnapshots = useRef(new Set<string>())
  const draftRef = useRef<Draft | null>(null)
  draftRef.current = draft
  const abortRequest = useRef<AbortController | null>(null)
  const assistantAbort = useRef<AbortController | null>(null)
  const navigationFlush = useRef(false)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => currentLocation.pathname !== nextLocation.pathname && (busy || saveState === 'dirty' || saveState === 'saving' || saveState === 'failed'))
  const selectedModelId = modelProfileId || modelCatalog?.task_defaults[assistantIntent] || modelCatalog?.profiles[0]?.id
  const selectedModel = modelCatalog?.profiles.find(profile => profile.id === selectedModelId)
  const feedbackModelId = modelCatalog?.task_defaults.result_feedback || modelCatalog?.profiles[0]?.id
  const feedbackModel = modelCatalog?.profiles.find(profile => profile.id === feedbackModelId)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    const controller = new AbortController()
    listModelProfiles(controller.signal).then(setModelCatalog).catch(() => setModelCatalog({ profiles: [], task_defaults: {} }))
    return () => controller.abort()
  }, [])
  useEffect(() => {
    if (!spaceId) return
    const current = ++generation.current
    abortRequest.current?.abort(); abortRequest.current = null
    setDraft(null); setBusy(false); setAssistantBusy(false); setAssistantConsent(false); setAssistantQuestion(''); setFeedbackAfterVerify(false); setSaveState('loading'); setResult(null); setTheoryTab('concept'); setReturnToPractice(false); retry.current = null
    loadDraft(objectiveId, spaceId).then(value => { if (generation.current === current) { storedBaseline.current = canonicalJson(value); lastSaved.current = JSON.stringify(value); setDraft(value); setSaveState('saved'); setResult(objectiveId === TRACE_OBJECTIVE ? currentTraceEvidence(evidence) ?? null : null) } }).catch(() => { setSaveState('failed'); setMessage('无法读取本地作品，请检查存储权限后重试。') })
    return () => { abortRequest.current?.abort(); assistantAbort.current?.abort() }
  }, [spaceId, objectiveId])
  useEffect(() => {
    if (!spaceId) return
    const current = generation.current
    const subscription = liveQuery(() => database.drafts.get([spaceId, objectiveId])).subscribe({ next: value => {
      if (!value || !mounted.current || current !== generation.current) return
      const content = canonicalJson(value)
      if (content === storedBaseline.current || queuedSnapshots.current.has(content)) return
      if (draftRef.current && JSON.stringify(draftRef.current) !== lastSaved.current) {
        setSaveState('failed'); setMessage('其他设备已更新此作品。当前输入仍在页面中，请先导出或读取更新后的版本再继续编辑。'); return
      }
      storedBaseline.current = content; lastSaved.current = JSON.stringify(value); setDraft(value); setSaveState('saved'); setMessage('已恢复另一设备的更新，请基于当前显示的作品继续编辑。')
    }, error: () => setMessage('暂时无法检查其他设备的作品更新。') })
    return () => subscription.unsubscribe()
  }, [spaceId, objectiveId])

  const persist = useCallback((value: Draft) => {
    const current = generation.current
    setSaveState('saving')
    const content = canonicalJson(value); queuedSnapshots.current.add(content)
    const action = saveQueue.current.catch(() => undefined).then(async () => { await saveDraft(value, database, storedBaseline.current); if (generation.current === current) storedBaseline.current = content })
    saveQueue.current = action
    return action.then(() => { if (mounted.current && generation.current === current) { lastSaved.current = JSON.stringify(value); setSaveState(JSON.stringify(draftRef.current) === lastSaved.current ? 'saved' : 'dirty') } }).catch(error => { if (mounted.current && generation.current === current) { setSaveState('failed'); setMessage(error instanceof Error && error.message.startsWith('其他设备') ? error.message : '本地保存失败，当前修改尚未保存。请导出作品或重试。') } throw error }).finally(() => queuedSnapshots.current.delete(content))
  }, [])
  useEffect(() => registerIdentityFlusher(async () => {
    abortRequest.current?.abort()
    const value = draftRef.current
    if (value) { await persist(value); await saveQueue.current }
  }), [persist])
  useEffect(() => {
    if (!draft || JSON.stringify(draft) === lastSaved.current) return
    setSaveState('dirty')
    // Every change enters the ordered write queue immediately. Route changes also
    // flush the newest snapshot before leaving, rather than cancelling a debounce.
    persist(draft).catch(() => undefined)
  }, [draft, persist])
  useEffect(() => {
    if (blocker.state !== 'blocked') { navigationFlush.current = false; return }
    if (busy) { setMessage('核验正在进行。请等待完成，或取消核验后继续离开。'); return }
    if (navigationFlush.current) return
    navigationFlush.current = true
    const value = draftRef.current
    if (!value) { blocker.proceed(); return }
    persist(value).then(() => blocker.proceed()).catch(() => { blocker.reset(); navigationFlush.current = false; setMessage('离开前保存失败，已保留当前页面。请重试或导出作品。') })
  }, [blocker, busy, persist])
  useEffect(() => {
    if (!busy && saveState !== 'dirty' && saveState !== 'saving' && saveState !== 'failed') return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [saveState, busy])

  function update(values: Partial<Draft>) {
    retry.current = null
    setDraft(current => current ? { ...current, ...values, updatedAt: new Date().toISOString() } : current)
  }

  async function disclose(kind: 'hint' | 'answer') {
    if (!spaceId) return
    const current = generation.current
    try {
      await recordHelp({ id: crypto.randomUUID(), spaceId, objectiveId, kind, disclosureVersion: isTrace ? 'stack-trace-help-v1' : 'bracket-help-v1', createdAt: new Date().toISOString() })
      if (!mounted.current || current !== generation.current) return
      setTheoryTab(kind); setTab('theory'); await refresh()
    } catch { if (mounted.current && current === generation.current) setMessage('帮助使用记录无法保存，暂未打开此帮助。请检查本地存储后重试。') }
  }

  async function askAssistant() {
    if (!spaceId || !draft || assistantBusy) return
    if (!selectedModelId || !selectedModel) { setMessage('学习助手尚未配置可用模型。'); return }
    if (!assistantConsent) { setMessage('请先明确同意发送当前学习摘录，再请求学习助手。'); return }
    if (!draft.goalConfirmed) { setMessage('请先确认本次学习目标。'); return }
    const current = generation.current
    const requestId = crypto.randomUUID()
    const controller = new AbortController()
    assistantAbort.current?.abort()
    assistantAbort.current = controller
    setAssistantBusy(true); setMessage('')
    try {
      await persist(draft); await saveQueue.current
      const revision = await saveRevision(draft)
      const reply = await requestLearningAssist({
        request_id: requestId, model_profile_id: selectedModelId, course_code: 'CS03', course_version: COURSE_VERSION,
        activity_version: TRACE_ACTIVITY, objective_code: TRACE_OBJECTIVE, intent: assistantIntent, disclosure_accepted: true,
        artifact_id: revision.artifactId, revision_id: revision.revisionId, goal: draft.goal,
        question: assistantQuestion.trim(), work_excerpt: JSON.stringify(draft.trace).slice(0, 4000),
        explanation: draft.explanation.slice(0, 4000),
      }, controller.signal)
      if (!mounted.current || generation.current !== current) return
      await recordHelp({ id: requestId, spaceId, objectiveId, kind: 'agent_assist', disclosureVersion: `learning-assist-${selectedModelId}-v1`, createdAt: new Date().toISOString(), intent: assistantIntent, question: assistantQuestion.trim(), reply: reply.message, nextAction: reply.next_action, revisionId: revision.revisionId, artifactId: revision.artifactId, courseVersion: COURSE_VERSION, activityVersion: TRACE_ACTIVITY })
      await refresh()
    } catch (error) {
      if (mounted.current && generation.current === current) setMessage(error instanceof Error ? error.message : '学习助手暂时不可用；作品仍保存在本地。')
    } finally { if (assistantAbort.current === controller) assistantAbort.current = null; if (mounted.current && generation.current === current) setAssistantBusy(false) }
  }
  async function keepVersion() {
    if (!draft) return
    const current = generation.current
    setMessage('')
    try { await persist(draft); await saveQueue.current; if (!mounted.current || current !== generation.current) return; const version = await saveRevision(draft); await refresh(); if (mounted.current && current === generation.current) setMessage(`作品版本 ${version.version} 已保存在本地。`) } catch { if (mounted.current && current === generation.current) setMessage('保存版本失败，当前修改尚不能保证保留。请重试或导出。') }
  }

  async function verify() {
    if (!draft || busy) return
    setMessage(''); setBusy(true)
    abortRequest.current = new AbortController()
    const current = generation.current
    const submittedAt = new Date().toISOString()
    const includeAgentFeedback = feedbackAfterVerify && !!feedbackModelId
    try {
      if (!draft.goalConfirmed) throw new Error('请先确认本次目标，或修改成适合自己的范围。')
      const predictions = parseTrace(draft.trace)
      if (!draft.explanation.trim()) throw new Error('请写下你对后进先出与空栈情况的解释；解释会保留为待复核作品。')
      if (draft.explanation.length > 4000) throw new Error('本次解释最多4000个字符。请先保留或导出完整作品，再缩小提交范围。')
      await persist(draft); await saveQueue.current
      if (!mounted.current || generation.current !== current || abortRequest.current.signal.aborted) throw new DOMException('学习空间已切换。', 'AbortError')
      if (!retry.current) {
        const usedHelp = await database.help.where('objectiveId').equals(objectiveId).toArray()
        retry.current = { revision: await saveRevision(draft), key: crypto.randomUUID(), submittedAt, helpEventIds: usedHelp.filter(item => item.spaceId === spaceId && item.createdAt <= submittedAt).map(item => item.id) }
      }
      const request = retry.current
      const response = await verifyTrace(request.revision, predictions, request.key, abortRequest.current.signal)
      if (!mounted.current || generation.current !== current || abortRequest.current.signal.aborted) throw new DOMException('学习空间已切换。', 'AbortError')
      let agentEventId: string | undefined
      let agentFeedbackFailed = false
      if (includeAgentFeedback) {
        const requestId = crypto.randomUUID()
        try {
          const reply = await requestLearningAssist({
            request_id: requestId, model_profile_id: feedbackModelId, course_code: 'CS03', course_version: COURSE_VERSION,
            activity_version: TRACE_ACTIVITY, objective_code: TRACE_OBJECTIVE, intent: 'result_feedback', disclosure_accepted: true,
            artifact_id: request.revision.artifactId, revision_id: request.revision.revisionId,
            goal: request.revision.goal, question: '请根据这次核验结果解释需要修改或继续验证的地方。',
            work_excerpt: JSON.stringify(predictions).slice(0, 4000),
            explanation: request.revision.explanation.slice(0, 4000),
            operation_id: response.operation.operation_id,
          }, abortRequest.current.signal)
          await recordHelp({ id: requestId, spaceId, objectiveId, kind: 'agent_assist', disclosureVersion: `learning-assist-${feedbackModelId}-v1`, createdAt: new Date().toISOString(), intent: 'result_feedback', question: '请根据这次核验结果解释需要修改或继续验证的地方。', reply: reply.message, nextAction: reply.next_action, revisionId: request.revision.revisionId, artifactId: request.revision.artifactId, courseVersion: COURSE_VERSION, activityVersion: TRACE_ACTIVITY })
          agentEventId = requestId
        } catch { agentFeedbackFailed = true }
      }
      const record: EvidenceRecord = { id: response.operation.result.verification_id, spaceId, objectiveId, revisionId: request.revision.revisionId, revisionVersion: request.revision.version, submittedAt: request.submittedAt, submittedWork: { trace: predictions, explanation: request.revision.explanation }, createdAt: new Date().toISOString(), result: response.operation.result, helpEventIds: [...request.helpEventIds, ...(agentEventId ? [agentEventId] : [])] }
      await recordEvidence(record)
      // Acknowledge only after the complete result is durably written to IndexedDB.
      const ackFailed = await response.acknowledge().then(() => false).catch(() => true)
      retry.current = null
      if (mounted.current && generation.current === current) { setResult(record); setTab('result'); setMessage((ackFailed ? '核验已保存在本地；服务端临时结果的清理确认暂未送达，将按租约期限清理。' : '真实核验已保存在本地，并已请求清理服务端临时结果。') + (agentFeedbackFailed ? ' AI 解读未完成；核验结果不受影响。' : agentEventId ? ' AI 解读也已关联并保存在本地。' : '')); await refresh() }
    } catch (error) {
      if (mounted.current && generation.current === current) setMessage(error instanceof DOMException && error.name === 'AbortError' ? '已取消等待核验结果；作品仍保存在本地，临时服务数据按租约期限清理。' : error instanceof Error ? error.message : '临时核验未完成，请检查网络后重试。作品保留在本地。')
    } finally { if (mounted.current && generation.current === current) setBusy(false) }
  }

  function exportCurrent() {
    if (!draft) return
    const url = URL.createObjectURL(new Blob([JSON.stringify({ kind: 'qionglong-local-work', schemaVersion: '1', draft }, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = `${objectiveId}-work.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  async function reloadStoredVersion() {
    const current = generation.current
    try { await saveQueue.current.catch(() => undefined); if (!mounted.current || current !== generation.current) return; const value = await loadDraft(objectiveId, spaceId); if (!mounted.current || current !== generation.current || value.spaceId !== spaceId || value.id !== objectiveId) return; storedBaseline.current = canonicalJson(value); lastSaved.current = JSON.stringify(value); setDraft(value); setSaveState('saved'); setMessage('已读取更新后的版本。请基于当前显示的内容继续编辑。') }
    catch { if (mounted.current && current === generation.current) setMessage('无法读取更新版本，请先导出当前作品。') }
  }

  useEffect(() => {
    if (!returnToPractice || !draft) return
    const frame = requestAnimationFrame(() => {
      const field = document.getElementById('work-explanation')
      if (field instanceof HTMLTextAreaElement) {
        field.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
        field.focus({ preventScroll: true })
      }
      setReturnToPractice(false)
    })
    return () => cancelAnimationFrame(frame)
  }, [returnToPractice, tab, draft])

  if (![TRACE_OBJECTIVE, IMPLEMENT_OBJECTIVE].includes(objectiveId)) return <div className="page"><h1>这个目标尚未开放</h1><Link to="/atlas">返回图谱</Link></div>
  if (!draft) return <div className="page page-loading" role="status">{saveState === 'failed' ? message : '正在恢复本地作品…'}</div>
  const objectiveHelp = help.filter(item => item.objectiveId === objectiveId)
  const latestAgentHelp = objectiveHelp.filter(event => event.kind === 'agent_assist' && event.reply).at(-1)
  const latestCurrent = result && !evidenceMatchesDraft(result, draft)
  return <div className="workspace-page page"><div className="workspace-top"><div><Link className="breadcrumb" to="/atlas">数据结构 / 栈及括号匹配 <span aria-hidden="true">↗</span></Link><h1>{isTrace ? '把栈的每一步推演出来。' : '让括号找到它的另一半。'}</h1></div><div className={`save-state ${saveState}`} role="status"><span className="status-dot"/>{({ loading: '正在恢复', dirty: '有未保存修改', saving: '正在本地保存', saved: '本地已保存', failed: '本地保存失败' }[saveState])}</div></div>
    <div className="workspace-meta"><span className="small-tag">局部工程样例 · 内容待审校</span><span>{account ? '账号空间 · 本机先保存' : '未登录学习 · 本设备存储'}</span><Link to="/evidence">作品与核验记录 ↗</Link></div>
    {!draft.goalConfirmed && <section className="goal-confirm"><div><span className="eyebrow">开始之前 · 确认自己的目标</span><h2>这次练习，你想做到什么？</h2><label className="sr-only" htmlFor="learning-goal">本次学习目标</label><textarea id="learning-goal" value={draft.goal} onChange={event => update({ goal: event.target.value })} rows={2}/><p>这是你的短期练习范围，不会改变整门课程的目标。</p></div><button className="button primary" disabled={!draft.goal.trim()} onClick={() => update({ goalConfirmed: true })}>确认目标，开始尝试 <span aria-hidden="true">→</span></button></section>}
    {draft.goalConfirmed && <div className="confirmed-goal"><span className="eyebrow">本次目标</span><p>{draft.goal}</p><button className="text-link" onClick={() => update({ goalConfirmed: false })}>修改</button></div>}
    <nav className="workspace-mobile-tabs" aria-label="工作区面板">{(['practice', 'theory', 'result'] as const).map(value => <button key={value} aria-pressed={tab === value} onClick={() => setTab(value)}>{value === 'practice' ? '动手实践' : value === 'theory' ? '原理与帮助' : '实际核验'}</button>)}</nav>
    <div className="studio-grid"><section className={`practice-panel mobile-${tab === 'practice' ? 'shown' : 'hidden'}`}><div className="panel-heading"><div><span className="eyebrow">01 / YOUR PRACTICE</span><h2>{isTrace ? '先预测，再核对。' : '先限定问题，再写程序。'}</h2></div><span className="step-count">{isTrace ? '7 STEPS' : 'PYTHON'}</span></div>
      {isTrace ? <><p className="practice-intro">栈底在左、栈顶在右。<code>push(x)</code> 入栈；<code>pop()</code> 返回并移除栈顶。空栈出栈记为下溢，栈保持空、无输出。请亲自填写每一步。</p><div className="trace-table-wrap"><table className="trace-table"><thead><tr><th scope="col">步 / 操作</th><th scope="col">操作后的栈</th><th scope="col">输出</th><th scope="col">下溢</th></tr></thead><tbody>{traceOperations.map((operation, index) => <tr key={index}><th scope="row"><span>{String(index + 1).padStart(2, '0')}</span><code>{operation.label}</code></th><td><input aria-label={`第${index + 1}步操作后的栈`} value={draft.trace[index].stack} placeholder="如 [8, 3] 或 []" onChange={event => update({ trace: draft.trace.map((row, position) => position === index ? { ...row, stack: event.target.value } : row) })}/></td><td><input aria-label={`第${index + 1}步输出`} value={draft.trace[index].output} placeholder="无输出留空" onChange={event => update({ trace: draft.trace.map((row, position) => position === index ? { ...row, output: event.target.value } : row) })}/></td><td><label className="checkbox-label"><input type="checkbox" aria-label={`第${index + 1}步发生下溢`} checked={draft.trace[index].underflow} onChange={event => update({ trace: draft.trace.map((row, position) => position === index ? { ...row, underflow: event.target.checked } : row) })}/><span className="sr-only">发生下溢</span></label></td></tr>)}</tbody></table></div><p className="field-note">栈内容使用数组，例如 [8, 3]；无输出留空。这里没有自动填入答案。</p>
<p className="field-note structured-entry">想挑战容量边界？<Link className="text-link" to="/practice/CS03-STACK-U01-TRACE@0.1.0">进阶活动：容量为 3 的栈（含满栈入栈与空栈出栈）→</Link></p></> : <><p className="practice-intro">限定输入为 <code>()[]{'{}'}</code> 这三种括号；空输入应匹配。先实现自己的思路，再考虑嵌套、多余闭括号和结束时残留左括号。</p><CodeEditor value={draft.code} onChange={code => update({ code })}/><div className="tool-unavailable"><span className="small-tag">代码运行尚未开放</span><p>源码可以本地编辑、保存和导出。目前不会生成编译输出或自动通过记录。</p></div>
<p className="field-note structured-entry">先不写代码也能练判定：<Link className="text-link" to="/practice/CS03-STACK-U04-JUDGE@0.1.0">六组固定串的括号匹配判定（含首个问题括号定位）→</Link></p></>}
      <div className="explanation-field"><label htmlFor="work-explanation">把你的解释也留下来 <span>这是作品的一部分</span></label><textarea id="work-explanation" rows={4} placeholder={isTrace ? '为什么输出按这个顺序出现？最后一次 pop 与之前有何不同？' : '为什么闭括号应该匹配最近的左括号？如何处理各类边界？'} value={draft.explanation} onChange={event => update({ explanation: event.target.value })}/><p className="field-note">解释与独立新条件应用仍需人工复核；状态推演正确不会自动证明全部掌握。</p></div><div className="practice-actions"><button className="button secondary" onClick={keepVersion} disabled={busy}>保存作品版本</button>{isTrace && <button className="button primary" disabled={busy || assistantBusy || !spaceId} onClick={verify}>{busy ? '正在真实核验…' : '提交临时核验'}<span aria-hidden="true">↗</span></button>}{busy && <button className="text-link" onClick={() => abortRequest.current?.abort()}>取消核验</button>}<button className="text-link" onClick={exportCurrent}>导出作品 ↓</button></div>
      {isTrace && <label className="agent-feedback-optin"><input type="checkbox" checked={feedbackAfterVerify} disabled={!feedbackModel} onChange={event => setFeedbackAfterVerify(event.target.checked)}/><span>{feedbackModel ? `核验后请求 AI 解读：会将本次推演、解释和服务器核验摘要发送给 ${feedbackModel.provider}（${feedbackModel.label}）。` : '当前未配置可用的 AI 解读模型。'}AI 解读不改变核验结论或掌握状态。</span></label>}
      {isTrace && <p className="processing-note">{account ? '核验临时处理本次作品；记录先保存本机，再按账号空间逐条同步。' : '提交将临时发送本次推演与解释到核验服务；学习档案保存在本设备。'}</p>}
    </section>
    <aside className={`theory-panel mobile-${tab === 'theory' ? 'shown' : 'hidden'}`}><div className="panel-heading"><div><span className="eyebrow">02 / THINK & TRY</span><h2>原理，随时回来。</h2></div><span className="mini-orbit" aria-hidden="true">◌</span></div><div className="theory-tabs" role="group" aria-label="原理与帮助"><button aria-pressed={theoryTab === 'concept'} onClick={() => setTheoryTab('concept')}>必要原理</button><button aria-pressed={theoryTab === 'hint'} onClick={() => disclose('hint')}>提示</button><button aria-pressed={theoryTab === 'answer'} onClick={() => disclose('answer')}>参考答案</button></div>
      {isTrace && <section className="learning-assist-card" aria-label="学习助手">
        <span className="small-tag">可选 AI 辅助 · 请求时才发送</span>
        <label htmlFor="assist-intent">希望助手怎样帮你？</label>
        <select id="assist-intent" value={assistantIntent} onChange={event => { setAssistantIntent(event.target.value as Exclude<LearningAssistIntent, 'result_feedback'>); setModelProfileId(''); setAssistantConsent(false) }}><option value="diagnose">帮我诊断下一步该检查什么</option><option value="hint">给我一个提示，我继续自己做</option><option value="explain">解释我不明白的原理</option><option value="practice">再给我一个练习情境</option></select>
        <label htmlFor="assist-model">本次使用的模型</label>
        <select id="assist-model" value={selectedModelId || ''} disabled={!modelCatalog?.profiles.length} onChange={event => { setModelProfileId(event.target.value); setAssistantConsent(false) }}>
          {!selectedModelId && <option value="">当前无可用模型</option>}
          {modelCatalog?.profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.label} · {profile.provider} · {profile.capabilities.map(capability => modelCapabilityLabels[capability] ?? capability).join(' / ')}</option>)}
        </select>
        {selectedModel && <p className="field-note">声明能力：{selectedModel.capabilities.map(capability => modelCapabilityLabels[capability] ?? capability).join('、')}。实际回答仍需你核对，模型建议不改变掌握状态。</p>}
        <label htmlFor="assist-question">你的问题</label><textarea id="assist-question" rows={3} maxLength={1200} value={assistantQuestion} onChange={event => setAssistantQuestion(event.target.value)} placeholder="例如：为什么最后一次 pop 是下溢，而不是输出 0？"/>
        <label className="assist-consent"><input type="checkbox" checked={assistantConsent} disabled={!selectedModel} onChange={event => setAssistantConsent(event.target.checked)}/><span>{selectedModel ? `我同意将当前目标、问题、作品摘录和解释发送给 ${selectedModel.provider}（${selectedModel.label}）生成本次答复；不发送账号身份。` : '当前未配置可用模型，学习作品仍可照常保存与核验。'}只有点击请求时才发送。</span></label>
        <button className="button secondary" disabled={assistantBusy || !assistantConsent || !spaceId || !selectedModel} onClick={askAssistant}>{assistantBusy ? '正在生成建议…' : '请求一次学习帮助'} <span aria-hidden="true">↗</span></button>
        {latestAgentHelp && <article className="assistant-answer" aria-live="polite"><span className="eyebrow">最近一次 · 已保存在学习记录</span><p>{latestAgentHelp.reply}</p><strong>下一步</strong><p>{latestAgentHelp.nextAction}</p><small>关联作品版本 {latestAgentHelp.revisionId?.slice(0, 8)} · 不改变知识图谱状态</small><button type="button" className="text-link assistant-return" onClick={() => { setTab('practice'); setReturnToPractice(true) }}>回到作品继续尝试 →</button></article>}
      </section>}
      {theoryTab === 'concept' && <div className="theory-content"><h3>最近放入的，先被取出。</h3><p>栈只在同一端添加和移除元素。这个端叫栈顶，因此最后入栈的元素会先出栈。</p><div className="stack-visual" aria-label="示意栈：栈底8，栈顶3；与当前作品无关"><div className="stack-level top">3 <span>← 栈顶</span></div><div className="stack-level">8</div><span className="stack-base">栈底 · 概念示意</span></div><p>状态推演要同时关注栈中的元素、操作的输出和边界。输出与栈当前内容是两件事。</p><h4>{isTrace ? '用动作检验概念' : '把概念用于匹配'}</h4><p>{isTrace ? '先填两次 push，再观察一次 pop。回到定义，解释为什么被取走的是最近放入的元素。' : '遇到左括号时入栈；遇到右括号时，检查栈顶是否为同种左括号。栈为空或类型不同都应拒绝。'}</p><a className="source-link" href="https://opendsa-server.cs.vt.edu/ODSA/Books/umw/cpsc340/fall-2024/CPSC340_F24/html/StackArray.html" target="_blank" rel="noreferrer">概念出处：OpenDSA · Stacks ↗</a><p className="field-note">本页解释为工程样例自写内容，教学审校尚未完成。</p></div>}
      {theoryTab === 'hint' && <div className="theory-content"><span className="small-tag">已记录提示使用</span><h3>盯住最右侧的元素。</h3><p>{isTrace ? '两次入栈后，3 在 8 的右边。执行 pop 时，只移除右侧这一项。接着请独立推演后续操作。最后一步先检查栈是否为空。' : '先为每种右括号定义对应的左括号。弹出栈顶之前，判断栈是否为空；遍历结束后再检查有没有残留。'}</p><button className="text-link" onClick={() => setTab('practice')}>带着提示回去尝试 →</button></div>}
      {theoryTab === 'answer' && <div className="theory-content"><span className="small-tag">自学答案 · 已记录查看</span><h3>{isTrace ? '对照结果，也对照原因。' : '一种参考思路。'}</h3>{isTrace ? <><ol className="answer-list">{correctRows.map((row, index) => <li key={index}><code>{traceOperations[index].label}</code><span>栈 {row.stack} · 输出 {row.output}{row.underflow ? ' · 下溢' : ''}</span></li>)}</ol><p>输出依次为 3、5、8。最后一次出栈发生下溢，不能凭空产生一个输出；栈仍为空。</p></> : <><pre className="reference-code">{'pairs = {\')\': \'(\', \']\': \'[\', \'}\': \'{\'}\nstack = []\nfor char in text:\n    if char in "([{":\n        stack.append(char)\n    elif not stack or stack.pop() != pairs[char]:\n        return False\nreturn not stack'}</pre><p>这段思路只处理本活动限定的括号输入；尚未在执行服务中运行。参考答案不替代你自己的代码测试和解释。</p></>}<p className="field-note">查看答案不会增加达标目标数。核验记录会保留此前使用的帮助。</p></div>}
      <div className="help-summary">本目标已记录 {objectiveHelp.filter(event => event.kind === 'hint').length} 次提示、{objectiveHelp.filter(event => event.kind === 'answer').length} 次答案查看。<span>助手建议不替代独立练习或核验；仅真实核验证据会更新图谱。</span></div>
    </aside>
    <section className={`result-panel mobile-${tab === 'result' ? 'shown' : 'hidden'}`} aria-labelledby="actual-result-title"><div className="panel-heading"><div><span className="eyebrow">03 / ACTUAL EVIDENCE</span><h2 id="actual-result-title">让结果说明下一步。</h2></div><Link className="text-link" to="/evidence">查看记录 ↗</Link></div>{result ? <><div className={`result-summary ${result.result.trace_correct ? 'partial' : 'consolidate'}`}><strong>{result.result.trace_correct ? '七步推演核验通过，完整目标仍待复核。' : '有步骤需要修正。'}</strong><p>{result.result.summary}</p>{latestCurrent && <p className="stale-note">这是已提交作品版本的结论；当前编辑尚未重新核验。</p>}</div><div className="criterion-results">{result.result.criteria.map(criterion => <div className="criterion-row" key={criterion.id}><span className={`criterion-icon ${criterion.status}`}>{criterion.status === 'met' ? '✓' : criterion.status === 'not_met' ? '↻' : '◌'}</span><div><strong>{criterionLabels[criterion.id] ?? criterion.id}</strong><p>{criterion.reason}</p></div><span>{criterion.status === 'met' ? '满足' : criterion.status === 'not_met' ? '未满足' : '待人工复核'}</span></div>)}</div>{!result.result.trace_correct && <div className="row-feedback">{result.result.rows.filter(row => !row.correct).map(row => <p key={row.index}>第 {row.index} 步：{row.issues.join('；')}</p>)}</div>}<div className="next-action"><p>{result.result.trace_correct ? '下一步：补充独立新条件的推演；解释等待真实人工复核。你也可以先尝试括号匹配。' : '下一步：回到不一致的步骤，查看必要原理，修改后重新核验。'}</p><Link className="text-link" to={result.result.trace_correct ? `/learn/${IMPLEMENT_OBJECTIVE}` : '/atlas'}>{result.result.trace_correct ? '尝试括号匹配 →' : '回到目标图谱 →'}</Link></div></> : <div className="result-empty"><span aria-hidden="true">◌</span><div><strong>这里等待你实际提交的作品。</strong><p>{isTrace ? '填写推演和解释后提交。没有核验时，目标保持尚未有效评估。' : '代码执行与人工复核尚未开放，当前作品保持未核验。'}</p></div></div>}</section>
    </div>{message && <div className="workspace-message" role="status"><span>{message}</span>{message.startsWith('其他设备') && <button className="text-link" onClick={reloadStoredVersion}>读取更新后的版本 →</button>}<button aria-label="关闭反馈" onClick={() => setMessage('')}>×</button></div>}
  </div>
}
