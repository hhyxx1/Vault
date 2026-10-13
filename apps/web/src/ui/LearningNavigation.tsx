import { Link } from 'react-router-dom'
import type { AtlasPackage } from '../domain/course-packages'
import { learningNeighbors } from '../domain/learning-navigation'

export default function LearningNavigation({ course, objective }: { course: AtlasPackage; objective: string }) {
  const neighbors = learningNeighbors(course.objectives, objective)
  if (!neighbors) return null
  const route = (goal: string) => `/learn/${encodeURIComponent(goal)}?courseVersion=${encodeURIComponent(course.course_version_id)}`
  return <nav className="code-course-context learning-navigation" aria-label="课程连续学习">
    <div><span className="eyebrow">COURSE / YOUR ROUTE</span><h2>{course.title} · 第 {neighbors.position} / {neighbors.total} 个目标</h2>
      <p className="muted">按目录继续学习；目标顺序是建议路线，掌握状态由实际证据决定。</p>
      <div className="button-row">
        {neighbors.previous && <Link className="button secondary" to={route(neighbors.previous.code)}>上一目标：{neighbors.previous.title}</Link>}
        <Link className="button secondary" to={`/atlas?course=${course.course_code}&courseVersion=${course.course_version_id}&goal=${objective}`}>查看整门课的图谱与证据</Link>
        {neighbors.next && <Link className="button" to={route(neighbors.next.code)}>下一目标：{neighbors.next.title}</Link>}
      </div>
    </div>
  </nav>
}
