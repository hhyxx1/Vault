import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import stackExample from '../../../../content/courses/CS03.stack-example.json'
import { courses, COURSE_VERSION, TRACE_OBJECTIVE, objectiveStates, stateLabels, objectiveSummary, stackCourseMap } from '../domain/learning'
import { useLocal } from '../local/LocalProvider'
import KnowledgeGraph from './KnowledgeGraph'

export default function Atlas() {
  const [params, setParams] = useSearchParams()
  const course = courses.find(course => course.code === params.get('course')) ?? courses[2]
  const [selected, setSelected] = useState(TRACE_OBJECTIVE)
  const { evidence } = useLocal()
  const states = useMemo(() => objectiveStates(evidence), [evidence])
  const summary = objectiveSummary(evidence)
  const selectedObjective = stackExample.objectives.find(objective => objective.code === selected) ?? stackExample.objectives[0]
  const selectedState = states.get(selectedObjective.id ?? selectedObjective.code) ?? 'unknown'
  const selectedActivity = stackExample.activities.find(activity => activity.objective_codes.includes(selectedObjective.code))
  const available = course.code === 'CS03'
  return <div className="page atlas-page"><div className="page-topline"><span className="eyebrow">KNOWLEDGE / ATLAS</span><label className="course-picker">课程 <select value={course.code} onChange={event => setParams({ course: event.target.value })}>{courses.map(course => <option key={course.code} value={course.code}>{course.title}</option>)}</select></label></div><div className="page-heading"><div><h1>{course.title}<span className="heading-note">知识图谱</span></h1><p>{available ? '在知识之间定位，用作品辨认你走过的路。' : course.description}</p></div>{available && <div className="scope-total"><strong>{summary.verified}<span> / 2</span></strong><span>样例目标有达标证据</span></div>}</div>
    {!available ? <section className="construction-state"><span className="large-orbit" aria-hidden="true">◌</span><div className="eyebrow">正在建设完整内容</div><h2>这门课的默认图谱还没有开放</h2><p>完整的理论、实践与核验内容尚未建成。你现在可以用自己的目标建立个人课程，保留学习尝试；自建内容会标为未审校、未核验。</p><Link className="button primary" to="/my-courses">建立个人课程 <span aria-hidden="true">↗</span></Link><Link className="text-link" to="/atlas?course=CS03">先试栈单元工程样例 →</Link></section> : <>
      <div className="scope-note"><span className="small-tag">局部工程样例</span><p>{stackExample.scope_note} 当前版本 {COURSE_VERSION} 声明了 {summary.total} 个唯一目标；此处状态只统计该样例，不代表数据结构整门课程进度。</p></div>
      <section className="atlas-body"><div className="atlas-map"><KnowledgeGraph definition={stackCourseMap} states={states} selected={selected} onSelect={setSelected}/><div className="graph-legend"><span><i className="legend-dot unknown"/>尚未有效评估</span><span><i className="legend-dot partial"/>部分条件满足</span><span><i className="legend-dot consolidate"/>需巩固</span><span><i className="legend-dot verified"/>有达标证据</span></div><div className="graph-relation">连线标签标明包含、先修、概念关联、后续应用或证据支持；关系只表达课程结构，不代替目标证据。</div></div><aside className="objective-inspector"><span className="eyebrow">当前目标 / {String(stackExample.objectives.findIndex(objective => objective.code === selected) + 1).padStart(2, '0')}</span><h2>{selectedObjective.title}</h2><span className={`evidence-pill ${selectedState}`}>{stateLabels[selectedState]}</span><h3>需要留下的表现</h3><ul className="criteria-list">{selectedObjective.criteria.map(criterion => <li key={criterion.id}>{criterion.title}</li>)}</ul>{!selectedActivity && <p className="inspector-note">当前课程包还没有为此目标声明活动，不能据此推断已经有实践或自动核验能力。</p>}<Link className="button primary" to={`/learn/${selected}`}>{selectedActivity?.artifact_kind === 'stack_trace_with_explanation' ? '进入推演工作台' : '打开学习工作台'}<span aria-hidden="true">↗</span></Link><Link className="text-link" to="/evidence">查看已有作品与核验 →</Link></aside></section>
      <section className="objective-list" aria-labelledby="objective-list-title"><div className="section-heading"><div><div className="eyebrow">同一图谱 · 文字视图</div><h2 id="objective-list-title">课程包中已声明的目标</h2></div><span className="version-label">{COURSE_VERSION}</span></div>{stackExample.objectives.map((objective, index) => { const state = states.get(objective.id ?? objective.code) ?? 'unknown'; const description = objective.criteria.map(criterion => criterion.title).join(' · '); return <div className="objective-row" key={objective.id}><button className="objective-select" aria-pressed={selected === objective.code} onClick={() => { setSelected(objective.code); document.querySelector('.objective-inspector')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' }) }}><span className="course-number">{String(index + 1).padStart(2, '0')}</span><span><strong>{objective.title}</strong><small>{description}</small></span></button><span className={`evidence-pill ${state}`}>{stateLabels[state]}</span><Link className="text-link" to={`/learn/${objective.code}`}>进入 <span aria-hidden="true">↗</span></Link></div> })}</section>
    </>}
  </div>
}
