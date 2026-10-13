import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom'
import { liveQuery } from 'dexie'
import { useLocal } from '../local/LocalProvider'
import { confirmPersonalCourseScope, database, deletePersonalCourse, recordPersonalAttempt, savePersonalCourse } from '../local/database'
import { canonicalJson } from '../domain/integrity'
import { personalCourseMap, type ObjectiveState } from '../domain/course-map'
import { PERSONAL_EVIDENCE_LABELS, type PersonalAssist, type PersonalAttempt, type PersonalCourse, type PersonalCourseVersion, type PersonalEvidenceKind, type PersonalTopic } from '../domain/personal'
import type { CourseDiscoveryProposal } from '../api/verification'
import KnowledgeGraph from './KnowledgeGraph'
import PersonalAssistant from './PersonalAssistant'
import PersonalCoursePlanner from './PersonalCoursePlanner'

const emptyAttempt = { learningQuestion: '', theoryNote: '', action: '', observation: '', reflection: '', nextStep: '', evidenceKinds: [] as PersonalEvidenceKind[] }
type AttemptInput = typeof emptyAttempt
type AttemptTextField = 'learningQuestion' | 'theoryNote' | 'action' | 'observation' | 'reflection' | 'nextStep'
const noVerifiedPersonalEvidence = new Map<string, ObjectiveState>()

function errorText(error: unknown, fallback: string) { return error instanceof Error ? error.message : fallback }

function PersonalCourseList({ courses, spaceId }: { courses: PersonalCourse[]; spaceId: string }) {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [goal, setGoal] = useState('')
  const [topicTitle, setTopicTitle] = useState('')
  const [performance, setPerformance] = useState('')
  const [suggestedTopics, setSuggestedTopics] = useState<PersonalTopic[]>([])
  const [proposalDetails, setProposalDetails] = useState<CourseDiscoveryProposal | null>(null)
  const [busy, setBusy] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [message, setMessage] = useState('')
  const navigatingToSavedCourse = useRef(false)
  const unfinishedForm = [title, goal, topicTitle, performance].some(value => value.trim()) || suggestedTopics.length > 0
  const blocker = useBlocker(({ currentLocation, nextLocation }) => unfinishedForm && !navigatingToSavedCourse.current && currentLocation.pathname !== nextLocation.pathname)
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm('课程信息尚未保存。离开后当前输入会丢失，确定离开吗？')) blocker.proceed()
    else blocker.reset()
  }, [blocker])
  useEffect(() => {
    if (!unfinishedForm) return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [unfinishedForm])

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setMessage('')
    try {
      if (!suggestedTopics.length && !!topicTitle.trim() !== !!performance.trim()) throw new Error('第一个学习点的名称与可观察表现需要一起填写，也可以暂时都留空。')
      if (suggestedTopics.some(topic => !topic.title.trim() || !topic.expectedPerformance.trim())) throw new Error('请补齐 AI 学习路线中每个学习点的名称和可观察表现。')
      const now = new Date().toISOString()
      const course: PersonalCourse = {
        id: crypto.randomUUID(), spaceId, title: title.trim(), goal: goal.trim(),
        topics: suggestedTopics.length ? suggestedTopics : topicTitle.trim() ? [{ id: crypto.randomUUID(), title: topicTitle.trim(), expectedPerformance: performance.trim() }] : [],
        createdAt: now, updatedAt: now,
        ...(proposalDetails ? { creationMethod: 'ai_assisted' as const, contentReviewStatus: 'unreviewed_ai_draft' as const } : {}),
      }
      await savePersonalCourse(course, null)
      navigatingToSavedCourse.current = true
      navigate(`/my-courses/${course.id}`)
    } catch (error) { setMessage(errorText(error, '课程未保存，请检查浏览器存储后重试。')) }
    finally { setBusy(false) }
  }

  async function remove(course: PersonalCourse) {
    if (!window.confirm(`删除“${course.title}”以及该课程的范围、尝试和 AI 建议？删除会同步到你的账号，无法撤销。`)) return
    setDeletingId(course.id); setMessage('')
    try {
      const result = await deletePersonalCourse(spaceId, course.id, canonicalJson(course))
      setMessage(result.cloudTombstones ? `“${course.title}”已从本地移除，删除记录将在同步后从账号移除。` : `“${course.title}”及其本地学习记录已删除。`)
    } catch (error) { setMessage(errorText(error, '课程未删除，请先检查同步状态后重试。')) }
    finally { setDeletingId('') }
  }

  return <div className="page personal-page"><div className="eyebrow">PERSONAL / LEARNING PATH</div>
    <div className="page-heading"><div><h1>从你要学的课程开始。</h1><p>不限于 13 门默认课程。先定一个真实目标，再把原理、实践和结果逐次连起来。</p></div><span className="small-tag">个人课程 · 自建范围</span></div>
    <div className="personal-boundary"><span className="status-dot"/><p>这是你的私人学习空间。你可以先说出课程名称和困惑，让 AI 提议目标与学习路线，也可以手动建立；所有草案都要由你确认，且未经教研审校。学习记录可以包含推演、解释、图示、代码或外部实操；自述仍会明确标为未核验。</p></div>
    <div className="personal-layout"><section className="personal-create" aria-labelledby="personal-create-title"><span className="eyebrow">01 / START</span><h2 id="personal-create-title">建立自己的课程</h2><p>只写课程名称即可开始；目标和学习点会保持“待确认”，不会自动假定你已经选好范围。也可以现在填上一个具体实践。</p>
      <form onSubmit={create} className="personal-form">
        <label htmlFor="personal-title">课程名称</label><input id="personal-title" required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} placeholder="例如：操作系统、编译原理、分布式系统"/>
        <label htmlFor="personal-goal">你想做到什么（可稍后确定）</label><textarea id="personal-goal" maxLength={2000} rows={3} value={goal} onChange={event => setGoal(event.target.value)} placeholder="例如：能解释进程调度，并用一段模拟程序比较不同策略。"/>
        <PersonalCoursePlanner courseName={title} goal={goal} onDraft={proposal => {
          setTitle(proposal.title); setGoal(proposal.goal); setProposalDetails(proposal)
          setSuggestedTopics(proposal.topics.map(topic => ({ id: crypto.randomUUID(), title: topic.title, expectedPerformance: topic.expected_performance })))
          setTopicTitle(''); setPerformance('')
        }}/>
        {proposalDetails && <section className="course-proposal-editor" aria-label="AI 建议学习路线编辑器">
          <div className="section-heading"><div><span className="eyebrow">AI SUGGESTION / YOUR DECISION</span><h3>AI 建议的学习路线 · 待确认</h3></div><button type="button" className="text-link" onClick={() => { setProposalDetails(null); setSuggestedTopics([]) }}>改为手动建立</button></div>
          <p>请编辑或删除任何不合适的学习点。确认保存后仍会标为个人草案，不能当作完整、审校过的课程。</p>
          <div className="course-proposal-list">{suggestedTopics.map((topic, index) => <fieldset className="course-proposal-topic" key={topic.id}>
            <legend>学习点 {index + 1}</legend>
            <label htmlFor={`proposal-title-${topic.id}`}>学习点名称</label><input id={`proposal-title-${topic.id}`} aria-label={`AI 建议学习点 ${index + 1} 名称`} maxLength={120} value={topic.title} onChange={event => setSuggestedTopics(current => current.map(item => item.id === topic.id ? { ...item, title: event.target.value } : item))}/>
            <label htmlFor={`proposal-performance-${topic.id}`}>可观察的表现</label><textarea id={`proposal-performance-${topic.id}`} aria-label={`AI 建议学习点 ${index + 1} 表现`} rows={2} maxLength={500} value={topic.expectedPerformance} onChange={event => setSuggestedTopics(current => current.map(item => item.id === topic.id ? { ...item, expectedPerformance: event.target.value } : item))}/>
            <button type="button" className="text-link" onClick={() => setSuggestedTopics(current => current.filter(item => item.id !== topic.id))}>删除学习点 {index + 1}</button>
          </fieldset>)}</div>
          <button type="button" className="text-link" onClick={() => setSuggestedTopics(current => [...current, { id: crypto.randomUUID(), title: '', expectedPerformance: '' }])}>＋ 添加学习点</button>
          <div className="course-first-task"><strong>AI 首项实践</strong><p>{proposalDetails.first_task}</p><small>路线依据的假设：{proposalDetails.assumptions.length ? proposalDetails.assumptions.join('；') : '尚未提供'}。</small></div>
        </section>}
        {!proposalDetails && <><label htmlFor="personal-first-topic">第一个学习点（可稍后确定）</label><input id="personal-first-topic" maxLength={120} value={topicTitle} onChange={event => setTopicTitle(event.target.value)} placeholder="例如：先来先服务调度"/>
        <label htmlFor="personal-performance">怎样展示这个学习点（与学习点一起填写）</label><textarea id="personal-performance" maxLength={500} rows={3} value={performance} onChange={event => setPerformance(event.target.value)} placeholder="推演、画图、解释、编程、模拟器实操等都可以。"/></>}
        <button className="button primary" disabled={busy || !spaceId}>{busy ? '正在保存…' : '创建个人课程'} <span aria-hidden="true">↗</span></button>
      </form>{message && <p className="inline-message" role="status">{message}</p>}
    </section><section className="personal-saved" aria-labelledby="personal-saved-title"><span className="eyebrow">02 / CONTINUE</span><h2 id="personal-saved-title">继续你的课程</h2>{courses.length ? <div className="personal-course-list">{courses.map(course => <div className="personal-course-item" key={course.id}><Link className="personal-course-row" to={`/my-courses/${course.id}`}><span className="course-number">{String(course.topics.length).padStart(2, '0')}</span><span><strong>{course.title}</strong><small>{course.goal || '探索目标待确认'}</small><em>{course.topics.length} 个自定学习点 · {course.creationMethod === 'ai_assisted' ? 'AI 草案待核对' : '尚未审校'}</em></span><span aria-hidden="true">↗</span></Link><button type="button" className="personal-course-delete" aria-label={`删除课程 ${course.title}`} disabled={busy || deletingId === course.id} onClick={() => remove(course)}>{deletingId === course.id ? '正在删除…' : '删除'}</button></div>)}</div> : <div className="personal-empty"><span aria-hidden="true">◌</span><p>还没有个人课程。可以让 AI 帮你梳理，也可以只写课程名开始。</p></div>}<p className="field-note">课程与记录先保存在此浏览器；登录后才会同步到本人账号。AI 规划使用前会先征得同意；模型不可用时仍可手动建立。</p></section></div>
    <div className="personal-catalog-link"><Link className="text-link" to="/atlas">查看 13 门默认课程的建设状态 →</Link></div>
  </div>
}

function scopeMatchesCourse(course: PersonalCourse, scope?: PersonalCourseVersion) {
  return !!scope && scope.title === course.title && scope.goal === course.goal && canonicalJson(scope.topics) === canonicalJson(course.topics)
}

function CourseDetail({ course, attempts, assists, scopeVersions, spaceId }: { course: PersonalCourse; attempts: PersonalAttempt[]; assists: PersonalAssist[]; scopeVersions: PersonalCourseVersion[]; spaceId: string }) {
  const [editTitle, setEditTitle] = useState(course.title)
  const [editGoal, setEditGoal] = useState(course.goal)
  const [formBaseline, setFormBaseline] = useState(() => canonicalJson(course))
  const pendingWrite = useRef<string | null>(null)
  const [topicTitle, setTopicTitle] = useState('')
  const [performance, setPerformance] = useState('')
  const [topicId, setTopicId] = useState(course.topics[0]?.id ?? '')
  const [attemptInput, setAttemptInput] = useState<AttemptInput>(emptyAttempt)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const workRef = useRef<HTMLElement>(null)
  const latestScope = scopeVersions.at(-1)
  const currentScopeMatches = scopeMatchesCourse(course, latestScope)
  const selectedTopic = course.topics.find(topic => topic.id === topicId) ?? course.topics[0]
  const canPractice = !!latestScope && currentScopeMatches && latestScope.topics.some(topic => topic.id === selectedTopic?.id)
  const selectedAttempts = selectedTopic ? attempts.filter(attempt => attempt.topicId === selectedTopic.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : []
  const attemptedTopics = latestScope?.topics.filter(topic => attempts.some(attempt => attempt.scopeVersionId === latestScope.id && attempt.topicId === topic.id)).length ?? 0
  const nextScopeVersion = (latestScope?.version ?? 0) + 1
  const scopeDenominator = latestScope?.topics.length ? latestScope.topics.length : '—'
  const scopeCountCaption = !latestScope ? '尚无已确认范围' : latestScope.topics.length ? `v${latestScope.version} 范围内有自述尝试` : `v${latestScope.version} 尚未定义学习点`
  const courseMap = useMemo(() => personalCourseMap(course), [course])

  useEffect(() => {
    const currentJson = canonicalJson(course)
    if (pendingWrite.current) {
      if (currentJson !== pendingWrite.current) return
      pendingWrite.current = null
    }
    if (currentJson === formBaseline) return
    const previous = JSON.parse(formBaseline) as PersonalCourse
    if (editTitle === previous.title && editGoal === previous.goal) {
      setEditTitle(course.title); setEditGoal(course.goal); setFormBaseline(currentJson)
    }
  }, [course, formBaseline, editTitle, editGoal])
  const courseFormBaseline = JSON.parse(formBaseline) as PersonalCourse
  const unfinishedCourse = editTitle !== courseFormBaseline.title || editGoal !== courseFormBaseline.goal
  const unfinishedTopic = !!topicTitle.trim() || !!performance.trim()
  const unfinishedAttempt = Object.values(attemptInput).some(value => Array.isArray(value) ? value.length > 0 : value.trim().length > 0)
  const hasUnstoredInput = unfinishedCourse || unfinishedTopic || unfinishedAttempt
  function selectTopic(nextTopicId: string) {
    if (selectedTopic?.id === nextTopicId) return
    if (unfinishedAttempt && !window.confirm('这次尝试尚未保存，切换学习点会丢失当前输入。确定切换吗？')) return
    setTopicId(nextTopicId)
    setAttemptInput(emptyAttempt)
    setMessage('')
  }
  function continuePractice() {
    if (!canPractice) { setMessage('先确认当前学习范围；修改后的范围会生成新版本，旧尝试仍保留原版本。'); return }
    const work = workRef.current
    if (!work) return
    work.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
    work.focus({ preventScroll: true })
  }
  function retryFromAdvice(nextAction: string) {
    if (unfinishedAttempt && !window.confirm('当前还有未保存的尝试输入。用助手建议开始新尝试会替换这些输入，确定继续吗？')) return
    setAttemptInput({ ...emptyAttempt, learningQuestion: nextAction })
    continuePractice()
  }
  const blocker = useBlocker(({ currentLocation, nextLocation }) => hasUnstoredInput && currentLocation.pathname !== nextLocation.pathname)
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm('还有未保存的课程修改、学习点或学习尝试。离开后当前输入会丢失，确定离开吗？')) blocker.proceed()
    else blocker.reset()
  }, [blocker])
  useEffect(() => {
    if (!hasUnstoredInput) return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [hasUnstoredInput])

  async function updateCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setMessage('')
    try {
      const updated = { ...course, title: editTitle.trim(), goal: editGoal.trim(), updatedAt: new Date().toISOString() }
      await savePersonalCourse(updated, formBaseline)
      pendingWrite.current = canonicalJson(updated)
      setFormBaseline(pendingWrite.current)
      setMessage('课程目标已保存。原有尝试仍保留在对应学习点。')
    } catch (error) { setMessage(errorText(error, '课程目标未保存，请重试。')) }
    finally { setBusy(false) }
  }
  async function confirmScope() {
    if (busy) return
    if (unfinishedCourse || unfinishedTopic || unfinishedAttempt || pendingWrite.current) {
      setMessage('请先保存课程目标、学习点和当前尝试，再确认范围。')
      return
    }
    setBusy(true); setMessage('')
    try {
      const scope = await confirmPersonalCourseScope(spaceId, course.id, canonicalJson(course))
      setMessage(`已确认学习范围 v${scope.version}。这只代表你明确选择的范围；之后新增或修改范围时，需要确认一个新版本。`)
    } catch (error) { setMessage(errorText(error, '范围未确认，请重新打开课程后重试。')) }
    finally { setBusy(false) }
  }
  async function addTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    if (unfinishedCourse) { setMessage('课程名称或目标尚未保存，请先保存课程修改，再添加学习点。'); return }
    if (pendingWrite.current) { setMessage('课程修改正在刷新，请稍候再添加学习点。'); return }
    if (unfinishedAttempt) { setMessage('本次学习尝试尚未保存，请先保存尝试，再添加学习点。'); return }
    if (course.topics.length >= 64) { setMessage('单门课程最多可建立 64 个学习点。请拆分课程范围。'); return }
    setBusy(true); setMessage('')
    try {
      const topic: PersonalTopic = { id: crypto.randomUUID(), title: topicTitle.trim(), expectedPerformance: performance.trim() }
      await savePersonalCourse({ ...course, topics: [...course.topics, topic], updatedAt: new Date().toISOString() }, canonicalJson(course))
      setTopicTitle(''); setPerformance(''); setTopicId(topic.id); setAttemptInput(emptyAttempt)
      setMessage('学习点已加入个人课程；目前没有核验标准或先修关系。')
    } catch (error) { setMessage(errorText(error, '学习点未保存，请重试。')) }
    finally { setBusy(false) }
  }
  async function saveAttempt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !selectedTopic) return
    if (!attemptInput.evidenceKinds.length) { setMessage('请先选择一种实际留下的证据形式，例如推演、解释、图示、代码或外部工具记录。'); return }
    setBusy(true); setMessage('')
    try {
      if (!latestScope || !currentScopeMatches) throw new Error('课程范围尚未确认或已有修改，请先确认当前学习范围。')
      const attempt: PersonalAttempt = { id: crypto.randomUUID(), spaceId, courseId: course.id, topicId: selectedTopic.id, scopeVersionId: latestScope.id,
        learningQuestion: attemptInput.learningQuestion.trim(), theoryNote: attemptInput.theoryNote.trim(), action: attemptInput.action.trim(),
        observation: attemptInput.observation.trim(), reflection: attemptInput.reflection.trim(), nextStep: attemptInput.nextStep.trim(), evidenceKinds: attemptInput.evidenceKinds, createdAt: new Date().toISOString() }
      await recordPersonalAttempt(attempt)
      setAttemptInput(emptyAttempt)
      setMessage('这次尝试已保存。它是自述记录，尚未核验；可以根据结果再尝试一次。')
    } catch (error) { setMessage(errorText(error, '这次尝试未保存，输入已保留，请重试。')) }
    finally { setBusy(false) }
  }
  function attemptField(key: AttemptTextField, label: string, placeholder: string, rows = 3) {
    return <><label htmlFor={`personal-${key}`}>{label}</label><textarea id={`personal-${key}`} required disabled={busy || !canPractice} maxLength={key === 'learningQuestion' ? 1200 : 4000} rows={rows} value={attemptInput[key]} onChange={event => setAttemptInput(current => ({ ...current, [key]: event.target.value }))} placeholder={placeholder}/></>
  }

  return <div className="page personal-page"><div className="eyebrow">PERSONAL / {course.title}</div><div className="personal-return"><Link className="text-link" to="/my-courses">← 返回个人课程</Link><span className="small-tag">{course.creationMethod === 'ai_assisted' ? 'AI 协助生成 · 学生已确认初稿 · 未经教研审校' : '个人自建 · 未经审校'}</span></div><div className="page-heading"><div><h1>{course.title}</h1><p>{course.goal || '探索目标待确认。先想一想：学完之后，你希望能解释或做出什么？'}</p></div><div className="personal-count"><strong>{attemptedTopics}<span> / {scopeDenominator}</span></strong><small>{scopeCountCaption}<br/>0 项完成独立核验</small></div></div>
    <div className="personal-boundary"><span className="status-dot"/><p>下面是你自己提出的课程范围，尚非完整课程知识图谱。未做过的学习点标为“待尝试”；做过的只标为“有自述尝试”，不会自动判定掌握。已保存尝试可按次请求有限的 AI 建议；理论资料、实践标准、先修关系和完整辅导仍需建设与审校。</p></div>
    <section className={`personal-scope-ledger ${latestScope && !currentScopeMatches ? 'changed' : ''}`} aria-label="个人课程学习范围确认">
      <div className="personal-scope-copy"><span className="eyebrow">学习范围版本</span>
        <strong>{!latestScope ? '尚未确认' : currentScopeMatches ? `已确认 v${latestScope.version}` : `当前修改尚未确认 · 上次为 v${latestScope.version}`}</strong>
        <p>{!latestScope ? '确认后开始记录与这一范围关联的学习尝试。只写课程名也可以确认一个待补全的探索范围。' : currentScopeMatches ? latestScope.gaps.length ? `当前已确认的范围仍待补充：${latestScope.gaps.map(gap => gap === 'goal' ? '学习目标' : '学习点').join('、')}。统计只覆盖已定义的学习点。` : `统计覆盖 v${latestScope.version} 中定义的 ${latestScope.topics.length} 个学习点，不代表整门学科的掌握度。` : '范围变化不会改写旧尝试；确认后会新增版本，后续尝试将关联新版本。'}</p>
      </div>
      <button type="button" className="button secondary" onClick={confirmScope} disabled={busy || unfinishedCourse || unfinishedTopic || unfinishedAttempt || !!pendingWrite.current}>{busy ? '正在确认…' : `确认当前范围 v${nextScopeVersion}`}</button>
      {scopeVersions.length > 0 && <details className="personal-scope-history"><summary>范围历史 · {scopeVersions.length} 个版本</summary><ol>{[...scopeVersions].reverse().map(scope => <li key={scope.id}><strong>v{scope.version} · {scope.scopeStatus === 'defined' ? `${scope.topics.length} 个学习点` : `待补充 ${scope.gaps.map(gap => gap === 'goal' ? '目标' : '学习点').join('、')}`}</strong><span>{scope.title} — {scope.goal || '目标待补充'}</span><small>{scope.topics.map(topic => topic.title).join('、') || '尚未定义学习点'} · {new Date(scope.confirmedAt).toLocaleString('zh-CN')}</small></li>)}</ol></details>}
    </section>
    <section className="personal-map-section" aria-labelledby="personal-map-title"><div className="section-heading"><div><span className="eyebrow">PERSONAL / COURSE MAP</span><h2 id="personal-map-title">你的课程知识图谱</h2></div><span>{course.topics.length} 个学习点</span></div>{course.topics.length ? <div className="personal-map-content"><div className="atlas-map personal-map-visual"><KnowledgeGraph definition={courseMap} states={noVerifiedPersonalEvidence} selected={selectedTopic?.id ?? ''} onSelect={selectTopic} coordinateLabel="个人课程草稿" showCollapseControls={false}/><div className="graph-legend"><span><i className="legend-dot unknown"/>尚未有效评估</span></div><p className="graph-relation">课程包含学习点；图中只呈现你明确添加的范围，不推断章节或先修关系。自述尝试不会自动转成达标证据。</p></div><aside className="personal-map-inspector" aria-label="所选学习点" aria-live="polite">{selectedTopic ? <><span className="eyebrow">当前学习点 / 个人课程</span><p className="personal-map-title">{selectedTopic.title}</p><span className="evidence-pill unknown">尚未有效评估</span><p className="personal-map-performance"><strong>预期表现</strong>{selectedTopic.expectedPerformance}</p><p className="personal-map-evidence">{selectedAttempts.length} 次自述尝试 · 尚无核验</p><button type="button" className="button primary" onClick={continuePractice}>继续实践 <span aria-hidden="true">↗</span></button></> : <><p className="personal-map-title">选择一个学习点</p><p>从课程范围中选择目标，再进入实践并记录结果。</p></>}</aside></div> : <p className="personal-map-empty">添加第一个学习点后，图谱会按你定义的范围展示课程与目标；结构和状态不会由系统擅自补全。</p>}</section>
     <div className="personal-detail-layout"><section className="personal-topics" aria-labelledby="personal-topics-title"><div className="section-heading"><div><span className="eyebrow">PROVISIONAL / MAP</span><h2 id="personal-topics-title">你的学习点</h2></div><span>{course.topics.length} 个</span></div><div className="personal-topic-list">{course.topics.map((topic, index) => { const count = attempts.filter(attempt => attempt.topicId === topic.id).length; return <button type="button" key={topic.id} className={`personal-topic ${selectedTopic?.id === topic.id ? 'selected' : ''}`} onClick={() => selectTopic(topic.id)} aria-pressed={selectedTopic?.id === topic.id}><span className="course-number">{String(index + 1).padStart(2, '0')}</span><span><strong>{topic.title}</strong><small>{topic.expectedPerformance}</small><em>{count ? `${count} 次自述尝试 · 未核验` : '待尝试'}</em></span></button> })}</div>{!course.topics.length && <p className="field-note">还没有学习点。先确定一个想理解的问题，以及能亲手尝试的动作。</p>}
      <details className="personal-add-topic" open={!course.topics.length}><summary>＋ 加入下一个学习点</summary><form className="personal-form" onSubmit={addTopic}><label htmlFor="personal-topic-title">学习点名称</label><input id="personal-topic-title" required maxLength={120} value={topicTitle} onChange={event => setTopicTitle(event.target.value)} placeholder="例如：虚拟内存与缺页处理"/><label htmlFor="personal-topic-performance">想完成的实践或可观察表现</label><textarea id="personal-topic-performance" required maxLength={500} value={performance} onChange={event => setPerformance(event.target.value)} rows={3} placeholder="例如：模拟页面置换并解释缺页次数。"/><button className="button secondary" disabled={busy}>保存学习点</button></form></details>
      <details className="personal-edit" open={!course.goal}><summary>调整课程名称与目标</summary><form className="personal-form" onSubmit={updateCourse}><label htmlFor="personal-edit-title">课程名称</label><input id="personal-edit-title" required maxLength={120} value={editTitle} onChange={event => setEditTitle(event.target.value)}/><label htmlFor="personal-edit-goal">学习目标</label><textarea id="personal-edit-goal" maxLength={2000} rows={3} value={editGoal} onChange={event => setEditGoal(event.target.value)} placeholder="学习后想解释、构建或解决什么？"/><button className="button secondary" disabled={busy}>保存课程目标</button></form></details>
    </section><section ref={workRef} className="personal-work" aria-labelledby="personal-work-title" tabIndex={-1}><span className="eyebrow">ACTIVE / PRACTICE LOOP</span>{selectedTopic ? <><h2 id="personal-work-title">{selectedTopic.title}</h2><p className="personal-performance">想做出来：{selectedTopic.expectedPerformance}</p><p className="field-note">把读到的原理带进操作，写下实际结果，再判断哪里需要修正。这里保存的是你的原始学习记录；暂时没有针对该课程的自动核验。</p>
      <p><Link className="text-link" to={`/code?activity=${encodeURIComponent(`personal:${course.id}:${selectedTopic.id}`)}`}>打开这个学习点的代码实验 ↗</Link></p>
      <form className="personal-form personal-attempt-form" onSubmit={saveAttempt}>
        {!canPractice && <p className="field-note">确认当前学习范围后，才能保存与该版本绑定的尝试记录。</p>}
        <fieldset className="personal-evidence-kinds" disabled={busy || !canPractice}><legend>这次学习留下了哪些证据？（可多选）</legend><p>选择你实际做过的形式；这里只记录你的自述，不代表平台已自动验证。</p><div>{(Object.entries(PERSONAL_EVIDENCE_LABELS) as [PersonalEvidenceKind, string][]).map(([kind, label]) => <label key={kind}><input type="checkbox" checked={attemptInput.evidenceKinds.includes(kind)} onChange={event => setAttemptInput(current => ({ ...current, evidenceKinds: event.target.checked ? [...current.evidenceKinds, kind] : current.evidenceKinds.filter(item => item !== kind) }))}/>{label}</label>)}</div></fieldset>
        {attemptField('learningQuestion', '这次想解决什么问题', '先写一个具体的问题，避免只记录“看完一章”。', 2)}
        {attemptField('theoryNote', '依据的概念或原理', '写下你认为相关的定义、关系或推理；可以注明来源。')}
        {attemptField('action', '亲手做了什么', '描述实验、代码、配置、推演或设计；如使用外部工具，请记录操作与条件。')}
        {attemptField('observation', '实际出现了什么结果', '记录输出、错误、行为或可复现的观察，不要把预期结果当成已发生结果。')}
        {attemptField('reflection', '结果说明了什么', '比较预期与实际；哪些理解得到支持，哪些仍有疑问？')}
        {attemptField('nextStep', '下一次怎么改或继续验证', '给出一个改变条件、修正方法或补充证据的下一步。')}
        <button className="button primary" disabled={busy || !canPractice}>{busy ? '正在保存…' : '保存这次尝试，继续学习'} <span aria-hidden="true">↗</span></button>
      </form>
      <div className="personal-attempts"><div className="section-heading"><h3>已保存的尝试</h3><span>{selectedAttempts.length} 次 · 自述未核验</span></div>{selectedAttempts.length ? selectedAttempts.map((attempt, index) => <details key={attempt.id} className="personal-attempt"><summary><strong>尝试 {selectedAttempts.length - index} · {attempt.learningQuestion}</strong><span>{attempt.scopeVersionId ? `范围 v${scopeVersions.find(scope => scope.id === attempt.scopeVersionId)?.version ?? '未知'} · ` : ''}{new Date(attempt.createdAt).toLocaleString('zh-CN')}</span></summary><dl><dt>证据形式</dt><dd>{(attempt.evidenceKinds ?? ['explanation']).map(kind => PERSONAL_EVIDENCE_LABELS[kind]).join('、')}</dd><dt>依据的原理</dt><dd>{attempt.theoryNote}</dd><dt>实际操作</dt><dd>{attempt.action}</dd><dt>观察到的结果</dt><dd>{attempt.observation}</dd><dt>目前的理解</dt><dd>{attempt.reflection}</dd><dt>下一次行动</dt><dd>{attempt.nextStep}</dd></dl></details>) : <p className="field-note">这个学习点还没有尝试记录。先动手一次，再记录真实结果。</p>}</div></> : <><h2 id="personal-work-title">先建立一个可做的学习点。</h2><p>当前课程还没有确认的实践目标。你可以先写下探索目标与第一个学习点；系统不会把空白课程算作已学习。</p></>}
      {selectedTopic && <PersonalAssistant key={`${spaceId}:${selectedTopic.id}`} spaceId={spaceId} scope={latestScope} topic={selectedTopic} attempt={selectedAttempts.find(item => item.scopeVersionId === latestScope?.id)} history={assists.filter(item => item.topicId === selectedTopic.id)} enabled={canPractice} onRetry={retryFromAdvice}/>}
      {message && <p className="inline-message" role="status">{message}</p>}
    </section></div>
  </div>
}

export default function PersonalCourses() {
  const { courseId } = useParams()
  const { spaceId } = useLocal()
  const [courses, setCourses] = useState<PersonalCourse[]>([])
  const [scopeVersions, setScopeVersions] = useState<PersonalCourseVersion[]>([])
  const [attempts, setAttempts] = useState<PersonalAttempt[]>([])
  const [assists, setAssists] = useState<PersonalAssist[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  useEffect(() => {
    setCourses([]); setAttempts([]); setAssists([]); setLoading(true); setLoadError('')
    const subscription = liveQuery(async () => ({
      courses: await database.personalCourses.where('spaceId').equals(spaceId).toArray(),
      scopeVersions: await database.personalCourseVersions.where('spaceId').equals(spaceId).toArray(),
      attempts: await database.personalAttempts.where('spaceId').equals(spaceId).toArray(),
      assists: await database.personalAssists.where('spaceId').equals(spaceId).toArray(),
    })).subscribe({ next: value => { setCourses(value.courses.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))); setScopeVersions(value.scopeVersions); setAttempts(value.attempts); setAssists(value.assists); setLoading(false) }, error: () => { setLoadError('无法读取本地个人课程，请检查浏览器存储。'); setLoading(false) } })
    return () => subscription.unsubscribe()
  }, [spaceId])
  if (loading) return <div className="page page-loading" role="status">正在读取个人课程…</div>
  if (loadError) return <div className="page"><h1>个人课程暂时无法打开</h1><p role="alert">{loadError}</p></div>
  if (!courseId) return <PersonalCourseList courses={courses} spaceId={spaceId}/>
  const course = courses.find(course => course.id === courseId)
  if (!course) return <div className="page"><div className="eyebrow">PERSONAL / NOT FOUND</div><h1>当前空间中没有这门课程</h1><p>它可能属于另一个账号空间，或仅保存在另一台设备且尚未完成同步。</p><Link className="button primary" to="/my-courses">返回个人课程</Link></div>
  return <CourseDetail key={`${spaceId}:${course.id}`} course={course} attempts={attempts.filter(attempt => attempt.courseId === course.id)} assists={assists.filter(assist => assist.courseId === course.id)} scopeVersions={scopeVersions.filter(scope => scope.courseId === course.id).sort((a, b) => a.version - b.version)} spaceId={spaceId}/>
}
