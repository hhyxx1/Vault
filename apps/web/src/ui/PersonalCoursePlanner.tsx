import { useEffect, useState } from 'react'
import { listModelProfiles, requestCourseDiscovery, type CourseDiscoveryProposal } from '../api/verification'

export default function PersonalCoursePlanner({ courseName, goal, onDraft }: {
  courseName: string
  goal: string
  onDraft: (proposal: CourseDiscoveryProposal) => void
}) {
  const [models, setModels] = useState<{ id: string; label: string }[]>([])
  const [modelId, setModelId] = useState('')
  const [modelLoaded, setModelLoaded] = useState(false)
  const [currentKnowledge, setCurrentKnowledge] = useState('')
  const [followup, setFollowup] = useState('')
  const [turns, setTurns] = useState<{ role: 'learner' | 'assistant'; content: string }[]>([])
  const [lastAssistant, setLastAssistant] = useState('')
  const [question, setQuestion] = useState('')
  const [reply, setReply] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [hasDraft, setHasDraft] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    listModelProfiles(controller.signal).then(catalog => {
      setModels(catalog.profiles)
      setModelId(catalog.task_defaults.course_discovery ?? catalog.profiles[0]?.id ?? '')
    }).catch(() => setModels([])).finally(() => setModelLoaded(true))
    return () => controller.abort()
  }, [])

  async function consult() {
    if (!modelId || !consent || busy) return
    setBusy(true); setError('')
    const nextTurns = question && followup.trim()
      ? [...turns, { role: 'assistant' as const, content: question }, { role: 'learner' as const, content: followup.trim() }]
      : hasDraft && followup.trim()
        ? [...turns, ...(lastAssistant ? [{ role: 'assistant' as const, content: lastAssistant }] : []), { role: 'learner' as const, content: followup.trim() }]
        : turns
    try {
      const result = await requestCourseDiscovery({ request_id: crypto.randomUUID(), model_profile_id: modelId,
        course_name: courseName, learning_goal: goal, current_knowledge: currentKnowledge.trim(), turns: nextTurns,
        disclosure_accepted: true })
      setTurns(nextTurns)
      setReply(result.message)
      setLastAssistant(result.message)
      if (result.status === 'clarifying') {
        setQuestion(result.clarifying_question ?? '')
        setFollowup('')
        setHasDraft(false)
      } else if (result.proposal) {
        setQuestion('')
        setFollowup('')
        setHasDraft(true)
        onDraft(result.proposal)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'AI 暂时无法回应，请稍后重试或手动建立课程。')
    } finally { setBusy(false) }
  }

  const available = modelLoaded && models.length > 0
  return <section className="course-discovery" aria-labelledby="course-discovery-title">
    <div className="course-discovery-heading"><span className="eyebrow">AI COURSE PLANNER</span><h3 id="course-discovery-title">不必先知道知识点，和 AI 一起梳理。</h3><p>说明课程名称和你想理解的事。AI 可以先问清楚，再提出一份可编辑的个人路线。</p></div>
    {models.length > 1 && <label htmlFor="course-discovery-model">规划模型<select id="course-discovery-model" value={modelId} onChange={event => setModelId(event.target.value)}>{models.map(model => <option key={model.id} value={model.id}>{model.label}</option>)}</select></label>}
    <label htmlFor="course-current-knowledge">你现在了解多少？（不知道也可以直说）</label>
    <textarea id="course-current-knowledge" rows={2} maxLength={1200} value={currentKnowledge} onChange={event => setCurrentKnowledge(event.target.value)} placeholder="例如：我学过 IP 地址，但不知道网络课应该从哪里开始。"/>
    {(question || hasDraft) && <label htmlFor="course-followup">{question ? `AI 想确认：${question}` : '想让 AI 怎样调整这份路线？'}</label>}
    {(question || hasDraft) && <textarea id="course-followup" rows={2} maxLength={1200} value={followup} onChange={event => setFollowup(event.target.value)} placeholder={question ? '用自己的话回答即可。' : '可补充你希望多做实验、少写代码等偏好。'}/>}
    <label className="course-discovery-consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)}/><span>我同意将上面填写的课程描述、基础情况和对话发送到当前配置的模型服务，以生成私人草案。草案未经审校；请勿输入敏感个人信息。</span></label>
    {!modelLoaded ? <p className="field-note" role="status">正在检查可用的 AI 模型…</p> : !available ? <p className="course-discovery-unavailable" role="status">当前服务没有配置可用模型。你仍可在下方手动填写目标和学习点；配置模型后可使用 AI 规划。</p> : <button type="button" className="button secondary" onClick={consult} disabled={!consent || !courseName.trim() || busy || (!!question && !followup.trim())}>
      {busy ? 'AI 正在整理…' : question ? '回答并继续规划' : hasDraft ? '根据补充内容更新草案' : '请 AI 帮我整理学习路线'} <span aria-hidden="true">↗</span>
    </button>}
    {reply && <div className="course-discovery-reply" aria-live="polite"><span className="eyebrow">AI 的回应 · 待你确认</span><p>{reply}</p></div>}
    {error && <p className="inline-message" role="status">{error}</p>}
  </section>
}
