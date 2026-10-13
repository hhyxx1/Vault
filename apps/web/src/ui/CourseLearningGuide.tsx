import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listModelProfiles, type ModelCatalog } from '../api/verification'
import { canonicalHash, canonicalJson } from '../domain/integrity'
import { practiceHref } from '../domain/learning-journey'
import type { CodeDraft } from '../domain/code'
import type { AtlasPackage, CourseCodeActivity, CodeVariant } from '../domain/course-packages'
import { database, saveCodeDraft } from '../local/database'
import { useLocal } from '../local/LocalProvider'

type Lesson = { course: AtlasPackage; activity: CourseCodeActivity; objective: string; variant?: CodeVariant }
const verificationText: Record<string, string> = {
  deterministic_checker: '提交作品后，系统核对本次固定条件。',
  independent_review_pending: '原理解释与新条件迁移还需单独核对；当前不会自动判为掌握。',
  signed_teacher_review: '需要教师根据完整标准核对并签署。',
}

export default function CourseLearningGuide({ lesson }: { lesson: Lesson }) {
  const { spaceId } = useLocal()
  const navigate = useNavigate()
  const { course, activity, objective, variant } = lesson
  const taskCode = variant?.code ?? 'base'
  const task = variant ?? activity
  const activityKey = `${activity.version_id}:${taskCode}`
  const goal = course.objectives.find(item => item.code === objective)
  const [confidence, setConfidence] = useState('')
  const [priorThinking, setPriorThinking] = useState('')
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null)
  const [starting, setStarting] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    listModelProfiles(controller.signal)
      .then(setCatalog)
      .catch(() => { if (!controller.signal.aborted) setCatalog({ profiles: [], task_defaults: {} }) })
    return () => controller.abort()
  }, [])

  const sources = useMemo(() => {
    const sourceMap = new Map((course.sources ?? []).map(source => [source.id, source]))
    return activity.source_refs.map(id => sourceMap.get(id) ?? { id, title: id, url: '', locator: '', status: 'unverified' })
  }, [activity.source_refs, course.sources])

  async function beginPractice() {
    if (starting) return
    setStarting(true)
    setMessage('')
    try {
      const id = await canonicalHash({ activityKey })
      const existing = await database.codeDrafts.get([spaceId, id])
      const prediction = [
        confidence ? `我的起点判断：${confidence}` : '',
        priorThinking.trim() ? `我现在的理解或疑问：${priorThinking.trim()}` : '',
      ].filter(Boolean).join('\n') || existing?.prediction || ''
      const draft: Omit<CodeDraft, 'id' | 'createdAt' | 'updatedAt'> = {
        spaceId,
        activityKey,
        request: existing?.request ?? structuredClone(task.code_request),
        prediction,
        reflection: existing?.reflection ?? '',
        reflections: existing?.reflections ?? {},
        viewedRevisionId: existing?.viewedRevisionId ?? null,
        reflectionRevisionId: existing?.reflectionRevisionId ?? null,
        learningContext: {
          courseId: course.course_id,
          courseVersionId: course.course_version_id,
          activityVersionId: activity.version_id,
          objectiveCode: objective,
          taskCode,
          helpViewed: existing?.learningContext?.helpViewed ?? [],
        },
      }
      await saveCodeDraft(draft, database, existing ? canonicalJson(existing) : undefined)
      navigate(practiceHref(objective, course.course_version_id, taskCode))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '暂时无法保存学习起点，请重试。')
      setStarting(false)
    }
  }

  return <main className="page course-learning-guide">
    <header className="learning-guide-header">
      <div>
        <Link className="text-link" to={`/atlas?course=${encodeURIComponent(course.course_code)}&edition=core&courseVersion=${encodeURIComponent(course.course_version_id)}&goal=${encodeURIComponent(objective)}`}>← 返回知识图谱</Link>
        <p className="eyebrow">{course.course_code} / {course.title}</p>
        <h1>{goal?.title ?? activity.title ?? '本次学习'}</h1>
        <p className="learning-guide-lede">先弄清本次要学会什么，再形成自己的判断，接着动手检验，最后解释结果。代码只是这次活动的实践工具，不是学习本身。</p>
      </div>
      <div className="learning-guide-status"><span className="status-dot" aria-hidden="true"/><span>学习起点 · 不计入掌握度</span></div>
    </header>

    <nav className="learning-sequence" aria-label="本次学习顺序">
      <span aria-current="step"><b>01</b> 理解目标</span><i aria-hidden="true">→</i><span><b>02</b> 形成判断</span><i aria-hidden="true">→</i><span><b>03</b> 动手实践</span><i aria-hidden="true">→</i><span><b>04</b> 解释与再验证</span>
    </nav>

    <div className="learning-guide-grid">
      <section className="learning-guide-main">
        <section className="learning-guide-section">
          <span className="eyebrow">LEARNING OUTCOME</span>
          <h2>这次结束时，你应该能做到</h2>
          <ul className="learning-outcomes">{(goal?.criteria ?? []).map(item => <li key={item.id}><strong>{item.title}</strong><span>{verificationText[item.verification] ?? '需要在活动中提交可检查的作品或解释。'}</span></li>)}</ul>
          <p className="field-note">{task.student_action}</p>
        </section>

        <section className="learning-guide-section theory-section">
          <span className="eyebrow">CONCEPT BEFORE TOOL</span>
          <h2>先看原理，再决定怎么验证</h2>
          <ol className="theory-points">{activity.theory.map((point, index) => <li key={`${index}:${point}`}><span>{String(index + 1).padStart(2, '0')}</span><p>{point}</p></li>)}</ol>
          <p className="field-note">这里的原理是本次活动的起点。实践中遇到不理解的地方，先回到对应概念，再用新输入检查你的解释。</p>
          {sources.length > 0 && <details className="learning-sources"><summary>查看本活动引用来源（{sources.length}）</summary><ul>{sources.map(source => <li key={source.id}>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : source.title}{source.locator && <span> · {source.locator}</span>}<small>{source.status === 'verified' ? '已核对来源' : '来源状态待核对'}</small></li>)}</ul></details>}
        </section>

        <section className="learning-guide-section check-in-section">
          <span className="eyebrow">YOUR STARTING POINT</span>
          <h2>你现在对它有什么感觉？</h2>
          <p>不需要答对。先记录起点，实践后再对照修改；这份自评不会直接改变图谱状态。</p>
          <fieldset className="confidence-options"><legend>我目前的感觉</legend>{['第一次接触', '听说过，但说不清', '能解释一部分', '做过类似题'].map(item => <label key={item}><input type="radio" name="starting-confidence" value={item} checked={confidence === item} onChange={() => setConfidence(item)}/><span>{item}</span></label>)}</fieldset>
          <label className="learning-thinking-label">先写下你的猜测、已有经验或最想弄明白的问题<textarea value={priorThinking} maxLength={2000} rows={3} onChange={event => setPriorThinking(event.target.value)} placeholder={task.prediction_prompt ?? '例如：我猜这个结构适合……，但还不确定……'}/></label>
        </section>
      </section>

      <aside className="learning-guide-side">
        <section className="learning-next-card">
          <span className="eyebrow">NEXT · PRACTICE</span>
          <h2>接下来不是看视频，而是亲自检验</h2>
          <p>{task.title ?? goal?.title ?? '本次实践'}：{task.student_action}</p>
          <ol><li>先预测结果或写下实现思路</li><li>亲自完成活动并观察真实结果</li><li>根据差异修改，再换条件验证</li><li>说明原理和仍不确定的部分</li></ol>
          <button className="button primary learning-start-button" type="button" disabled={starting} onClick={beginPractice}>{starting ? '正在保存起点…' : '保存起点，进入动手实践 →'}</button>
          <p className="learning-evidence-note">打开页面、自我判断或一次运行都不等于掌握。只有符合目标要求的作品和核验依据才更新学习状态。</p>
          <p role="status" aria-live="polite">{message}</p>
        </section>
        <section className="learning-ai-card">
          <span className="eyebrow">AI LEARNING SUPPORT</span>
          <h3>{catalog === null ? '正在检查 AI 学习助手…' : catalog.profiles.length ? `已检测到 ${catalog.profiles.length} 个可用模型` : '当前没有可用 AI 模型'}</h3>
          <p>{catalog === null ? '正在读取当前预览的模型配置。' : catalog.profiles.length ? '模型已配置，但本课程活动的通用 AI 对话辅导尚未接入；不会用静态话术伪装成 AI。' : '此预览没有配置模型，所以当前页面不能提供真实 AI 对话。原理、活动和本地记录仍可继续使用。'}</p>
          {catalog?.profiles.length ? <p className="learning-model-list">{catalog.profiles.map(profile => `${profile.provider} · ${profile.label}`).join('；')}</p> : null}
        </section>
      </aside>
    </div>
  </main>
}
