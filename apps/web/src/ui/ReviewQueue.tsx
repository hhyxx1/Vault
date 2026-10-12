import { useEffect, useState } from 'react'
import { AccountApiError } from '../api/accounts'
import {
  PROVENANCE_DESCRIPTION,
  PROVENANCE_LABEL,
  REVIEW_STATUS_LABEL,
  claimReview,
  decideReview,
  listTeacherQueue,
  type ReviewAssignment,
  type RubricCriterionStatus,
} from '../api/reviews'
import { useAuth } from '../local/AuthProvider'

type RubricForm = Record<string, { status: RubricCriterionStatus | ''; note: string }>

function initialRubricForm(assignment: ReviewAssignment): RubricForm {
  const form: RubricForm = {}
  for (const criterion of assignment.rubric) form[criterion.id] = { status: '', note: '' }
  return form
}

function QueueItem({ assignment, onChanged }: {
  assignment: ReviewAssignment
  onChanged: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<RubricForm>(() => initialRubricForm(assignment))
  const [comment, setComment] = useState('')
  const mine = Boolean(assignment.claimed_by_account_id)
  const canDecide = ['claimed', 'resubmitted', 'in_appeal'].includes(assignment.status)

  async function run(action: () => Promise<unknown>) {
    setBusy(true); setError('')
    try { await action(); await onChanged() }
    catch (failure) { setError(failure instanceof AccountApiError ? failure.message : '操作未完成，请稍后重试。') }
    finally { setBusy(false) }
  }

  const everyCriterionAnswered = assignment.rubric.every(criterion => {
    const entry = form[criterion.id]
    return entry && entry.status !== '' && entry.note.trim().length > 0
  })

  return (
    <article className="review-card teacher-review-card">
      <header className="review-card-head">
        <div>
          <h3>{assignment.objective_code}</h3>
          <p className="field-note">
            {assignment.course_code} · 活动版本 {assignment.activity_version} · 作品{' '}
            {assignment.artifact_hash.slice(0, 12)}…
          </p>
        </div>
        <span className={`review-status review-status-${assignment.status}`}>
          {REVIEW_STATUS_LABEL[assignment.status]}
        </span>
      </header>

      <details className="review-evidence-details" open={!mine}>
        <summary>学生提交的证据（{assignment.evidence_snapshot.length}）</summary>
        <ul className="review-evidence-list">
          {assignment.evidence_snapshot.map((item, index) => (
            <li key={index}>
              <span className={`review-provenance review-provenance-${item.kind}`}>
                {PROVENANCE_LABEL[item.kind]}
              </span>
              <p>{item.summary}</p>
              <span className="field-note">{PROVENANCE_DESCRIPTION[item.kind]}</span>
            </li>
          ))}
        </ul>
        <p className="field-note review-provenance review-provenance-professional_review">
          {PROVENANCE_LABEL.professional_review}：{PROVENANCE_DESCRIPTION.professional_review}
        </p>
      </details>

      {!mine && assignment.status === 'awaiting_review' && (
        <button className="button primary" disabled={busy}
          onClick={() => run(() => claimReview(assignment.id))}>接单审阅</button>
      )}

      {mine && canDecide && (
        <div className="review-action teacher-decision">
          <h4>逐条审阅（依据独立表现，不按字数或关键词给分）</h4>
          {assignment.rubric.map(criterion => (
            <fieldset key={criterion.id} className="rubric-field">
              <legend>{criterion.title}</legend>
              <div className="rubric-choices">
                {(['met', 'needs_review', 'not_met'] as RubricCriterionStatus[]).map(status => (
                  <label key={status}>
                    <input type="radio" name={`${assignment.id}-${criterion.id}`}
                      checked={form[criterion.id]?.status === status}
                      onChange={() => setForm(current => ({
                        ...current,
                        [criterion.id]: { ...current[criterion.id], status },
                      }))} />
                    {status === 'met' ? '达到' : status === 'not_met' ? '未达到' : '待核'}
                  </label>
                ))}
              </div>
              <textarea rows={2} placeholder="写出你本人的判断理由（必须基于当前作品与证据）"
                value={form[criterion.id]?.note ?? ''}
                onChange={event => setForm(current => ({
                  ...current,
                  [criterion.id]: { ...current[criterion.id], note: event.target.value },
                }))} />
            </fieldset>
          ))}
          <label htmlFor={`decision-comment-${assignment.id}`}>总评意见</label>
          <textarea id={`decision-comment-${assignment.id}`} rows={3} value={comment}
            onChange={event => setComment(event.target.value)} placeholder="给学生的总体反馈。" />
          <div className="review-decision-buttons">
            <button className="button primary" disabled={busy || !everyCriterionAnswered || comment.trim().length < 1}
              onClick={() => run(async () => {
                await decideReview(assignment.id, 'approved',
                  assignment.rubric.map(criterion => ({
                    id: criterion.id,
                    status: form[criterion.id].status as RubricCriterionStatus,
                    note: form[criterion.id].note.trim(),
                  })), comment.trim())
              })}>判定通过</button>
            <button className="button" disabled={busy || !everyCriterionAnswered || comment.trim().length < 1}
              onClick={() => run(async () => {
                await decideReview(assignment.id, 'changes_requested',
                  assignment.rubric.map(criterion => ({
                    id: criterion.id,
                    status: form[criterion.id].status as RubricCriterionStatus,
                    note: form[criterion.id].note.trim(),
                  })), comment.trim())
              })}>退回补充材料</button>
          </div>
        </div>
      )}

      {assignment.events.length > 0 && (
        <details className="review-evidence-details">
          <summary>工单历史（{assignment.events.length}）</summary>
          <ol className="review-timeline">
            {assignment.events.map(event => (
              <li key={event.id} className={`review-event review-event-${event.type}`}>
                <span className="review-event-type">
                  {event.type === 'submitted' && '学生提交'}
                  {event.type === 'claimed' && '教师接单'}
                  {event.type === 'decision' && (event.decision === 'approved' ? '判定通过' : '退回补证')}
                  {event.type === 'resubmitted' && '学生补证'}
                  {event.type === 'appeal' && `学生异议（第 ${assignment.appeal_count} 次）`}
                </span>
                {event.comment && <span className="review-event-comment">{event.comment}</span>}
              </li>
            ))}
          </ol>
        </details>
      )}
      {error && <div className="inline-message" role="alert">{error}</div>}
    </article>
  )
}

export default function ReviewQueue() {
  const { account } = useAuth()
  const [items, setItems] = useState<ReviewAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const verified = account?.account_type === 'teacher' && account.teacher_verification_state === 'verified'

  async function refresh() {
    try { setItems(await listTeacherQueue()); setError('') }
    catch (failure) {
      if (failure instanceof AccountApiError && failure.status === 403) {
        setError('教师身份尚未通过认证，不能接单或签署审阅。')
      } else {
        setError('暂时无法读取审阅队列，联网后重试。')
      }
    } finally { setLoading(false) }
  }
  useEffect(() => { if (verified) { refresh().catch(() => undefined) } else { setLoading(false) } }, [verified, account?.id])

  if (!account || account.account_type !== 'teacher') return null
  if (!verified) {
    return (
      <section className="review-queue">
        <div className="section-heading"><h2>人工审阅队列</h2></div>
        <div className="inline-message">
          教师身份当前为“{account.teacher_verification_state ?? '未认证'}”，<strong>不能接单、判定或签署任何审阅</strong>。
          完成教师认证后才会看到学生的审阅申请；系统不会代替教师签名。
        </div>
      </section>
    )
  }

  return (
    <section className="review-queue">
      <div className="section-heading"><h2>人工审阅队列</h2><span>{items.length} 个待处理 / 我接单</span></div>
      <p className="field-note">
        你只能看到授权给你的工单；接单后其他教师不能改判。规则结果与模型建议只是线索，达标由你独立判断。
      </p>
      {loading ? <p className="field-note">正在读取队列…</p>
        : error ? <div className="inline-message">{error}</div>
        : items.length === 0 ? <p className="field-note">队列暂时没有分配给你的审阅工单。</p>
        : items.map(assignment => <QueueItem key={assignment.id} assignment={assignment} onChanged={refresh} />)}
    </section>
  )
}
