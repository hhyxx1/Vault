import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { loadAlgebraActivity, loadCodeActivity } from '../domain/course-packages'
import CodeWorkspace from './CodeWorkspace'
const AlgebraWorkspace = lazy(() => import('./AlgebraWorkspace'))

export default function CourseCodeWorkspace() {
  const { objectiveId = '' } = useParams(); const [params] = useSearchParams()
  const version = params.get('courseVersion') ?? undefined; const rawTask = params.get('task') ?? 'base'; const task = rawTask === 'code' ? 'base' : rawTask
  const [loaded, setLoaded] = useState<Awaited<ReturnType<typeof loadCodeActivity>>>(null)
  const [native, setNative] = useState<Awaited<ReturnType<typeof loadAlgebraActivity>>>(null)
  const [ready, setReady] = useState(false); const [error, setError] = useState('')
  useEffect(() => {
    let active = true; setReady(false); setLoaded(null); setNative(null); setError('')
    Promise.all([loadCodeActivity(objectiveId, version), loadAlgebraActivity(objectiveId, version)]).then(([value, algebra]) => { if (active) { setLoaded(value); setNative(algebra); setReady(true) } }).catch(() => { if (active) { setError('课程内容暂时无法加载，请刷新重试。'); setReady(true) } })
    return () => { active = false }
  }, [objectiveId, version])
  if (!ready) return <div className="page-loading" role="status">正在打开课程活动…</div>
  if (native && rawTask === 'base') return <Suspense fallback={<div className="page-loading" role="status">正在打开运算表…</div>}><AlgebraWorkspace key={`${native.course.course_version_id}:${native.activity.version_id}`} lesson={{ ...native, objective: objectiveId }}/></Suspense>
  const variant = loaded?.activity.variants?.find(item => item.code === task)
  if (!loaded || (task !== 'base' && !variant)) return <div className="page"><h1>这个目标的实践尚未开放</h1><p>{error || '没有找到该目标或新条件的已登记活动。已有作品仍保留，未开展的核验不计入学习证据。'}</p><Link className="button primary" to="/atlas">返回课程图谱</Link></div>
  return <CodeWorkspace key={`${loaded.activity.version_id}:${task}`} lesson={{ ...loaded, objective: objectiveId, variant }}/>
}
