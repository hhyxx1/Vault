import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLocal } from '../local/LocalProvider'
import { useAuth } from '../local/AuthProvider'
import { AccountApiError } from '../api/accounts'
import type { CodeAttempt } from '../domain/code'
import {
  PROVENANCE_DESCRIPTION,
  PROVENANCE_LABEL,
  REVIEW_STATUS_LABEL,
  STANDARD_RUBRIC,
  appealReview,
  buildEvidenceSnapshot,
  createReviewAssignment,
  listMyReviews,
  resubmitReview,
  type EvidenceRef,
  type ReviewAssignment,
  type ReviewEvent,
} from '../api/reviews'

type ReviewTarget = {
  key: string
  courseCode: string
  courseVersionId: string
  objectiveCode: string
  activityVersion: string
  artifactId: string
  revisionId: string
  hash: string
  status: string
}

function changedFiles(before: Record<string, string>, after: Record<string, string>): string[] {
  const names = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...names].filter(name => before[name] !== after[name])
}

function supplementsFor(assignment: ReviewAssignment, attempts: CodeAttempt[]): CodeAttempt[] {
  return attempts.filter(attempt => {
    const context = attempt.learning?.context
    return attempt.result && context
      && context.objectiveCode === assignment.objective_code
      && context.activityVersionId === assignment.activity_version
      && attempt.id !== assignment.artifact_revision_id
  })
}

function targetsFromAttempts(attempts: CodeAttempt[]): ReviewTarget[] {
  const seen = new Set<string>()
  const targets: ReviewTarget[] = []
  for (const attempt of attempts) {
    const context = attempt.learning?.context
    if (!attempt.result || !context) continue
    const key = `${context.objectiveCode}:${attempt.id}`
    if (seen.has(key)) continue
    seen.add(key)
    targets.push({
      key,
      courseCode: context.courseId,
      courseVersionId: context.courseVersionId,
      objectiveCode: context.objectiveCode,
      activityVersion: context.activityVersionId,
      artifactId: attempt.artifactId,
      revisionId: attempt.id,
      hash: attempt.requestHash,
      status: attempt.result.status ?? '已完成核验',
    })
  }
  return targets
}

function eventActorLabel(event: ReviewEvent): string {
  if (event.actor_role === 'teacher') {
    return event.teacher_signature?.display_name ?? '已认证教师'
  }
  return '学生本人'
}

function EventTimeline({ assignment }: { assignment: ReviewAssignment }) {
  return (
    <ol className="review-timeline">
      {assignment.events.map(event => (
        <li key={event.id} className={`review-event review-event-${event.type}`}>
          <div className="review-event-head">
            <span className="review-event-actor">{eventActorLabel(event)}</span>
            <span className="review-event-type">
              {event.type === 'submitted' && '提交审阅申请'}
              {event.type === 'claimed' && '教师接单'}
              {event.type === 'decision' &&
                (event.decision === 'approved' ? '教师判定：通过' : '教师判定：退回补证')}
              {event.type === 'resubmitted' && '学生补充材料'}
              {event.type === 'appeal' && '学生提出异议'}
            </span>
            <span className="review-event-time">
              {new Date(event.created_at).toLocaleString('zh-CN')}
            </span>
          </div>
          {event.teacher_signature && (
            <div className="review-provenance review-provenance-teacher">
              {PROVENANCE_LABEL.teacher_review} · {event.teacher_signature.display_name} ·{' '}
              {new Date(event.teacher_signature.signed_at).toLocaleString('zh-CN')} 签署
            </div>
          )}
          {event.rubric_results && (
            <ul className="review-rubric-results">
              {event.rubric_results.map(result => {
                const criterion = STANDARD_RUBRIC.find(item => item.id === result.id)
                return (
                  <li key={result.id}>
                    <span className={`rubric-status rubric-status-${result.status}`}>
                      {result.status === 'met' ? '达到' : result.status === 'not_met' ? '未达到' : '待核'}
                    </span>
                    <strong>{criterion?.title ?? result.id}</strong>
                    <span>{result.note}</span>
                  </li>
                )
              })}
            </ul>
          )}
          {event.evidence_refs && (
            <ul className="review-evidence-refs">
              {event.evidence_refs.map((ref, index) => (
                <li key={index}>
                  新作品版本 {ref.artifact_hash.slice(0, 12)}… · {ref.note}
                </li>
              ))}
            </ul>
          )}
          {event.comment && <p className="review-event-comment">{event.comment}</p>}
        </li>
      ))}
    </ol>
  )
}

function AssignmentCard({ assignment, onChanged, supplements }: {
  assignment: ReviewAssignment
  onChanged: () => Promise<void>
  supplements: CodeAttempt[]
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [appealText, setAppealText] = useState('')
  const [supplementId, setSupplementId] = useState('')
  const [supplementNote, setSupplementNote] = useState('')
  const appealsLeft = Math.max(0, 2 - assignment.appeal_count)
  const selectedSupplement = supplements.find(item => item.id === supplementId) ?? null
  const originalFiles = assignment.work_snapshot[0]?.request?.files ?? {}

  async function run(action: () => Promise<unknown>) {
    setBusy(true); setError('')
    try { await action(); await onChanged() }
    catch (failure) { setError(failure instanceof AccountApiError ? failure.message : '操作未完成，请稍后重试。') }
    finally { setBusy(false) }
  }

  return (
    <article className="review-card">
      <header className="review-card-head">
        <div>
          <h3>{assignment.objective_code}</h3>
          <p className="field-note">
            {assignment.course_code} · 活动版本 {assignment.activity_version}
          </p>
        </div>
        <span className={`review-status review-status-${assignment.status}`}>
          {REVIEW_STATUS_LABEL[assignment.status]}
        </span>
      </header>

      {assignment.status === 'awaiting_review' && (
        assignment.review_service_available
          ? <div className="review-service review-service-open">已进入已认证教师队列，等待教师接单；教师意见只会由真实教师签署。</div>
          : <div className="review-service review-service-closed">当前没有已认证的值班教师。申请已登记，但<strong>尚未安排任何教师接单，也不会自动通过或代签</strong>。</div>
      )}

      <details className="review-evidence-details">
        <summary>本次提交给教师的证据（{assignment.evidence_snapshot.length}）</summary>
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
      </details>

      <EventTimeline assignment={assignment} />

      {assignment.status === 'changes_requested' && (
        <div className="review-action">
          <h4>补充新材料后重新提交</h4>
          <p className="field-note">选择你<strong>修改后并重新运行/核验</strong>的新作品版本；系统会取该版本的真实修订号与内容指纹，不接受手填。</p>
          {supplements.length === 0
            ? <p className="field-note">还没有新的已核验作品版本。请先到知识图谱修改作品并重新运行或核验，再回来补证。</p>
            : <>
              <label htmlFor={`supplement-${assignment.id}`}>新作品版本</label>
              <select id={`supplement-${assignment.id}`} value={supplementId} onChange={event => setSupplementId(event.target.value)}>
                <option value="">请选择…</option>
                {supplements.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.learning?.context?.taskCode === 'semantic-suite' ? '独立语义核验' : '固定条件核验'} · 指纹 {item.requestHash.slice(0, 10)}… · {item.result?.status ?? '已核验'}
                  </option>
                ))}
              </select>
              {selectedSupplement && (
                <details>
                  <summary>修改对照（{changedFiles(originalFiles, selectedSupplement.request.files).length} 个文件有变化）</summary>
                  {changedFiles(originalFiles, selectedSupplement.request.files).length === 0 && <p className="field-note">内容未变化；请先修改作品再重新核验。</p>}
                  {changedFiles(originalFiles, selectedSupplement.request.files).map(name => (
                    <div key={name}>
                      <h5>{name}</h5>
                      <pre className="artifact-source">{selectedSupplement.request.files[name] ?? '（已删除）'}</pre>
                    </div>
                  ))}
                </details>
              )}
              <label htmlFor={`note-${assignment.id}`}>补充说明</label>
              <textarea id={`note-${assignment.id}`} rows={3} value={supplementNote}
                onChange={event => setSupplementNote(event.target.value)} placeholder="说明你针对退回意见做了哪些修改、新证据是什么。" />
              <button className="button primary" disabled={busy || !selectedSupplement || !supplementNote.trim()}
                onClick={() => run(async () => {
                  if (!selectedSupplement) return
                  const refs: EvidenceRef[] = [{
                    artifact_revision_id: selectedSupplement.id,
                    artifact_hash: selectedSupplement.requestHash,
                    note: supplementNote.trim(),
                  }]
                  await resubmitReview(assignment.id, supplementNote.trim(), refs)
                  setSupplementId(''); setSupplementNote('')
                })}>提交补充材料</button>
            </>}
        </div>
      )}

      {(assignment.status === 'approved' || assignment.status === 'changes_requested') && appealsLeft > 0 && (
        <div className="review-action">
          <h4>对结论有异议？（还可申诉 {appealsLeft} 次）</h4>
          <textarea rows={2} value={appealText} onChange={event => setAppealText(event.target.value)}
            placeholder="具体说明你不同意哪一条判定、依据是什么。教师会据此复核。" />
          <button className="button" disabled={busy || !appealText.trim()}
            onClick={() => run(async () => { await appealReview(assignment.id, appealText.trim()); setAppealText('') })}>
            提出异议并请求复核
          </button>
        </div>
      )}
      {error && <div className="inline-message" role="alert">{error}</div>}
    </article>
  )
}

export default function Reviews() {
  const { spaceId, codeAttempts } = useLocal()
  const { account, ready } = useAuth()
  const [assignments, setAssignments] = useState<ReviewAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selected, setSelected] = useState('')
  const [studentNote, setStudentNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const targets = useMemo(() => targetsFromAttempts(codeAttempts), [codeAttempts])
  const openKeys = useMemo(
    () => new Set(assignments
      .filter(item => ['awaiting_review', 'claimed', 'resubmitted', 'in_appeal', 'changes_requested'].includes(item.status))
      .map(item => `${item.objective_code}:${item.artifact_revision_id}`)),
    [assignments],
  )
  const availableTargets = targets.filter(item => !openKeys.has(item.key))

  async function refresh() {
    try { setAssignments(await listMyReviews()); setLoadError('') }
    catch (failure) {
      setLoadError(failure instanceof AccountApiError && failure.status === 401
        ? '登录后才能查看人工审阅进度。'
        : '暂时无法读取审阅进度，联网后重试。')
    }
    finally { setLoading(false) }
  }
  useEffect(() => { if (account?.account_type === 'student') { refresh().catch(() => undefined) } }, [account?.id, account?.account_type])

  async function submit() {
    const target = availableTargets.find(item => item.key === selected)
    if (!account || !target) return
    setSubmitting(true); setSubmitError('')
    try {
      const evidence = buildEvidenceSnapshot({
        serverSummary: `服务端执行/核验状态：${target.status}；作品版本 hash ${target.hash.slice(0, 16)}…。规则结果仅说明本次运行，不代表教师已认可。`,
        studentSummary: studentNote,
      })
      const assignment = await createReviewAssignment({
        assignment_id: crypto.randomUUID(),
        expected_account_id: account.id,
        space_id: spaceId,
        audience: 'platform_teachers',
        teacher_account_id: null,
        course_code: target.courseCode,
        course_version_id: target.courseVersionId,
        objective_code: target.objectiveCode,
        activity_version: target.activityVersion,
        artifact_id: target.artifactId,
        artifact_revision_id: target.revisionId,
        artifact_hash: target.hash,
        rubric: STANDARD_RUBRIC,
        evidence_snapshot: evidence,
        student_note: studentNote.trim() || null,
      })
      setAssignments(current => [...current, assignment])
      setSelected(''); setStudentNote('')
    } catch (failure) {
      setSubmitError(failure instanceof AccountApiError ? failure.message : '提交未完成，请稍后重试。')
    } finally { setSubmitting(false) }
  }

  if (!ready) return <div className="page page-loading" role="status">正在确认账号…</div>
  if (!account) return (
    <div className="page reviews-page">
      <div className="eyebrow">REVIEW / HUMAN</div>
      <h1>人工审阅</h1>
      <p>请先<Link to="/account">登录学生账号</Link>，再提交作品给教师审阅。</p>
    </div>
  )
  if (account.account_type !== 'student') return (
    <div className="page reviews-page">
      <div className="eyebrow">REVIEW / HUMAN</div>
      <h1>人工审阅</h1>
      <p>学生在本页提交作品审阅；教师请前往<Link to="/teacher">教师备课 · 审阅队列</Link>。</p>
    </div>
  )

  return (
    <div className="page reviews-page">
      <div className="eyebrow">REVIEW / HUMAN</div>
      <div className="page-heading">
        <div>
          <h1>人工审阅与异议</h1>
          <p>把一个已完成真实核验的作品版本提交给教师，按客观结果、解释设计、独立迁移逐条审阅；你可以补充材料或对结论提出异议。</p>
        </div>
        <span className="small-tag">规则结果 / 模型建议 / 本人自述 / 教师意见 / 专业审校 五类来源分开</span>
      </div>
      <div className="review-boundary inline-message">
        专业审校当前<strong>未开通</strong>；模型建议不能单独作为达标依据；没有真实已认证教师时，系统不会显示“已安排教师”，也不会自动签名或通过。
      </div>

      <section className="review-submit">
        <div className="section-heading"><h2>提交新的审阅申请</h2><span>{availableTargets.length} 个可提交版本</span></div>
        {availableTargets.length === 0
          ? <p className="field-note">还没有可提交的已核验作品版本。先到知识图谱完成一次真实运行或核验，再回来提交。</p>
          : <>
            <label htmlFor="review-target">选择已核验的作品版本</label>
            <select id="review-target" value={selected} onChange={event => setSelected(event.target.value)}>
              <option value="">请选择…</option>
              {availableTargets.map(target => (
                <option key={target.key} value={target.key}>
                  {target.objectiveCode} · {target.status} · {target.hash.slice(0, 10)}…
                </option>
              ))}
            </select>
            <label htmlFor="review-note">给教师的设计与思路说明</label>
            <textarea id="review-note" rows={4} value={studentNote} onChange={event => setStudentNote(event.target.value)}
              placeholder="说明你的设计、如何保证独立输入也成立、哪些地方希望教师重点看。" />
            <button className="button primary" disabled={submitting || !selected} onClick={submit}>
              {submitting ? '正在提交…' : '提交人工审阅'}
            </button>
          </>}
        {submitError && <div className="inline-message" role="alert">{submitError}</div>}
      </section>

      <section className="review-list">
        <div className="section-heading"><h2>我的审阅进度</h2><span>{assignments.length} 个工单</span></div>
        {loading ? <p className="field-note">正在读取…</p>
          : loadError ? <div className="inline-message">{loadError}</div>
          : assignments.length === 0 ? <p className="field-note">还没有提交过人工审阅。</p>
          : assignments.slice().sort((a, b) => b.updated_at.localeCompare(a.updated_at))
            .map(assignment => <AssignmentCard key={assignment.id} assignment={assignment} onChanged={refresh} supplements={supplementsFor(assignment, codeAttempts)} />)}
      </section>
    </div>
  )
}
