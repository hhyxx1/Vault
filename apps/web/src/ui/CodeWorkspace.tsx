import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useBlocker, useSearchParams } from 'react-router-dom'
import { liveQuery } from 'dexie'
import { useLocal } from '../local/LocalProvider'
import { database, saveCodeAttempt, saveCodeDraft } from '../local/database'
import { canonicalHash, canonicalJson } from '../domain/integrity'
import type { CodeAttempt, CodeDraft, CodeRequest, CodeResult } from '../domain/code'
import type { AtlasPackage, CourseCodeActivity, CodeVariant } from '../domain/course-packages'
import { registerIdentityFlusher } from '../local/identity'
import { runCode } from '../api/verification'

const templates: Record<CodeRequest['language'], { entry: string; source: string; label: string }> = {
  c17: { entry: 'main.c', source: '#include <stdio.h>\nint main(void) { printf("%d\\n", 2+3); return 0; }\n', label: 'C17' },
  cpp17: { entry: 'main.cpp', source: '#include <iostream>\nint main() { std::cout << 2+3 << "\\n"; }\n', label: 'C++17' },
  java21: { entry: 'Main.java', source: 'public class Main { public static void main(String[] args) { System.out.println(2+3); } }\n', label: 'Java 21' },
  python313: { entry: 'main.py', source: 'print(2+3)\n', label: 'Python 3.13' },
  node24: { entry: 'main.js', source: 'console.log(2+3);\n', label: 'JavaScript · Node 24' },
}
const statusNames = { success: '运行成功', compile_error: '编译未通过', runtime_error: '程序运行出错', timeout: '超过运行时限', resource_limit: '超过资源限制', environment_error: '运行环境暂不可用' }
function boundedResult(result: CodeResult): CodeResult {
  const cut = (value: string) => new TextDecoder().decode(new TextEncoder().encode(value).slice(0, 4096))
  const stdout = cut(result.stdout ?? ''); const stderr = cut(result.stderr ?? '')
  const metadata = Object.fromEntries(Object.entries(result.metadata ?? {}).slice(0, 32).map(([key, value]) => [key.slice(0, 100), value.slice(0, 1000)]))
  return { ...result, stdout, stderr, metadata, truncated: result.truncated || stdout !== result.stdout || stderr !== result.stderr }
}
export default function CodeWorkspace({ lesson }: { lesson?: { course: AtlasPackage; activity: CourseCodeActivity; objective: string; variant?: CodeVariant } }) {
  const { spaceId, refresh } = useLocal(); const [params] = useSearchParams()
  const task = lesson?.variant ?? lesson?.activity
  const taskCode = lesson?.variant?.code ?? 'base'
  const activityKey = lesson ? `${lesson.activity.version_id}:${taskCode}` : (params.get('activity') ?? 'independent-code-practice').slice(0, 200)
  const fromDraft = params.get('fromDraft'); const revision = params.get('revision')
  const context = `${spaceId}:${activityKey}:${fromDraft ?? ''}:${revision ?? ''}`; const currentContext = useRef(context); currentContext.current = context
  const aborter = useRef<AbortController | null>(null)
  const [request, setRequest] = useState<CodeRequest>({ language: 'python313', entry: 'main.py', files: { 'main.py': templates.python313.source }, stdin: '' })
  const [file, setFile] = useState('main.py'); const [newFilename, setNewFilename] = useState('')
  const [history, setHistory] = useState<CodeAttempt[]>([]); const [selected, setSelected] = useState<CodeAttempt | null>(null)
  const [ready, setReady] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('')
  const loaded = useRef(false)
  const [prediction, setPrediction] = useState(''); const [reflection, setReflection] = useState('')
  const [reflections, setReflections] = useState<Record<string, string>>({})
  const [helpViewed, setHelpViewed] = useState<string[]>([])
  const [saveState, setSaveState] = useState<'loading' | 'saving' | 'saved' | 'failed'>('loading')
  const baseline = useRef(''); const lastSaved = useRef(''); const queue = useRef<Promise<unknown>>(Promise.resolve())
  const learningContext = lesson ? { courseId: lesson.course.course_id, courseVersionId: lesson.course.course_version_id, activityVersionId: lesson.activity.version_id, objectiveCode: lesson.objective, taskCode, helpViewed } : null
  const value = { spaceId, activityKey, request, prediction, reflection, reflections, learningContext, viewedRevisionId: selected?.id ?? null, reflectionRevisionId: selected?.id ?? null }
  const valueRef = useRef(value); valueRef.current = value
  const snapshot = canonicalJson(value)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => currentLocation.key !== nextLocation.key && (busy || saveState !== 'saved' || snapshot !== lastSaved.current))
  const persist = useCallback(async (next: Omit<CodeDraft, 'id' | 'createdAt' | 'updatedAt'>) => {
    const captured = context
    if (currentContext.current === captured) setSaveState('saving')
    const action = queue.current.catch(() => undefined).then(() => saveCodeDraft(next, database, baseline.current))
    queue.current = action
    try {
      const saved = await action
      if (currentContext.current === captured) { baseline.current = canonicalJson(saved); lastSaved.current = canonicalJson(next); setSaveState(canonicalJson(valueRef.current) === lastSaved.current ? 'saved' : 'saving') }
    } catch (error) {
      if (currentContext.current === captured) { setSaveState('failed'); setMessage(error instanceof Error ? error.message : '草稿保存失败，当前输入仍保留，请重试。') }
      throw error
    }
  }, [context])
  useEffect(() => {
    setReady(false); setBusy(false); setSelected(null); setHistory([]); setMessage(''); loaded.current = false; setSaveState('loading'); baseline.current = ''; lastSaved.current = ''
    const subscription = liveQuery(async () => ({ rows: await database.codeAttempts.where('spaceId').equals(spaceId).toArray(), codeDraft: await database.codeDrafts.get([spaceId, await canonicalHash({ activityKey })]), draft: fromDraft ? await database.drafts.get([spaceId, fromDraft]) : undefined })).subscribe({
      next: ({ rows, draft, codeDraft }) => {
        if (currentContext.current !== context) return
        const records = rows.filter(row => row.activityKey === activityKey).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        setHistory(records)
        if (!loaded.current) {
          const last = revision ? records.find(row => row.id === revision) : codeDraft ? records.find(row => row.id === codeDraft.viewedRevisionId) : draft ? undefined : records[0]
          const next = revision && last ? last.request : codeDraft?.request ?? (draft ? { language: 'python313' as const, entry: 'main.py', files: { 'main.py': draft.code }, stdin: '' } : last?.request ?? task?.code_request ?? { language: 'python313' as const, entry: 'main.py', files: { 'main.py': templates.python313.source }, stdin: '' })
          setRequest(structuredClone(next)); setFile(next.entry); setSelected(last ?? null); setPrediction(revision && last ? last.learning?.prediction ?? '' : codeDraft?.prediction ?? last?.learning?.prediction ?? ''); setReflection(last ? codeDraft?.reflections?.[last.id] ?? (codeDraft?.reflectionRevisionId === last.id ? codeDraft.reflection : '') : codeDraft?.reflection ?? ''); setReflections({ ...codeDraft?.reflections, ...(codeDraft?.reflectionRevisionId ? { [codeDraft.reflectionRevisionId]: codeDraft.reflection } : {}) }); baseline.current = codeDraft ? canonicalJson(codeDraft) : ''; loaded.current = true
          setHelpViewed(codeDraft?.learningContext?.helpViewed ?? [])
        }
        setReady(true)
      }, error: () => setMessage('无法读取本机代码版本，请检查浏览器存储权限。'),
    })
    return () => { subscription.unsubscribe(); aborter.current?.abort() }
  }, [spaceId, activityKey, fromDraft, revision, context])
  useEffect(() => { if (!ready || !loaded.current) return; if (snapshot === lastSaved.current) { setSaveState('saved'); return } persist(valueRef.current).catch(() => undefined) }, [ready, snapshot, persist])
  useEffect(() => registerIdentityFlusher(async () => { aborter.current?.abort(); if (loaded.current) await persist(valueRef.current) }), [persist])
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (busy) { aborter.current?.abort(); return }
    persist(valueRef.current).then(() => blocker.proceed()).catch(() => blocker.reset())
  }, [blocker, busy, persist])
  useEffect(() => {
    if (!busy && saveState === 'saved' && snapshot === lastSaved.current) return
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', prevent); return () => window.removeEventListener('beforeunload', prevent)
  }, [busy, saveState, snapshot])
  const locked = !!selected || busy || !ready
  async function submit() {
    if (!ready || busy || selected?.result) return
    const captured = context; const controller = new AbortController(); aborter.current = controller
    setBusy(true); setMessage('正在保存本次代码版本…')
    try {
      await persist(valueRef.current)
      const normalized = { ...structuredClone(request), stdin: request.stdin ?? '' }
      const stamp = new Date().toISOString()
      const attempt: CodeAttempt = selected ?? { id: crypto.randomUUID(), artifactId: history[0]?.artifactId ?? crypto.randomUUID(), spaceId, activityKey, request: normalized, requestHash: await canonicalHash(normalized), result: null, resultTrust: null, createdAt: stamp, updatedAt: stamp, learning: { context: learningContext, prediction } }
      controller.signal.throwIfAborted()
      await saveCodeAttempt(attempt)
      if (currentContext.current !== captured) return
      setSelected(attempt); setMessage('这一版已保存，正在隔离环境中运行…')
      const response = await runCode(attempt, controller.signal)
      controller.signal.throwIfAborted()
      if (currentContext.current !== captured) return
      const saved = await saveCodeAttempt({ ...attempt, result: boundedResult(response.result), updatedAt: new Date().toISOString() })
      if (currentContext.current !== captured) return
      setSelected(saved); setMessage('运行结果已保存到这一版代码。'); await refresh()
      await response.acknowledge().catch(() => { if (currentContext.current === captured) setMessage('结果已保存；临时服务清理尚未确认，稍后由租约清理。') })
    } catch (error) {
      if (currentContext.current === captured) setMessage(controller.signal.aborted ? '已请求停止运行；代码版本仍保留本地。' : error instanceof Error ? error.message : '运行未完成，代码仍保留本地。')
    } finally { if (currentContext.current === captured) { setBusy(false); aborter.current = null } }
  }
  function editNew() { setSelected(null); setReflection(''); setMessage('正在编辑新版本；点击保存并运行后保留这一版。') }
  async function disclose(id: string) {
    if (!learningContext || helpViewed.includes(id)) return
    const next = [...helpViewed, id]
    try { await persist({ ...valueRef.current, learningContext: { ...learningContext, helpViewed: next } }); setHelpViewed(next) } catch { /* Saved work remains visible; no disclosure without its local record. */ }
  }
  return <div className="page code-workspace">
    <div className="eyebrow">PRACTICE / CODE & OBSERVATION</div>
    <div className="page-heading"><div><h1>{task?.title ?? '把想法运行起来。'}</h1><p>{lesson ? `${lesson.course.title} / ${lesson.course.objectives.find(goal => goal.code === lesson.objective)?.title}` : '先预测，再运行。比较结果，修改代码，用新的输入再验证。'}</p></div><Link className="text-link" to={lesson ? `/atlas?course=${lesson.course.course_code}&edition=core&goal=${lesson.objective}` : '/atlas'}>回到知识图谱 ↗</Link></div>
    {lesson && <section className="code-course-context" aria-label="课程任务">
      <div><h2>本次任务</h2><p>{task?.student_action}</p>
        <details><summary>需要时看原理与来源</summary>{lesson.activity.theory.map((text, index) => <p key={index}>{text}</p>)}<ul>{lesson.course.sources?.filter(source => lesson.activity.source_refs.includes(source.id)).map(source => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a><span>：{source.locator}</span></li>)}</ul></details>
      </div>
      <aside><span className="small-tag">实践可用 · 目标评估待建设</span><details><summary>本活动的核验范围</summary><p className="muted">{lesson.activity.completion_limit}</p></details>
        <div className="code-course-help">{lesson.activity.hints?.map((hint, index) => <div key={index}>{helpViewed.includes(`hint-${index+1}`) ? <p>{hint}</p> : <button className="button secondary" onClick={() => disclose(`hint-${index+1}`)} disabled={!ready || busy}>查看提示 {index+1}</button>}</div>)}{lesson.activity.reference_answer && <div>{helpViewed.includes('answer') ? <><p>参考答案只供本活动自学对照，下一次运行仍使用你的作品。</p><pre>{Object.values(lesson.activity.reference_answer.files).join('\n')}</pre></> : <button className="button secondary" onClick={() => disclose('answer')} disabled={!ready || busy}>查看参考答案</button>}</div>}</div>
        <nav aria-label="新条件练习">{lesson.activity.variants?.map(variant => <Link key={variant.code} to={`/learn/${lesson.objective}?courseVersion=${lesson.course.course_version_id}&task=${variant.code}`}>新条件：{variant.title}</Link>)}{lesson.variant && <Link to={`/learn/${lesson.objective}?courseVersion=${lesson.course.course_version_id}`}>返回基础任务</Link>}</nav>
      </aside>
    </section>}
    <div className="code-practice-layout">
      <section className="code-practice-editor" aria-label="代码实践">
        <div className="code-practice-toolbar"><label>运行语言<select aria-label="运行语言" disabled={locked} value={request.language} onChange={event => { const language = event.target.value as CodeRequest['language']; const item = templates[language]; setRequest({ language, entry: item.entry, files: { [item.entry]: item.source }, stdin: '' }); setFile(item.entry) }}>{Object.entries(templates).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></label>
          <label>编辑文件<select aria-label="编辑文件" disabled={busy} value={file} onChange={event => setFile(event.target.value)}>{Object.keys(request.files).map(name => <option key={name}>{name}</option>)}</select></label>
          <label>执行入口<select aria-label="执行入口" disabled={locked} value={request.entry} onChange={event => setRequest({ ...request, entry: event.target.value })}>{Object.keys(request.files).map(name => <option key={name}>{name}</option>)}</select></label></div>
        <label className="code-source-label">代码源文件<textarea aria-label="代码源文件" spellCheck={false} disabled={locked} value={request.files[file] ?? ''} onChange={event => setRequest({ ...request, files: { ...request.files, [file]: event.target.value } })}/></label>
        {!locked && <div className="code-file-actions"><input aria-label="新源文件名" placeholder="例如 helpers.py" value={newFilename} onChange={event => setNewFilename(event.target.value)}/><button className="button secondary" onClick={() => { if (!/^[A-Za-z_][A-Za-z0-9_]{0,50}\.(c|cpp|h|hpp|java|py|js)$/.test(newFilename) || newFilename in request.files || Object.keys(request.files).length >= 8) { setMessage('请输入未重复的平面源文件名，最多 8 个文件。'); return } setRequest({ ...request, files: { ...request.files, [newFilename]: '' } }); setFile(newFilename); setNewFilename('') }}>添加源文件</button>{file !== request.entry && <button className="text-link" onClick={() => { const files = { ...request.files }; delete files[file]; setRequest({ ...request, files }); setFile(request.entry) }}>移除此文件</button>}</div>}
        <label>标准输入<textarea aria-label="标准输入" disabled={locked} value={request.stdin ?? ''} onChange={event => setRequest({ ...request, stdin: event.target.value })}/></label>
        <label>运行前预测<textarea aria-label="运行前预测" placeholder={task?.prediction_prompt} maxLength={4000} disabled={locked} value={prediction} onChange={event => setPrediction(event.target.value)}/></label>
        <div className="code-run-actions">{!selected?.result && <button className="button primary" disabled={!ready || busy} onClick={submit}>{busy ? '正在运行…' : '保存并运行这一版'}</button>}{busy && <button className="button secondary" onClick={() => aborter.current?.abort()}>停止运行</button>}{selected && !busy && <button className="button secondary" onClick={editNew}>修改并开始新版本</button>}</div>
        <p role="status" aria-live="polite">{message || (selected ? '正在查看已保存版本。' : '当前编辑尚未保存。')}</p>
        <p role="status">{saveState === 'saved' ? '草稿已保存到本机。' : saveState === 'failed' ? '草稿尚未保存，请保留当前页面。' : '正在保存草稿…'}</p>
      </section>
      <aside className="code-practice-inspector">
        <section><span className="eyebrow">OBSERVE / RESULT</span><h2>{selected?.result ? statusNames[selected.result.status] : '先写下你的预测'}</h2>
          {selected?.result ? <><h3>标准输出</h3><pre aria-label="标准输出">{selected.result.stdout || '（无输出）'}</pre><h3>错误输出</h3><pre aria-label="错误输出">{selected.result.stderr || '（无错误输出）'}</pre>{selected.result.truncated && <p>输出已截断，已保存可显示的部分。</p>}<p>{selected.resultTrust ? '此记录来自账号恢复，需重新运行复核。' : selected.result.status === 'environment_error' ? '执行服务未完成本次运行，不计为能力错误。可开始新版本重新尝试。' : '这是该版本的实际工具结果。'}</p></> : <p>输入改变后会得到什么？结果与你预测的一致吗？先运行，再根据差异修改。</p>}
          <p className="muted">运行成功表示程序在这组输入下完成；课程目标还需要测试条件、解释和独立验证。</p>
          <label>运行后解释与下一步<textarea aria-label="运行后解释与下一步" placeholder={task?.reflection_prompt} maxLength={4000} disabled={!ready || busy} value={reflection} onChange={event => { const text = event.target.value; setReflection(text); if (selected) setReflections(previous => ({ ...previous, [selected.id]: text })) }}/></label>
        </section>
        <section><span className="eyebrow">VERSIONS / YOUR WORK</span><h2>已保存的尝试</h2>{history.length ? <ol className="code-version-list">{history.map((row, index) => <li key={row.id}><button disabled={busy} aria-pressed={selected?.id === row.id} onClick={() => { setSelected(row); setRequest(structuredClone(row.request)); setFile(row.request.entry); setPrediction(row.learning?.prediction ?? ''); setReflection(reflections[row.id] ?? ''); setMessage('正在查看已保存版本。') }}>{templates[row.request.language].label} · 第 {history.length-index} 版<span>{row.result ? statusNames[row.result.status] : '已保存 · 未取得结果'}</span></button></li>)}</ol> : <p>保存后可回来查看代码和运行结果。</p>}</section>
      </aside>
    </div>
  </div>
}
