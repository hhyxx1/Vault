import { useEffect, useRef, useState } from 'react'
import { listModelProfiles, requestPersonalLearningAssist, type LearningAssistIntent, type LearningAssistReply, type ModelCatalog } from '../api/verification'
import type { PersonalAssist, PersonalAttempt, PersonalCourseVersion, PersonalTopic } from '../domain/personal'
import { recordPersonalAssist } from '../local/database'

type Intent = Exclude<LearningAssistIntent, 'result_feedback'>
const intentLabels: Record<Intent, string> = {
  diagnose: '诊断下一步该检查什么', hint: '给一个提示，我继续做',
  explain: '解释当前不明白的原理', practice: '设计一个新条件练习',
}
const capabilityLabels: Record<string, string> = { text: '文本', reasoning: '推理', vision: '视觉', json: '结构化输出', tools: '工具' }

function attemptExcerpt(attempt: PersonalAttempt): string {
  return [
    `原问题：${attempt.learningQuestion}`, `依据的原理：${attempt.theoryNote}`,
    `实际操作：${attempt.action}`, `观察结果：${attempt.observation}`,
    `当前理解：${attempt.reflection}`, `计划的下一步：${attempt.nextStep}`,
  ].join('\n').slice(0, 4000)
}

export default function PersonalAssistant({ spaceId, scope, topic, attempt, history, enabled, onRetry }: {
  spaceId: string
  scope?: PersonalCourseVersion
  topic: PersonalTopic
  attempt?: PersonalAttempt
  history: PersonalAssist[]
  enabled: boolean
  onRetry: (nextAction: string) => void
}) {
  const [intent, setIntent] = useState<Intent>('hint')
  const [question, setQuestion] = useState('')
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null)
  const [profileOverride, setProfileOverride] = useState('')
  const [consentKey, setConsentKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [unstoredReply, setUnstoredReply] = useState<LearningAssistReply | null>(null)
  const requestAbort = useRef<AbortController | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    listModelProfiles(controller.signal).then(setCatalog).catch(() => { if (!controller.signal.aborted) setCatalog({ profiles: [], task_defaults: {} }) })
    return () => { controller.abort(); requestAbort.current?.abort() }
  }, [])
  const profileId = profileOverride || catalog?.task_defaults[intent] || catalog?.profiles[0]?.id || ''
  const profile = catalog?.profiles.find(item => item.id === profileId)
  const excerpt = attempt ? attemptExcerpt(attempt) : ''
  const currentConsentKey = JSON.stringify([spaceId, scope?.id, topic.id, attempt?.id, excerpt, profileId, intent, question.trim()])
  const canAsk = enabled && !!scope && !!attempt && !!profile && !!question.trim()
  const consentGiven = consentKey === currentConsentKey
  const sortedHistory = [...history].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  async function ask() {
    if (!canAsk || !consentGiven || busy || !scope || !attempt || !profile) return
    requestAbort.current?.abort()
    const controller = new AbortController()
    requestAbort.current = controller
    setBusy(true); setMessage(''); setUnstoredReply(null)
    let received: LearningAssistReply | null = null
    try {
      received = await requestPersonalLearningAssist({
        request_id: crypto.randomUUID(), model_profile_id: profile.id,
        course_id: scope.courseId, scope_version_id: scope.id, topic_id: topic.id, attempt_id: attempt.id,
        course_title: scope.title, course_goal: scope.goal, topic_title: topic.title,
        expected_performance: topic.expectedPerformance, attempt_excerpt: excerpt,
        question: question.trim(), intent, disclosure_accepted: true,
      }, controller.signal)
      if (controller.signal.aborted) return
      if (received.mastery_asserted !== false) throw new Error('助手返回的掌握状态不符合契约，未保存。')
      await recordPersonalAssist({
        id: crypto.randomUUID(), spaceId, courseId: scope.courseId, scopeVersionId: scope.id,
        topicId: topic.id, attemptId: attempt.id, intent, question: question.trim(),
        reply: received.message, nextAction: received.next_action, modelProfileId: profile.id,
        provider: profile.provider, disclosureVersion: 'personal-learning-assist-v1',
        createdAt: new Date().toISOString(),
      })
      setQuestion(''); setConsentKey('')
      setMessage('建议已保存在这次学习尝试旁边。请亲手验证下一步；助手建议不会改变掌握状态。')
    } catch (error) {
      if (controller.signal.aborted) return
      if (received) setUnstoredReply(received)
      setMessage(received ? '已收到建议，但本地保存失败。请先复制以下内容再离开。' : error instanceof Error ? error.message : '学习助手暂时不可用，请保留本机尝试后重试。')
    } finally {
      if (requestAbort.current === controller) requestAbort.current = null
      setBusy(false)
    }
  }

  return <section className="personal-assistant" aria-label="个人课程学习助手">
    <div className="section-heading"><div><span className="eyebrow">AGENTS / NEXT MOVE</span><h3>围绕刚才的尝试，继续做。</h3></div><span>建议 · 未核验</span></div>
    <p className="field-note">助手只参考你明确同意发送的当前范围和已保存尝试；不读取教师资料或受限答案，也不判定掌握。先动手、看结果，再决定下一次如何改。</p>
    {!attempt ? <p className="personal-assist-empty">先完成并保存一次学习尝试，再请助手根据实际操作和观察给出下一步。</p> : !enabled ? <p className="personal-assist-empty">当前课程范围已修改；请先确认新版本并保存一次新尝试，再请求本版本的辅导。</p> : <div className="personal-assist-form">
      <p className="personal-assist-source">基于范围 v{scope?.version} · 最近一次已保存尝试 · {new Date(attempt.createdAt).toLocaleString('zh-CN')}</p>
      <label htmlFor="personal-assist-intent">希望助手怎样帮你？</label>
      <select id="personal-assist-intent" value={intent} onChange={event => { setIntent(event.target.value as Intent); setProfileOverride(''); setConsentKey('') }}>{Object.entries(intentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <label htmlFor="personal-assist-model">本次使用的模型</label>
      <select id="personal-assist-model" value={profileId} disabled={!catalog?.profiles.length} onChange={event => { setProfileOverride(event.target.value); setConsentKey('') }}><option value="" disabled>尚无可用模型</option>{catalog?.profiles.map(item => <option key={item.id} value={item.id}>{item.label} · {item.provider} · {item.capabilities.map(capability => capabilityLabels[capability] ?? capability).join(' / ')}</option>)}</select>
      {profile ? <p className="field-note">本次接收方：<strong>{profile.provider} · {profile.label}</strong>。声明能力：{profile.capabilities.map(capability => capabilityLabels[capability] ?? capability).join('、')}。</p> : <p className="field-note">当前未配置可用模型。已保存的尝试和后续练习仍可继续使用。</p>}
      <label htmlFor="personal-assist-question">你的问题</label>
      <textarea id="personal-assist-question" rows={3} maxLength={1200} value={question} onChange={event => setQuestion(event.target.value)} placeholder="例如：改变哪个条件能检验刚才的解释？"/>
      <label className="assist-consent"><input type="checkbox" checked={consentGiven} disabled={!canAsk || busy} onChange={event => setConsentKey(event.target.checked ? currentConsentKey : '')}/><span>{profile ? `我同意将这门个人课程已确认的目标、当前学习点、最近一次已保存尝试和本次问题发送给 ${profile.provider}（${profile.label}）；不发送账号身份。` : '配置可用模型后才能请求在线辅导。'}仅在点击请求时发送。</span></label>
      <button className="button secondary" type="button" disabled={!canAsk || !consentGiven || busy} onClick={ask}>{busy ? '正在生成建议…' : '请求一次学习帮助'}</button>
    </div>}
    {message && <p className="inline-message" role="status">{message}</p>}
    {unstoredReply && <article className="assistant-answer"><p>{unstoredReply.message}</p><strong>下一步</strong><p>{unstoredReply.next_action}</p><small>本机未保存，请复制后再离开。</small></article>}
    {sortedHistory.length > 0 && <div className="personal-assist-history"><h4>已保存的帮助</h4>{sortedHistory.map(item => <article className="assistant-answer" key={item.id}><span className="eyebrow">{intentLabels[item.intent]} · {item.provider}</span><p>{item.reply}</p><strong>下一步</strong><p>{item.nextAction}</p><small>关联尝试 {item.attemptId.slice(0, 8)} · 范围 v{scope?.id === item.scopeVersionId ? scope.version : '历史'} · {new Date(item.createdAt).toLocaleString('zh-CN')} · 不改变掌握状态</small>{enabled && scope?.id === item.scopeVersionId && <button className="text-link assistant-return" type="button" onClick={() => onRetry(item.nextAction)}>用建议开始下一次尝试 →</button>}</article>)}</div>}
  </section>
}
