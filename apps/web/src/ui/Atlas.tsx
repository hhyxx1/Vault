import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { algebraActivityForObjective, codeActivityForObjective, loadCoursePackage, workspaceForObjective, type AtlasPackage } from '../domain/course-packages'
import { courses } from '../domain/learning'
import scopeCatalog from '../../../../content/courses/scope-catalog.json'
import { buildCognitiveGraph } from '../domain/cognitive-graph'
import { deriveObjectiveCognition } from '../domain/learner-cognition'
import { useLocal } from '../local/LocalProvider'
import { CognitiveAtlas } from './cognitive/CognitiveAtlas'
import type { LearnTarget } from './cognitive/CognitivePanel'
import { useCourseReviews } from './useCourseReviews'

// Data-driven course list (C01): the platform-default courses plus any extra
// published package (e.g. the synthetic workshop), so a brand-new course shows
// up in the atlas without a hard-coded id whitelist.
const extraCourses = (
  scopeCatalog as typeof scopeCatalog & { extra_courses?: typeof scopeCatalog.courses }
).extra_courses ?? []
const atlasCourses = [
  ...courses,
  ...extraCourses.map(item => ({
    code: item.code,
    title: item.title,
    description: '额外课程包，用于复用平台核验工具；内容待审校，不属于默认十三门本科课。',
  })),
]

function learnTargetFor(data: AtlasPackage, code: string): LearnTarget {
  const activity = codeActivityForObjective(data, code)
  const algebra = algebraActivityForObjective(data, code)
  const workspace = workspaceForObjective(code)
  const canLearn = !!activity || !!algebra || workspace !== null
  const href = `/learn/${code}${activity ? `?courseVersion=${data.course_version_id}` : ''}`
  const label = activity
    ? '开始本次学习'
    : algebra
      ? '进入代数实验工作台'
      : workspace === 'truth_table'
        ? '进入真值表工作台'
        : workspace === 'structured_trace'
          ? '进入结构化推演工作台'
          : workspace === 'stack_trace'
            ? '进入栈推演工作台'
            : workspace === 'code_draft'
              ? '进入代码工作台'
              : '开始学习'
  const note = activity
    ? '可编辑、保存并提交隔离核验；按目标逐项记录实际覆盖的条件，不从一次通过推断完全掌握。'
    : algebra
      ? '填写运算表与性质预测，再用完整有限表检查；一次预测正确不会被标记成掌握。'
      : workspace === 'structured_trace'
        ? '逐步推演状态与边界，保留解释与核验记录。'
        : workspace === 'truth_table'
          ? '填写四组赋值的真值，提交后核验推导过程。'
          : canLearn
            ? '进入该目标的学习工作台；原理解释与独立迁移仍需另行复核。'
            : '尚未提供可提交的实践与核验路径。'
  return { href, canLearn, label, note }
}

export default function Atlas() {
  const [params, setParams] = useSearchParams()
  const course = atlasCourses.find(item => item.code === params.get('course')) ?? courses[2]
  const edition = params.get('edition') === 'core' ? 'core' : 'current'
  const [loaded, setLoaded] = useState<{ key: string; data: AtlasPackage | null; error?: string } | null>(null)
  const requestedVersion = params.get('courseVersion') ?? undefined
  const key = `${course.code}:${edition}:${requestedVersion ?? 'latest'}`
  useEffect(() => {
    let active = true
    loadCoursePackage(course.code, edition, requestedVersion).then(data => { if (active) setLoaded({ key, data }) })
      .catch(() => { if (active) setLoaded({ key, data: null, error: '课程内容暂时无法加载，请刷新重试。' }) })
    return () => { active = false }
  }, [course.code, edition, requestedVersion, key])
  const data = loaded?.key === key ? loaded.data : null
  if (loaded?.key !== key) return <div className="page atlas-page" role="status">正在打开课程图谱…</div>
  if (loaded.error) return <div className="page atlas-page" role="alert">{loaded.error}</div>
  if (!data) {
    return <div className="page atlas-page">
      <div className="page-topline"><label className="course-picker">课程 <select value={course.code} onChange={event => setParams({ course: event.target.value })}>{atlasCourses.map(item => <option key={item.code} value={item.code}>{item.title}</option>)}</select></label></div>
      <div className="page-heading"><div><h1>{course.title}<span className="heading-note">知识图谱</span></h1><p>{course.description}</p></div></div>
      <section className="construction-state"><span className="large-orbit" aria-hidden="true">◌</span><h2>这门课的默认图谱还没有开放</h2><p>完整的理论、实践与核验内容尚未建成。你可以建立个人课程，保留真实学习尝试；自述记录保持未核验。</p><Link className="button primary" to="/my-courses">建立个人课程</Link><Link className="text-link" to="/atlas?course=CS03">查看数据结构范围样例</Link></section>
    </div>
  }
  return <AtlasSurface
    key={data.course_version_id}
    data={data}
    activeCourse={course.code}
    courses={atlasCourses}
    initialGoal={params.get('goal')}
    onCourseChange={code => setParams({ course: code })}
  />
}

function AtlasSurface({ data, activeCourse, courses: courseList, onCourseChange, initialGoal }: {
  data: AtlasPackage
  activeCourse: string
  courses: { code: string; title: string }[]
  onCourseChange: (code: string) => void
  initialGoal: string | null
}) {
  const { evidence, courseAttempts, structuredAttempts, codeAttempts, algebraAttempts, help, lastObjective } = useLocal()
  const reviews = useCourseReviews(data.course_version_id)
  const { rows, owner, unavailable } = reviews
  const cognition = useMemo(
    () => deriveObjectiveCognition(data, { evidence, courseAttempts, structuredAttempts, codeAttempts, algebraAttempts, help, reviews: { rows, owner, unavailable } }),
    [data, evidence, courseAttempts, structuredAttempts, codeAttempts, algebraAttempts, help, rows, owner, unavailable],
  )
  const graph = useMemo(
    () => buildCognitiveGraph(data, cognition.byCode, { lastObjective }),
    [data, cognition, lastObjective],
  )
  const learnTargetOf = useCallback((code: string) => learnTargetFor(data, code), [data])
  return <CognitiveAtlas
    data={data}
    graph={graph}
    courses={courseList}
    activeCourse={activeCourse}
    onCourseChange={onCourseChange}
    learnTargetOf={learnTargetOf}
    initialGoal={initialGoal}
  />
}
