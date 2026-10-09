import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import stackExample from '../../../../content/courses/CS03.stack-example.json'
import logicExample from '../../../../content/courses/CS05.logic-example.json'
import { courses, currentObjectiveEvidence, objectiveStates, stateLabels, TRACE_OBJECTIVE, IMPLEMENT_OBJECTIVE } from '../domain/learning'
import { summarizeObjectiveStates, courseRelationLabels, type ObjectiveState, type ObjectiveSummary } from '../domain/course-map'
import { logicObjectiveState, LOGIC_OBJECTIVE, LOGIC_VERSION, LOGIC_ACTIVITY, LOGIC_STANDARD } from '../domain/logic'
import { useLocal } from '../local/LocalProvider'
import { AtlasMap } from './AtlasMap'

type Goal = { id: string; code: string; title: string; criteria: Array<{ id: string; title: string; verification: string }> }
type Unit = { id: string; title: string; objective_refs: string[] }
type Chapter = { id: string; title: string; children: Unit[] }
type Relation = { from: string; to: string; kind: string; source?: string }
type AtlasPackage = { course_code: string; version: string; scope_note: string; objectives: Goal[]; relations: Relation[]; outline?: Chapter[]; content_sources?: string[] }
const packages: Record<string, AtlasPackage> = { CS03: stackExample, CS05: logicExample }
const relationTypes = ['mandatory_prerequisite', 'conceptual_association', 'application'] as const
type RelationKind = typeof relationTypes[number]
const stateOrder: ObjectiveState[] = ['verified', 'partial', 'consolidate', 'unknown']
const criterionStatus = { met: '满足', not_met: '未满足', needs_review: '待审阅' }
const relationLabel = (kind: string) => courseRelationLabels[kind as RelationKind] ?? kind

function Distribution({ summary }: { summary: ObjectiveSummary }) {
  return <div className="distribution" role="img" aria-label={`课程知识图谱，${summary.total} 个唯一目标，其中 ${summary.verified} 项有达标证据，${summary.partial} 项部分满足，${summary.consolidate} 项需要巩固，${summary.unknown} 项尚未评估`}>
    {stateOrder.map(state => summary[state] > 0 ? <i key={state} className={state} style={{ flex: summary[state] }} /> : null)}
  </div>
}

export default function Atlas() {
  const [params, setParams] = useSearchParams()
  const course = courses.find(item => item.code === params.get('course')) ?? courses[2]
  const data = packages[course.code]
  const picker = <label className="course-picker">课程 <select value={course.code} onChange={event => setParams({ course: event.target.value })}>{courses.map(item => <option key={item.code} value={item.code}>{item.title}</option>)}</select></label>
  return <div className="page atlas-page">
    {data ? <CourseAtlas key={course.code} data={data} title={course.title} picker={picker} /> : <>
      <div className="page-topline">{picker}</div><div className="page-heading"><div><h1>{course.title}<span className="heading-note">知识图谱</span></h1><p>{course.description}</p></div></div>
      <section className="construction-state"><span className="large-orbit" aria-hidden="true">◌</span><h2>这门课的默认图谱还没有开放</h2><p>完整的理论、实践与核验内容尚未建成。你可以建立个人课程，保留真实学习尝试；自述记录保持未核验。</p><Link className="button primary" to="/my-courses">建立个人课程</Link><Link className="text-link" to="/atlas?course=CS03">查看数据结构范围样例</Link></section>
    </>}
  </div>
}

function CourseAtlas({ data, title, picker }: { data: AtlasPackage; title: string; picker: ReactNode }) {
  const [params, setParams] = useSearchParams()
  const { evidence, courseAttempts, help, lastObjective } = useLocal()
  const [directoryOpen, setDirectoryOpen] = useState(false)
  const inspector = useRef<HTMLElement>(null)
  const canvas = useRef<HTMLDivElement>(null)
  const moveFocus = useRef(false)
  const goals = new Map(data.objectives.map(goal => [goal.code, goal]))
  const chapters = data.outline ?? []
  const locate = (code: string) => {
    const placements = chapters.flatMap(chapter => chapter.children.filter(unit => unit.objective_refs.includes(code)).map(unit => ({ chapter, unit })))
    return placements.find(placement => placement.chapter.id === params.get('chapter')) ?? placements[0]
  }
  const selected = goals.get(params.get('goal') ?? '')
  const previousSelection = useRef(selected?.code)
  useLayoutEffect(() => {
    const changed = previousSelection.current !== selected?.code
    previousSelection.current = selected?.code
    if (!changed || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const animation = inspector.current?.animate(
      [{ opacity: .45, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' },
    )
    return () => animation?.cancel()
  }, [selected?.code])
  const chapter = selected ? locate(selected.code)?.chapter : chapters.find(item => item.id === params.get('chapter'))
  const currentLogic = courseAttempts.filter(attempt => attempt.result?.course_version === LOGIC_VERSION && attempt.result.activity_version === LOGIC_ACTIVITY && attempt.result.standard_version === LOGIC_STANDARD)
  const states = data.course_code === 'CS03' ? objectiveStates(evidence) : new Map(data.objectives.map(goal => [goal.id, goal.code === LOGIC_OBJECTIVE ? logicObjectiveState(currentLogic) : 'unknown' as ObjectiveState]))
  const stateOf = (code: string) => states.get(goals.get(code)?.id ?? '') ?? 'unknown'
  const summary = summarizeObjectiveStates(data.objectives.map(goal => goal.id), states)
  const view = params.get('view') === 'list' ? 'list' : 'map'
  const filter = stateOrder.includes(params.get('filter') as ObjectiveState) ? params.get('filter') as ObjectiveState : 'all'
  const search = params.get('q') ?? ''
  const kinds = new Set<RelationKind>(params.has('relations') ? (params.get('relations') ?? '').split(',').map(kind => kind === 'prerequisite' ? 'mandatory_prerequisite' : kind).filter((kind): kind is RelationKind => relationTypes.includes(kind as RelationKind)) : ['mandatory_prerequisite'])
  const matches = (code: string) => filter === 'all' || stateOf(code) === filter
  const visibleGoals = data.objectives.filter(goal => matches(goal.code))
  const update = (values: Record<string, string | null>, replace = false) => setParams(previous => {
    const next = new URLSearchParams(previous)
    next.set('course', data.course_code)
    for (const [key, value] of Object.entries(values)) { if (value === null) next.delete(key); else next.set(key, value) }
    return next
  }, { replace })
  const openOverview = () => update({ chapter: null, goal: null })
  const openGoal = (code: string) => {
    moveFocus.current = true; setDirectoryOpen(false)
    update({ goal: code, chapter: locate(code)?.chapter.id ?? null })
  }
  const openChapter = (entry: Chapter, unit?: Unit) => {
    const refs = (unit ? unit.objective_refs : entry.children.flatMap(item => item.objective_refs)).filter(matches)
    update({ chapter: entry.id, goal: refs.includes(selected?.code ?? '') ? selected!.code : refs[0] ?? null, q: null }); setDirectoryOpen(false)
  }
  const toggleKind = (kind: RelationKind) => {
    const next = new Set(kinds)
    if (next.has(kind)) next.delete(kind); else next.add(kind)
    update({ relations: relationTypes.filter(item => next.has(item)).join(',') })
  }
  useEffect(() => {
    if (moveFocus.current && selected && window.matchMedia('(max-width: 640px)').matches) {
      inspector.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); inspector.current?.focus({ preventScroll: true })
    }
    moveFocus.current = false
  }, [selected?.code])
  const searchResults = data.objectives.filter(goal => `${goal.title} ${goal.criteria.map(item => item.title).join(' ')} ${locate(goal.code)?.chapter.title ?? ''}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  const summaryOf = (refs: string[]) => summarizeObjectiveStates(refs.map(code => goals.get(code)?.id ?? code), states)
  const resume = lastObjective && goals.has(lastObjective) ? goals.get(lastObjective)! : data.objectives.find(goal => goal.code === TRACE_OBJECTIVE || goal.code === LOGIC_OBJECTIVE)
  const selectedEvidence = selected && data.course_code === 'CS03' ? currentObjectiveEvidence(evidence, selected.code) : undefined
  const selectedLogic = selected?.code === LOGIC_OBJECTIVE ? currentLogic.filter(item => item.result && !item.resultTrust).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)).at(-1) : undefined
  const result = selectedEvidence?.result ?? selectedLogic?.result
  const otherRecords = selected ? data.course_code === 'CS03' ? evidence.filter(item => item.objectiveId === selected.code && item.id !== selectedEvidence?.id) : courseAttempts.filter(item => item.objectiveId === selected.code && item.result && item.id !== selectedLogic?.id) : []
  const submittedHelp = selectedEvidence ? help.filter(item => selectedEvidence.helpEventIds.includes(item.id)) : []
  const canTrace = selected?.code === TRACE_OBJECTIVE
  const canCode = selected?.code === IMPLEMENT_OBJECTIVE
  const canLogic = selected?.code === LOGIC_OBJECTIVE
  const canLearn = canTrace || canCode || canLogic
  const goalButton = (code: string) => <button key={code} type="button" className="goal-pick" aria-pressed={selected?.code === code} onClick={() => openGoal(code)}><span>{goals.get(code)?.title}</span><span className={`evidence-pill ${stateOf(code)}`}>{stateLabels[stateOf(code)]}</span></button>

  return <>
    <div className="page-heading atlas-course-header"><div>
      <div className="course-meta">{picker}<details className="atlas-range-note"><summary>未审校范围样例 · 范围说明</summary><p>{data.scope_note} 范围版本 {data.version}。同步恢复、自述与旧版本记录不会自动升级为达标证据。</p></details></div>
      <h1>{title}<span className="heading-note">知识图谱</span></h1><p>看见知识之间的联系，也看见每一步学习的依据。</p>
    </div><div className="scope-total"><div className="summary-title"><strong>{summary.verified}<span> / {summary.total}</span></strong><span>目标有达标证据</span><small>声明范围</small></div><Distribution summary={summary} /><div className="atlas-state-key" aria-label="目标状态图例">{stateOrder.map(state => <span key={state}><i className={`legend-dot ${state}`} />{stateLabels[state]} <b>{summary[state]}</b></span>)}</div></div></div>
    <section className="atlas-workspace" aria-label="课程知识图谱工作区">
      <aside className={`course-scope ${directoryOpen ? 'is-open' : ''}`} aria-label="课程目录与查找">
        <div className="outline-top"><h2>课程范围</h2><button type="button" aria-expanded={directoryOpen} aria-controls="atlas-outline" onClick={() => setDirectoryOpen(!directoryOpen)}>{directoryOpen ? '收起目录' : '展开目录'}</button></div>
        <div id="atlas-outline">
          <label className="atlas-search-box"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8" cy="8" r="5"/><path d="m12 12 5 5"/></svg><input className="scope-search" type="search" placeholder="查找知识点…" aria-label="查找知识点" value={search} onChange={event => update({ q: event.target.value || null }, true)} /></label>
          {search.trim() ? <div className="scope-search-results"><p className="scope-search-count">找到 {searchResults.length} 个唯一目标</p>{searchResults.map(goal => <button type="button" className="scope-search-row" key={goal.id} onClick={() => openGoal(goal.code)}><strong>{goal.title}</strong><small>{locate(goal.code)?.chapter.title ?? '已声明目标'} · {stateLabels[stateOf(goal.code)]}</small></button>)}{!searchResults.length && <p>没有找到“{search}”。试试其他词或清除查找。</p>}<button className="text-link" onClick={() => update({ q: null }, true)}>清除查找</button></div> : <nav className="scope-directory" aria-label="课程范围">
            <button className={`directory-overview ${chapter || selected ? '' : 'is-active'}`} onClick={openOverview}><span className="directory-index">◎</span><span>整课全景</span><small>{summary.total} 目标</small></button>
            {chapters.map((entry, index) => { const cs = summaryOf(entry.children.flatMap(unit => unit.objective_refs)); return <div key={entry.id} className="directory-chapter-group"><button className={`directory-chapter ${chapter?.id === entry.id ? 'is-active' : ''}`} aria-expanded={chapter?.id === entry.id} onClick={() => openChapter(entry)}><span className="directory-index">{String(index + 1).padStart(2, '0')}</span><span className="directory-title">{entry.title}</span><small>{cs.verified}/{cs.total}</small></button>{chapter?.id === entry.id && <div className="directory-units">{entry.children.map(unit => <button className="directory-unit" key={unit.id} onClick={() => openChapter(entry, unit)}>{unit.title}</button>)}</div>}</div> })}
            {!chapters.length && <><p className="atlas-boundary">课程包尚未声明章节，下面仅列已声明目标。</p>{data.objectives.map(goal => goalButton(goal.code))}</>}
          </nav>}
          <details className="atlas-source"><summary>范围来源与版本</summary><p>{data.version} · 待教研审校</p>{data.content_sources ? <ul>{data.content_sources.map(source => <li key={source}>{source}</li>)}</ul> : <p>工程样例课程包，尚无完整课程来源与审校记录。</p>}</details>
        </div>
      </aside>
      <div className="scope-canvas" ref={canvas}>
        <div className="scope-navigation"><nav className="atlas-breadcrumbs" aria-label="图谱位置"><button onClick={openOverview}>课程全景</button>{chapter && <><span>/</span><strong>{chapter.title}</strong></>}</nav><div className="view-toggle" role="group" aria-label="视图切换"><button aria-pressed={view === 'map'} onClick={() => update({ view: 'map' })}>图谱</button><button aria-pressed={view === 'list'} onClick={() => update({ view: 'list' })}>目录</button></div></div>
        <div className="canvas-heading"><div><h2 id="canvas-title">{chapter?.title ?? (selected ? '目标关系' : '课程全景')}</h2><p>{chapter ? '当前章节的局部关系，跨章节点保留原归属。' : chapters.length ? `${chapters.length} 章 · ${chapters.reduce((n, item) => n + item.children.length, 0)} 单元 · 点击单元进入目标。` : `${summary.total} 个已声明目标 · 未声明章节结构。`}</p></div>{resume && <button className="continue-button" onClick={() => update({ filter: null, goal: resume.code, chapter: locate(resume.code)?.chapter.id ?? null })}>{lastObjective === resume.code ? '继续上次的目标' : '定位可用活动'} <span aria-hidden="true">→</span></button>}</div>
        <div className="scope-toolbar"><label className="scope-filter" htmlFor="atlas-filter">目标状态</label><select id="atlas-filter" value={filter} onChange={event => update({ filter: event.target.value === 'all' ? null : event.target.value })}><option value="all">全部状态</option>{stateOrder.map(state => <option key={state} value={state}>{stateLabels[state]}</option>)}</select><span>范围 {chapter ? summaryOf(chapter.children.flatMap(unit => unit.objective_refs)).total : summary.total} · 匹配 {chapter ? [...new Set(chapter.children.flatMap(unit => unit.objective_refs))].filter(matches).length : visibleGoals.length}</span></div>
        {filter !== 'all' && <p className="atlas-boundary" role="status">正在显示 {visibleGoals.length} 个匹配目标；整课统计仍为 {summary.total} 个唯一目标。{selected && !matches(selected.code) ? ' 当前选中目标保留定位，未计入匹配数量。' : ''}</p>}
        {visibleGoals.length === 0 ? <div className="atlas-empty"><h3>当前筛选没有匹配目标。</h3><p>未评估不等于未掌握；筛选不会改变范围或证据。</p><button className="button" onClick={() => update({ filter: null })}>清除筛选</button></div> : view === 'list' ? <div className="context-list">{chapters.length ? (chapter ? [chapter] : chapters).map(entry => <section className="list-section" key={entry.id}><h3>{entry.title}</h3>{entry.children.map(unit => <section className="list-unit" key={unit.id}><h4>{unit.title}</h4>{unit.objective_refs.filter(matches).map(goalButton)}</section>)}</section>) : visibleGoals.map(goal => goalButton(goal.code))}</div> : <AtlasMap goals={data.objectives} chapters={chapters} relations={data.relations} chapter={chapter} selected={selected} kinds={kinds} toggleKind={toggleKind} stateOf={stateOf} matches={matches} onChapter={openChapter} onGoal={openGoal} />}
        <div className="atlas-scope-summary"><Distribution summary={summary} /><p>统计只包含当前范围的唯一目标。章节、重复引用和隐藏关系不增加分母。</p></div>
      </div>
      <aside className="objective-inspector" aria-label="目标证据与下一步" tabIndex={-1} ref={inspector}>
        {selected ? <>
          <p className="inspector-path">{locate(selected.code) ? `${locate(selected.code)?.chapter.title} / ${locate(selected.code)?.unit.title}` : '已声明目标 · 章节待建设'}</p><h2>{selected.title}</h2><span className={`evidence-pill ${stateOf(selected.code)}`}>{stateLabels[stateOf(selected.code)]}</span>
          <p className="inspector-description">{canTrace ? '亲自推演每一步栈状态与输出，再解释空栈边界和后进先出的理由。' : canCode ? '用代码实现括号匹配，并解释嵌套、类型不匹配与边界输入的处理。' : canLogic ? '通过真值表核对命题公式，保留推导过程与核验结果。' : `学习重点：${selected.criteria.map(criterion => criterion.title).slice(0, 2).join('；')}。`}</p><h3>必要表现与当前依据</h3><ul className="atlas-criteria">{selected.criteria.map(criterion => { const checked = result?.criteria.find(item => item.id === criterion.id); return <li key={criterion.id}><div><strong>{criterion.title}</strong><span className={checked?.status ?? 'unknown'}>{checked ? criterionStatus[checked.status] : '尚无有效依据'}</span></div>{checked && <p>{checked.reason}</p>}</li> })}</ul>
          <section className="next-action"><h3>下一步可以做什么</h3>{canLearn ? <><p className="inspector-note">{canCode ? '可编辑和保存代码作品；编译执行与自动核验尚未开放。' : result ? '修改作品并重新核验；原理解释与独立新条件仍需复核。' : '先亲自预测与解释，再提交固定活动核验。核验通过也不会自动证明全部掌握。'}</p><Link className="button primary" to={`/learn/${selected.code}`}>{canLogic ? '进入真值表工作台' : '进入学习工作台'}</Link></> : <><span className="small-tag">活动待建设</span><p className="inspector-note">尚未提供这个目标的理论实践活动，也没有可提交的核验路径。目标保留在声明范围内，状态保持未评估。</p><Link className="button primary" to="/my-courses">建立个人课程记录尝试</Link></>}</section>
          <details className="inspector-evidence"><summary>已有作品与核验</summary>{result ? <><p>本机有效核验 · {new Date(selectedEvidence?.createdAt ?? selectedLogic!.updatedAt).toLocaleString('zh-CN')}</p><p>{result.summary}</p><p>帮助范围：{selectedEvidence ? `${submittedHelp.filter(item => item.kind === 'hint').length} 次提示、${submittedHelp.filter(item => item.kind === 'answer').length} 次答案、${submittedHelp.filter(item => item.kind === 'agent_assist').length} 次助手帮助（提交快照）` : '查看记录以核对答案使用与尝试历史。'}</p><details><summary>核验版本</summary><p>课程：{result.course_version}<br/>活动：{result.activity_version}<br/>规则：{result.standard_version}</p></details></> : <p>尚无当前版本的可靠核验。开始尝试或查看既有作品；打开页面、阅读与聊天不增加达标数。</p>}{otherRecords.length > 0 && <p>{otherRecords.length} 条其他历史或账号恢复记录保留在学习证据中，未自动承接到当前状态。</p>}</details>
          <details className="atlas-relations"><summary>知识关系与来源</summary><div className="focus-relations">{data.relations.filter(r => kinds.has(r.kind as RelationKind) && (r.from === selected.code || r.to === selected.code)).map((r, i) => <div className="focus-relation" key={i}><strong>{relationLabel(r.kind)}：{goals.get(r.from)?.title} {r.kind === 'conceptual_association' ? '↔' : '→'} {goals.get(r.to)?.title}</strong><small>来源：{r.source === 'engineering_example_pending_review' ? '工程关系样例，待教研审校' : r.source ?? '待补充'}</small><button type="button" className="related-goal-link" onClick={() => openGoal(r.from === selected.code ? r.to : r.from)}>查看「{goals.get(r.from === selected.code ? r.to : r.from)?.title}」</button></div>)}</div></details>
          <Link className="text-link" to="/evidence">查看已有作品与核验</Link>
          <button type="button" className="atlas-back-map" onClick={() => {
            const node = canvas.current?.querySelector<HTMLButtonElement>('.map-point[aria-pressed=true], .goal-pick[aria-pressed=true]')
            node?.scrollIntoView({ block: 'center', inline: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
            node?.focus({ preventScroll: true })
          }}>回到局部图谱</button>
        </> : <div className="panorama-stats"><span className="eyebrow">全景阅读</span><svg className="inspector-intro-icon" width="75" height="65" viewBox="0 0 75 65" aria-hidden="true"><path d="M14 48 35 17 63 43M14 48H63" fill="none" stroke="#b8c8ed" strokeWidth="1.5"/><circle cx="35" cy="17" r="10" fill="#edf3ff" stroke="#315fe7"/><circle cx="14" cy="48" r="7" fill="#f4f7fd" stroke="#8ba1ce"/><circle cx="63" cy="43" r="8" fill="#eef7f4" stroke="#16826b"/></svg><h2>先看范围，<br/>再找下一步。</h2><p className="panorama-description">选择章节或目标，查看关系、必要表现、实际证据与可开展的活动。</p><div className="scope-tally">{stateOrder.map(state => <div key={state}><strong>{summary[state]}</strong><span>{stateLabels[state]}</span></div>)}</div><p className="panorama-subtle">这是范围样例，不表示整门课程已完成建设。个人证据与课程结构分开保存。</p>{resume && <section className="learn-next"><h3>{lastObjective === resume.code ? '继续上次的目标' : '从可用活动开始'}</h3><p>{resume.title}</p><button className="button primary" onClick={() => update({ filter: null, goal: resume.code, chapter: locate(resume.code)?.chapter.id ?? null })}>定位学习目标</button></section>}</div>}
      </aside>
    </section>
  </>
}
