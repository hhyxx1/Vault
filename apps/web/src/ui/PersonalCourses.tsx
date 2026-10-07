import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom'
import { liveQuery } from 'dexie'
import { useLocal } from '../local/LocalProvider'
import { database, recordPersonalAttempt, savePersonalCourse } from '../local/database'
import { canonicalJson } from '../domain/integrity'
import type { PersonalAttempt, PersonalCourse, PersonalTopic } from '../domain/personal'

const emptyAttempt = { learningQuestion: '', theoryNote: '', action: '', observation: '', reflection: '', nextStep: '' }
type AttemptInput = typeof emptyAttempt

function errorText(error: unknown, fallback: string) { return error instanceof Error ? error.message : fallback }

function PersonalCourseList({ courses, spaceId }: { courses: PersonalCourse[]; spaceId: string }) {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [goal, setGoal] = useState('')
  const [topicTitle, setTopicTitle] = useState('')
  const [performance, setPerformance] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const navigatingToSavedCourse = useRef(false)
  const unfinishedForm = [title, goal, topicTitle, performance].some(value => value.trim())
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
      if (!!topicTitle.trim() !== !!performance.trim()) throw new Error('第一个学习点的名称与可观察表现需要一起填写，也可以暂时都留空。')
      const now = new Date().toISOString()
      const course: PersonalCourse = {
        id: crypto.randomUUID(), spaceId, title: title.trim(), goal: goal.trim(),
        topics: topicTitle.trim() ? [{ id: crypto.randomUUID(), title: topicTitle.trim(), expectedPerformance: performance.trim() }] : [],
        createdAt: now, updatedAt: now,
      }
      await savePersonalCourse(course, null)
      navigatingToSavedCourse.current = true
      navigate(`/my-courses/${course.id}`)
    } catch (error) { setMessage(errorText(error, '课程未保存，请检查浏览器存储后重试。')) }
    finally { setBusy(false) }
  }

  return <div className="page personal-page"><div className="eyebrow">PERSONAL / LEARNING PATH</div>
    <div className="page-heading"><div><h1>从你要学的课程开始。</h1><p>不限于 13 门默认课程。先定一个真实目标，再把原理、实践和结果逐次连起来。</p></div><span className="small-tag">个人课程 · 自建范围</span></div>
    <div className="personal-boundary"><span className="status-dot"/><p>这是个人学习草稿入口：课程结构由你提出，尚未经教学审校。记录的尝试是本人自述，不能当作自动核验或掌握证明。针对自建课程的 AI 辅导、资料检索和自动实践核验仍在建设。</p></div>
    <div className="personal-layout"><section className="personal-create" aria-labelledby="personal-create-title"><span className="eyebrow">01 / START</span><h2 id="personal-create-title">建立自己的课程</h2><p>只写课程名称即可开始；目标和学习点会保持“待确认”，不会自动假定你已经选好范围。也可以现在填上一个具体实践。</p>
      <form onSubmit={create} className="personal-form">
        <label htmlFor="personal-title">课程名称</label><input id="personal-title" required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} placeholder="例如：操作系统、编译原理、分布式系统"/>
        <label htmlFor="personal-goal">你想做到什么（可稍后确定）</label><textarea id="personal-goal" maxLength={2000} rows={3} value={goal} onChange={event => setGoal(event.target.value)} placeholder="例如：能解释进程调度，并用一段模拟程序比较不同策略。"/>
        <label htmlFor="personal-first-topic">第一个学习点（可稍后确定）</label><input id="personal-first-topic" maxLength={120} value={topicTitle} onChange={event => setTopicTitle(event.target.value)} placeholder="例如：先来先服务调度"/>
        <label htmlFor="personal-performance">怎样展示这个学习点（与学习点一起填写）</label><textarea id="personal-performance" maxLength={500} rows={3} value={performance} onChange={event => setPerformance(event.target.value)} placeholder="写下可做的表现和实践，例如：实现排队模拟并解释等待时间。"/>
        <button className="button primary" disabled={busy || !spaceId}>{busy ? '正在保存…' : '创建个人课程'} <span aria-hidden="true">↗</span></button>
      </form>{message && <p className="inline-message" role="status">{message}</p>}
    </section><section className="personal-saved" aria-labelledby="personal-saved-title"><span className="eyebrow">02 / CONTINUE</span><h2 id="personal-saved-title">继续你的课程</h2>{courses.length ? <div className="personal-course-list">{courses.map(course => <Link className="personal-course-row" key={course.id} to={`/my-courses/${course.id}`}><span className="course-number">{String(course.topics.length).padStart(2, '0')}</span><span><strong>{course.title}</strong><small>{course.goal || '探索目标待确认'}</small><em>{course.topics.length} 个自定学习点 · 尚未审校</em></span><span aria-hidden="true">↗</span></Link>)}</div> : <div className="personal-empty"><span aria-hidden="true">◌</span><p>还没有个人课程。写下课程名称就能开始建立范围。</p></div>}<p className="field-note">当前浏览器会先保存记录；登录账号后，只有逐项显示“已同步”的记录才算进入云端。可以在“本地空间”导出备份。</p></section></div>
    <div className="personal-catalog-link"><Link className="text-link" to="/atlas">查看 13 门默认课程的建设状态 →</Link></div>
  </div>
}

function CourseDetail({ course, attempts, spaceId }: { course: PersonalCourse; attempts: PersonalAttempt[]; spaceId: string }) {
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
  const selectedTopic = course.topics.find(topic => topic.id === topicId) ?? course.topics[0]
  const selectedAttempts = selectedTopic ? attempts.filter(attempt => attempt.topicId === selectedTopic.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : []
  const attemptedTopics = course.topics.filter(topic => attempts.some(attempt => attempt.topicId === topic.id)).length

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
  const unfinishedAttempt = Object.values(attemptInput).some(value => value.trim())
  const hasUnstoredInput = unfinishedCourse || unfinishedTopic || unfinishedAttempt
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
    setBusy(true); setMessage('')
    try {
      const attempt: PersonalAttempt = { id: crypto.randomUUID(), spaceId, courseId: course.id, topicId: selectedTopic.id,
        learningQuestion: attemptInput.learningQuestion.trim(), theoryNote: attemptInput.theoryNote.trim(), action: attemptInput.action.trim(),
        observation: attemptInput.observation.trim(), reflection: attemptInput.reflection.trim(), nextStep: attemptInput.nextStep.trim(), createdAt: new Date().toISOString() }
      await recordPersonalAttempt(attempt)
      setAttemptInput(emptyAttempt)
      setMessage('这次尝试已保存。它是自述记录，尚未核验；可以根据结果再尝试一次。')
    } catch (error) { setMessage(errorText(error, '这次尝试未保存，输入已保留，请重试。')) }
    finally { setBusy(false) }
  }
  function attemptField(key: keyof AttemptInput, label: string, placeholder: string, rows = 3) {
    return <><label htmlFor={`personal-${key}`}>{label}</label><textarea id={`personal-${key}`} required disabled={busy} maxLength={key === 'learningQuestion' ? 1200 : 4000} rows={rows} value={attemptInput[key]} onChange={event => setAttemptInput(current => ({ ...current, [key]: event.target.value }))} placeholder={placeholder}/></>
  }

  return <div className="page personal-page"><div className="eyebrow">PERSONAL / {course.title}</div><div className="personal-return"><Link className="text-link" to="/my-courses">← 返回个人课程</Link><span className="small-tag">个人自建 · 未经审校</span></div><div className="page-heading"><div><h1>{course.title}</h1><p>{course.goal || '探索目标待确认。先想一想：学完之后，你希望能解释或做出什么？'}</p></div><div className="personal-count"><strong>{attemptedTopics}<span> / {course.topics.length}</span></strong><small>学习点有自述尝试<br/>0 项完成独立核验</small></div></div>
    <div className="personal-boundary"><span className="status-dot"/><p>下面是你自己提出的课程范围，尚非完整课程知识图谱。未做过的学习点标为“待尝试”；做过的只标为“有自述尝试”，不会自动判定掌握。理论资料、实践标准、先修关系和 AI 辅导需要继续建设与审校。</p></div>
    <div className="personal-detail-layout"><section className="personal-topics" aria-labelledby="personal-topics-title"><div className="section-heading"><div><span className="eyebrow">PROVISIONAL / MAP</span><h2 id="personal-topics-title">你的学习点</h2></div><span>{course.topics.length} 个</span></div><div className="personal-topic-list">{course.topics.map((topic, index) => { const count = attempts.filter(attempt => attempt.topicId === topic.id).length; return <button type="button" key={topic.id} className={`personal-topic ${selectedTopic?.id === topic.id ? 'selected' : ''}`} onClick={() => { if (selectedTopic?.id !== topic.id && unfinishedAttempt && !window.confirm('这次尝试尚未保存，切换学习点会丢失当前输入。确定切换吗？')) return; setTopicId(topic.id); setAttemptInput(emptyAttempt); setMessage('') }} aria-pressed={selectedTopic?.id === topic.id}><span className="course-number">{String(index + 1).padStart(2, '0')}</span><span><strong>{topic.title}</strong><small>{topic.expectedPerformance}</small><em>{count ? `${count} 次自述尝试 · 未核验` : '待尝试'}</em></span></button> })}</div>{!course.topics.length && <p className="field-note">还没有学习点。先确定一个想理解的问题，以及能亲手尝试的动作。</p>}
      <details className="personal-add-topic" open={!course.topics.length}><summary>＋ 加入下一个学习点</summary><form className="personal-form" onSubmit={addTopic}><label htmlFor="personal-topic-title">学习点名称</label><input id="personal-topic-title" required maxLength={120} value={topicTitle} onChange={event => setTopicTitle(event.target.value)} placeholder="例如：虚拟内存与缺页处理"/><label htmlFor="personal-topic-performance">想完成的实践或可观察表现</label><textarea id="personal-topic-performance" required maxLength={500} value={performance} onChange={event => setPerformance(event.target.value)} rows={3} placeholder="例如：模拟页面置换并解释缺页次数。"/><button className="button secondary" disabled={busy}>保存学习点</button></form></details>
      <details className="personal-edit" open={!course.goal}><summary>调整课程名称与目标</summary><form className="personal-form" onSubmit={updateCourse}><label htmlFor="personal-edit-title">课程名称</label><input id="personal-edit-title" required maxLength={120} value={editTitle} onChange={event => setEditTitle(event.target.value)}/><label htmlFor="personal-edit-goal">学习目标</label><textarea id="personal-edit-goal" maxLength={2000} rows={3} value={editGoal} onChange={event => setEditGoal(event.target.value)} placeholder="学习后想解释、构建或解决什么？"/><button className="button secondary" disabled={busy}>保存课程目标</button></form></details>
    </section><section className="personal-work" aria-labelledby="personal-work-title"><span className="eyebrow">ACTIVE / PRACTICE LOOP</span>{selectedTopic ? <><h2 id="personal-work-title">{selectedTopic.title}</h2><p className="personal-performance">想做出来：{selectedTopic.expectedPerformance}</p><p className="field-note">把读到的原理带进操作，写下实际结果，再判断哪里需要修正。这里保存的是你的原始学习记录；暂时没有针对该课程的自动核验。</p>
      <form className="personal-form personal-attempt-form" onSubmit={saveAttempt}>
        {attemptField('learningQuestion', '这次想解决什么问题', '先写一个具体的问题，避免只记录“看完一章”。', 2)}
        {attemptField('theoryNote', '依据的概念或原理', '写下你认为相关的定义、关系或推理；可以注明来源。')}
        {attemptField('action', '亲手做了什么', '描述实验、代码、配置、推演或设计；如使用外部工具，请记录操作与条件。')}
        {attemptField('observation', '实际出现了什么结果', '记录输出、错误、行为或可复现的观察，不要把预期结果当成已发生结果。')}
        {attemptField('reflection', '结果说明了什么', '比较预期与实际；哪些理解得到支持，哪些仍有疑问？')}
        {attemptField('nextStep', '下一次怎么改或继续验证', '给出一个改变条件、修正方法或补充证据的下一步。')}
        <button className="button primary" disabled={busy}>{busy ? '正在保存…' : '保存这次尝试，继续学习'} <span aria-hidden="true">↗</span></button>
      </form>
      <div className="personal-attempts"><div className="section-heading"><h3>已保存的尝试</h3><span>{selectedAttempts.length} 次 · 自述未核验</span></div>{selectedAttempts.length ? selectedAttempts.map((attempt, index) => <details key={attempt.id} className="personal-attempt"><summary><strong>尝试 {selectedAttempts.length - index} · {attempt.learningQuestion}</strong><span>{new Date(attempt.createdAt).toLocaleString('zh-CN')}</span></summary><dl><dt>依据的原理</dt><dd>{attempt.theoryNote}</dd><dt>实际操作</dt><dd>{attempt.action}</dd><dt>观察到的结果</dt><dd>{attempt.observation}</dd><dt>目前的理解</dt><dd>{attempt.reflection}</dd><dt>下一次行动</dt><dd>{attempt.nextStep}</dd></dl></details>) : <p className="field-note">这个学习点还没有尝试记录。先动手一次，再记录真实结果。</p>}</div></> : <><h2 id="personal-work-title">先建立一个可做的学习点。</h2><p>当前课程还没有确认的实践目标。你可以先写下探索目标与第一个学习点；系统不会把空白课程算作已学习。</p></>}
      {message && <p className="inline-message" role="status">{message}</p>}
    </section></div>
  </div>
}

export default function PersonalCourses() {
  const { courseId } = useParams()
  const { spaceId } = useLocal()
  const [courses, setCourses] = useState<PersonalCourse[]>([])
  const [attempts, setAttempts] = useState<PersonalAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  useEffect(() => {
    setCourses([]); setAttempts([]); setLoading(true); setLoadError('')
    const subscription = liveQuery(async () => ({
      courses: await database.personalCourses.where('spaceId').equals(spaceId).toArray(),
      attempts: await database.personalAttempts.where('spaceId').equals(spaceId).toArray(),
    })).subscribe({ next: value => { setCourses(value.courses.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))); setAttempts(value.attempts); setLoading(false) }, error: () => { setLoadError('无法读取本地个人课程，请检查浏览器存储。'); setLoading(false) } })
    return () => subscription.unsubscribe()
  }, [spaceId])
  if (loading) return <div className="page page-loading" role="status">正在读取个人课程…</div>
  if (loadError) return <div className="page"><h1>个人课程暂时无法打开</h1><p role="alert">{loadError}</p></div>
  if (!courseId) return <PersonalCourseList courses={courses} spaceId={spaceId}/>
  const course = courses.find(course => course.id === courseId)
  if (!course) return <div className="page"><div className="eyebrow">PERSONAL / NOT FOUND</div><h1>当前空间中没有这门课程</h1><p>它可能属于另一个账号空间，或仅保存在另一台设备且尚未完成同步。</p><Link className="button primary" to="/my-courses">返回个人课程</Link></div>
  return <CourseDetail key={`${spaceId}:${course.id}`} course={course} attempts={attempts.filter(attempt => attempt.courseId === course.id)} spaceId={spaceId}/>
}
