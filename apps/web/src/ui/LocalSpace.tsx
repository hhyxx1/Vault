import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLocal } from '../local/LocalProvider'
import { useAuth } from '../local/AuthProvider'
import { clearGuestSpace, database, type SyncItem } from '../local/database'
import { localTabId } from '../local/identity'
import { chooseLocalConflict, chooseRemoteConflict } from '../local/sync'
import { TRACE_OBJECTIVE, IMPLEMENT_OBJECTIVE, type ArtifactRevision, type TeacherDraft } from '../domain/learning'
import { liveQuery } from 'dexie'
const objectLabels = { draft: '学习作品', revision: '作品版本', evidence: '核验记录', help: '帮助记录', teacher_draft: '备课草稿', personal_course: '个人课程', personal_course_version: '课程范围版本', personal_attempt: '个人学习尝试', personal_assist: '个人课程助手建议', course_attempt: '课程实践尝试', structured_attempt: '结构化实践尝试', position: '学习位置' }
const statusLabels = { pending: '等待云端确认', synced: '已同步', conflict: '有修改冲突', rejected: '未同步', dependency_pending: '等待关联记录' }
const reasonLabels: Record<string, string> = {
  TEACHER_ACCOUNT_REQUIRED: '学生账号的备课草稿仅保留本机，未上传。', ATTACHMENT_UNSUPPORTED: '附件同步尚未开放，请保留本机附件。',
  INVALID_PAYLOAD: '记录格式暂时不符合要求，已保留本机原件。', SOURCE_SPACE_MISMATCH: '记录与账号空间不一致，已停止上传。', SOURCE_OBJECT_MISMATCH: '记录标识与作品不一致，已停止上传。',
  PAYLOAD_HASH_MISMATCH: '记录内容校验不一致，已停止上传。', OP_IDEMPOTENCY_CONFLICT: '此前固定请求与当前内容不一致，请保留原件后重新处理。',
  REVISION_NOT_SYNCED: '正在等待关联的作品版本同步。', HELP_NOT_SYNCED: '正在等待关联的帮助记录同步。', BASE_OBJECT_NOT_SYNCED: '正在等待此记录的基础版本同步。',
  REVISION_DELETED: '关联的作品版本已删除，当前记录保留本机。', EVIDENCE_REVISION_MISMATCH: '核验记录与作品版本不一致，未上传。', EVIDENCE_CONTENT_MISMATCH: '核验内容与作品不一致，未上传。',
  HELP_REFERENCE_MISMATCH: '帮助引用不属于同一学习范围，未上传。', OBJECT_DELETED: '云端此记录已删除，本机原件已保留。', VERSION_CONFLICT: '云端与本机都有修改，请选择保留哪一版。', IMMUTABLE_HISTORY: '历史版本不能直接修改，请保留原件并创建新版本。',
  PERSONAL_COURSE_NOT_SYNCED: '正在等待个人课程先同步。', PERSONAL_COURSE_DELETED: '关联的个人课程在云端不可用，尝试仍保留本机。', PERSONAL_TOPIC_MISMATCH: '学习点与云端课程范围不一致，请先处理课程冲突。', PERSONAL_COURSE_IDENTITY_MISMATCH: '已有学习点不能删除或改写；请保留原件并建立新学习点。', PERSONAL_RECORD_DELETE_UNSUPPORTED: '个人课程和尝试的云端删除尚未开放，请保留本机记录。',
  PERSONAL_COURSE_VERSION_REQUIRED: '新学习尝试必须关联一个已确认的课程范围版本。', PERSONAL_COURSE_VERSION_NOT_SYNCED: '正在等待个人课程的确认范围版本同步。', PERSONAL_COURSE_VERSION_MISMATCH: '尝试引用的确认范围与课程或学习点不一致，未上传。', PERSONAL_COURSE_VERSION_CONFLICT: '另一个设备已确认同一序号的范围版本，请先保留两边记录并处理冲突。',
  PERSONAL_ATTEMPT_NOT_SYNCED: '正在等待助手所依据的学习尝试同步。', PERSONAL_ASSIST_REFERENCE_MISMATCH: '助手建议所关联的课程、范围或尝试不一致，未上传。', COURSE_ATTEMPT_LOCKED: '已提交或核验的课程作品不能改写，请创建新版本。',
}
function syncReason(item: SyncItem) {
  if (item.objectType === 'personal_course' && item.status === 'conflict') return '这门课程在本机和云端都有修改。当前不能自动合并新增学习点；请先导出本机记录，再决定是否采用云端版本。'
  return item.reason ? reasonLabels[item.reason] ?? (/^[A-Z_]+$/.test(item.reason) ? '此记录暂时未能同步，已保留本机，请重试或导出。' : item.reason) : undefined
}
export default function LocalSpace() {
  const local = useLocal(); const auth = useAuth(); const { spaceId, evidence, courseAttempts, structuredAttempts, help, lastObjective, spaces, syncItems, syncing, syncError, syncNow } = local
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false)
  const [revisions, setRevisions] = useState<ArtifactRevision[]>([]); const [teacherDrafts, setTeacherDrafts] = useState<TeacherDraft[]>([])
  const [personalNames, setPersonalNames] = useState<Record<string, string>>({})
  const [personalAssistCount, setPersonalAssistCount] = useState(0)
  useEffect(() => { setRevisions([]); setTeacherDrafts([]); const subscription = liveQuery(async () => ({ revisions: await database.revisions.where('spaceId').equals(spaceId).toArray(), teacherDrafts: await database.teacherDrafts.where('spaceId').equals(spaceId).toArray() })).subscribe({ next: value => { setRevisions(value.revisions); setTeacherDrafts(value.teacherDrafts) }, error: () => setMessage('暂时无法读取记录名称。') }); return () => subscription.unsubscribe() }, [spaceId])
  useEffect(() => { setPersonalNames({}); setPersonalAssistCount(0); const subscription = liveQuery(async () => ({ courses: await database.personalCourses.where('spaceId').equals(spaceId).toArray(), scopeVersions: await database.personalCourseVersions.where('spaceId').equals(spaceId).toArray(), attempts: await database.personalAttempts.where('spaceId').equals(spaceId).toArray(), assists: await database.personalAssists.where('spaceId').equals(spaceId).toArray() })).subscribe({ next: value => { const names: Record<string, string> = {}; for (const course of value.courses) names[`course:${course.id}`] = course.title; for (const scope of value.scopeVersions) names[`scope:${scope.id}`] = `${names[`course:${scope.courseId}`] ?? scope.title} · 范围 v${scope.version}`; for (const attempt of value.attempts) names[`attempt:${attempt.id}`] = `${names[`course:${attempt.courseId}`] ?? '个人课程'} · 一次学习尝试`; for (const assist of value.assists) names[`assist:${assist.id}`] = `${names[`course:${assist.courseId}`] ?? '个人课程'} · 一次助手建议`; setPersonalNames(names); setPersonalAssistCount(value.assists.length) }, error: () => setMessage('暂时无法读取个人课程记录名称。') }); return () => subscription.unsubscribe() }, [spaceId])
  function objectiveName(id: string) { return id === TRACE_OBJECTIVE ? '栈状态推演' : id === IMPLEMENT_OBJECTIVE ? '括号匹配实现' : '课程学习作品' }
  function recordName(item: SyncItem) {
    if (item.objectType === 'draft') return `${objectiveName(item.objectId)} · 当前作品`
    if (item.objectType === 'position') return '继续学习位置'
    if (item.objectType === 'revision') { const revision = revisions.find(record => record.revisionId === item.objectId); return revision ? `${objectiveName(revision.id)} · 作品版本 ${revision.version}` : '已保存的作品版本' }
    if (item.objectType === 'evidence') { const record = evidence.find(record => record.id === item.objectId); return record ? `${objectiveName(record.objectiveId)} · 版本 ${record.revisionVersion} 的核验记录` : '学习核验记录' }
    if (item.objectType === 'help') { const record = help.find(record => record.id === item.objectId); return record ? `${objectiveName(record.objectiveId)} · ${record.kind === 'answer' ? '查看答案' : '使用提示'}` : '学习帮助记录' }
    if (item.objectType === 'personal_course') return personalNames[`course:${item.objectId}`] ?? '个人课程'
    if (item.objectType === 'personal_course_version') return personalNames[`scope:${item.objectId}`] ?? '个人课程范围版本'
    if (item.objectType === 'personal_attempt') return personalNames[`attempt:${item.objectId}`] ?? '个人学习尝试'
    if (item.objectType === 'personal_assist') return personalNames[`assist:${item.objectId}`] ?? '个人课程助手建议'
    if (item.objectType === 'course_attempt') return '离散数学 · 命题逻辑真值表尝试'
    return teacherDrafts.find(record => record.id === item.objectId)?.title ?? '私人备课草稿'
  }
  const active = spaces.find(space => space.id === spaceId)
  async function exportSpace() {
    setBusy(true); setMessage('')
    try {
      const data = await database.transaction('r', [database.drafts, database.revisions, database.evidence, database.help, database.teacherDrafts, database.personalCourses, database.personalCourseVersions, database.personalAttempts, database.personalAssists, database.courseAttempts], async () => ({
        schemaVersion: '6', kind: 'qionglong-local-export', exportedAt: new Date().toISOString(), spaceId,
        drafts: await database.drafts.where('spaceId').equals(spaceId).toArray(), revisions: await database.revisions.where('spaceId').equals(spaceId).toArray(), evidence: await database.evidence.where('spaceId').equals(spaceId).toArray(), help: await database.help.where('spaceId').equals(spaceId).toArray(), teacherDrafts: await database.teacherDrafts.where('spaceId').equals(spaceId).toArray(), personalCourses: await database.personalCourses.where('spaceId').equals(spaceId).toArray(), personalCourseVersions: await database.personalCourseVersions.where('spaceId').equals(spaceId).toArray(), personalAttempts: await database.personalAttempts.where('spaceId').equals(spaceId).toArray(), personalAssists: await database.personalAssists.where('spaceId').equals(spaceId).toArray(), courseAttempts: await database.courseAttempts.where('spaceId').equals(spaceId).toArray(),
      }))
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = `qionglong-local-${new Date().toISOString().slice(0, 10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage('已生成本地导出文件，请妥善保存。其中包含你的作品与学习记录。')
    } catch { setMessage('导出未完成，请检查本地存储后重试。') } finally { setBusy(false) }
  }
  async function persistStorage() { try { const accepted = navigator.storage?.persist ? await navigator.storage.persist() : false; setMessage(accepted ? '浏览器已允许持久存储。仍建议定期导出重要作品。' : '浏览器没有授予持久存储。请定期导出，避免浏览器清理造成丢失。') } catch { setMessage('无法申请持久存储。请定期导出重要作品。') } }
  async function clearThisGuestSpace() {
    if (auth.account || !spaceId || !window.confirm('清除当前浏览器中这个访客空间的全部作品、课程、尝试、版本、核验和帮助记录？此操作无法撤销。建议先导出；已关联账号的空间不会被清除。')) return
    setBusy(true); setMessage('')
    try {
      await clearGuestSpace(spaceId)
      if (typeof BroadcastChannel !== 'undefined') { const channel = new BroadcastChannel('qionglong-identity'); channel.postMessage({ kind: 'local_space_cleared', sender: localTabId }); channel.close() }
      await local.refresh()
      setMessage('当前访客空间已从本机清除，已建立新的空白空间。')
    } catch (failure) { setMessage(failure instanceof Error ? failure.message : '本机清理未完成，请重试。') }
    finally { setBusy(false) }
  }
  async function resolve(item: SyncItem, choice: 'local' | 'remote') {
    if (item.objectType === 'personal_course' && choice === 'remote' && !window.confirm('这门个人课程在本机和云端都有修改。采用云端版本会替换本机课程范围，本机新增的学习点可能丢失。请先导出全部本地记录并确认后再继续。')) return
    setBusy(true); setMessage('')
    try { if (choice === 'local') await chooseLocalConflict(item); else await chooseRemoteConflict(item); await local.refresh(); if (choice === 'local') await syncNow(); setMessage(choice === 'local' ? '已选择保留本机版本，正在等待新提交的逐项确认。历史冲突分支仍保留。' : '已采用已下载的云端版本。恢复的核验记录仍为待复核。') }
    catch (failure) { setMessage(failure instanceof Error ? failure.message : '冲突处理未完成。') } finally { setBusy(false) }
  }
  return <div className="page local-page"><div className="eyebrow">YOUR RECORDS / LOCAL & CLOUD</div><div className="page-heading"><div><h1>学习先属于你。</h1><p>不用账号，也能保留自己的思路、作品与实际核验。</p></div><span className="small-tag"><span className="status-dot"/>{auth.account ? `${auth.account.account_type === 'teacher' ? '教师' : '学生'}账号 · ${auth.offline ? '离线' : '本机与云端'}` : '未登录 · 本地空间'}</span></div><section className="local-space-layout"><div className="local-statement"><span className="large-orbit" aria-hidden="true">◌</span><h2>保存在这个浏览器里，<br/>回来继续。</h2><p>{auth.account ? '当前账号使用独立学习空间。作品先保存到本机，再逐条等待云端确认；离线修改保留在这里。' : '目前使用未绑定的本地空间。成功保存的记录可以在刷新后恢复；换浏览器、清除站点数据或设备损坏可能造成丢失。'}</p><Link className="button primary" to={`/learn/${lastObjective ?? TRACE_OBJECTIVE}`}>回到学习工作台 <span aria-hidden="true">↗</span></Link></div><div className="local-detail"><h3>当前保存边界</h3><dl><dt>个人学习档案</dt><dd>当前浏览器，按账号空间隔离，本人可导出</dd><dt>在线核验</dt><dd>临时处理本次推演与解释；保存结果后请求服务清理</dd><dt>云端同步</dt><dd>{!auth.account ? '未登录记录保留在本机，登录后自动关联' : active?.pendingOwnerId ? '归属请求已固定到当前账号，正在等待确认；不会转给其他账号' : active?.serverId ? '空间已关联，具体记录是否成功以逐项状态为准' : '空间尚未完成云端关联'}</dd><dt>教师关联</dt><dd>尚未开放；当前记录没有分享给教师</dd></dl><div className="local-counts"><span>{evidence.filter(record => !record.trust).length + courseAttempts.filter(record => record.result && !record.resultTrust).length + structuredAttempts.filter(record => record.result && !record.resultTrust).length} 条本机真实核验</span><span>{evidence.filter(record => record.trust === 'client_reported').length + courseAttempts.filter(record => record.resultTrust === 'client_reported').length + structuredAttempts.filter(record => record.resultTrust === 'client_reported').length} 条恢复待复核</span><span>{help.length + personalAssistCount} 条帮助记录</span></div><div className="local-actions"><button className="button secondary" onClick={exportSpace} disabled={busy || !spaceId}>{busy ? '正在处理…' : '导出全部本地记录 ↓'}</button><button className="text-link" onClick={persistStorage}>申请浏览器持久存储</button>{!auth.account && !active?.pendingOwnerId && !active?.ownerId && <button className="text-link" onClick={clearThisGuestSpace} disabled={busy}>清除此设备的访客记录</button>}</div></div></section>
    {auth.account ? <section className="cloud-boundary sync-section"><div className="section-heading"><div><span className="eyebrow">ACCOUNT / SYNC</span><h2>每条记录，确认后才算同步。</h2></div><button className="button secondary" disabled={syncing || auth.offline || busy} onClick={syncNow}>{syncing ? '正在同步…' : '同步并恢复云端记录'} <span aria-hidden="true">↻</span></button></div><p>跨设备恢复的历史证据仅作为客户端记录，仍需复核。云端与本机都有修改时，保留本机作品并显示冲突。</p>{spaces.length > 1 && <div className="space-switch"><label htmlFor="record-space">当前账号的学习空间</label><select id="record-space" value={spaceId} onChange={event => local.selectSpace(event.target.value).catch(failure => setMessage(failure.message))}>{spaces.map((space, index) => <option key={space.id} value={space.id}>空间 {index + 1} · {space.id === spaceId ? '当前设备打开' : '可恢复继续'} · {new Date(space.createdAt).toLocaleDateString('zh-CN')}</option>)}</select></div>}<div className="sync-counts" aria-label="同步统计"><span><strong>{syncItems.filter(item => item.status === 'synced').length}</strong>已确认</span><span><strong>{syncItems.filter(item => item.status === 'pending' || item.status === 'dependency_pending').length}</strong>待同步</span><span><strong>{syncItems.filter(item => item.status === 'conflict' || item.status === 'rejected').length}</strong>需处理</span></div>{(syncError || auth.offline) && <p className="inline-message" role="status">{syncError ?? '当前离线，云同步暂停。本机记录仍可继续编辑。'}</p>}{syncItems.length ? <ul className="sync-record-list">{syncItems.map(item => <li key={item.key}><div className="sync-record-title"><strong>{objectLabels[item.objectType]}</strong><span className={`sync-badge ${item.status}`}>{item.reason === 'TEACHER_ACCOUNT_REQUIRED' ? '仅本机保留' : statusLabels[item.status]}</span></div><p className="sync-record-id">{recordName(item)}</p><details className="sync-record-info"><summary>查看记录编号</summary><code>{item.objectId}</code></details>{item.reason && <p className="field-note">{syncReason(item)}</p>}{item.status === 'conflict' && <div className="sync-conflict-actions">{['draft', 'teacher_draft', 'position'].includes(item.objectType) && <button className="text-link" disabled={busy || syncing} onClick={() => resolve(item, 'local')}>保留本机版本并重新提交 →</button>}<button className="text-link" disabled={busy || syncing || item.remotePayload === undefined} onClick={() => resolve(item, 'remote')}>采用云端版本 →</button><span>可先导出本机记录留存</span></div>}</li>)}</ul> : <p className="field-note">当前空间还没有待同步的作品。学习产生的记录会先保存到本机。</p>}</section> : <section className="cloud-boundary"><span className="eyebrow">账号与同步</span><h2>登录后承接，不让已有学习重新开始。</h2><p>登录会自动把尚未绑定的本地空间关联到你的账号，再逐条上传。退出后打开新的访客空间；已有账号记录不会向其他账号显示。</p><Link className="button secondary" to="/account">登录并关联本机记录 ↗</Link></section>}{message && <div className="inline-message" role="status">{message}</div>}</div>
}
