import Dexie, { type Table } from 'dexie'
import { newDraft, type Draft, type ArtifactRevision, type EvidenceRecord, type HelpEvent, type TeacherDraft } from '../domain/learning'
import { canonicalJson } from '../domain/integrity'
import type { PersonalAssist, PersonalAttempt, PersonalCourse, PersonalCourseVersion } from '../domain/personal'
import { completeLogicRows, type CourseAttempt } from '../domain/logic'
import type { StructuredAttempt } from '../domain/structured'
import type { CodeAttempt } from '../domain/code'
import { canonicalHash } from '../domain/integrity'

export type ObjectType = 'draft' | 'revision' | 'evidence' | 'help' | 'teacher_draft' | 'personal_course' | 'personal_course_version' | 'personal_attempt' | 'personal_assist' | 'course_attempt' | 'structured_attempt' | 'code_attempt' | 'position'
export type LocalSpaceRecord = { id: string; ownerId: string | null; pendingOwnerId: string | null; serverId: string | null; cursor: string | null; createdAt: string }
export type SyncItem = { key: string; spaceId: string; objectType: ObjectType; objectId: string; version: string; acknowledgedJson: string; status: 'pending' | 'synced' | 'conflict' | 'rejected' | 'dependency_pending'; reason?: string; remoteVersion?: string; modifiedAt?: string; remotePayload?: Record<string, unknown> | null; remoteDeleted?: boolean }
export type ClaimJournal = { claimId: string; expectedAccountId: string; originLocalSpaceId: string; manifestHash: string; manifest: { objectType: ObjectType; objectId: string }[]; state: 'pending' | 'committed'; serverSpaceId?: string }
export type BatchJournal = { id: string; accountId: string; spaceId: string; serverId: string; operations: { op_id: string; object_type: ObjectType; object_id: string; base_version: string; payload_hash: string; payload: unknown }[]; state: 'pending' | 'complete' }
export class LearningDatabase extends Dexie {
  meta!: Table<{ key: string; value: string }, string>
  spaces!: Table<LocalSpaceRecord, string>
  drafts!: Table<Draft, [string, string]>
  revisions!: Table<ArtifactRevision, [string, string]>
  evidence!: Table<EvidenceRecord, [string, string]>
  help!: Table<HelpEvent, [string, string]>
  teacherDrafts!: Table<TeacherDraft, [string, string]>
  personalCourses!: Table<PersonalCourse, [string, string]>
  personalCourseVersions!: Table<PersonalCourseVersion, [string, string]>
  personalAttempts!: Table<PersonalAttempt, [string, string]>
  personalAssists!: Table<PersonalAssist, [string, string]>
  courseAttempts!: Table<CourseAttempt, [string, string]>
  structuredAttempts!: Table<StructuredAttempt, [string, string]>
  codeAttempts!: Table<CodeAttempt, [string, string]>
  syncItems!: Table<SyncItem, string>
  claims!: Table<ClaimJournal, string>
  batches!: Table<BatchJournal, string>
  constructor(name = 'qionglong-unbound-local-v1') {
    super(name)
    this.version(1).stores({ meta: 'key', drafts: 'id, spaceId', revisions: 'revisionId, id, spaceId', evidence: 'id, objectiveId, revisionId, spaceId', help: 'id, objectiveId, spaceId', teacherDrafts: 'id, spaceId' })
    // Compound-key stores preserve v1 records while isolating every account.
    this.version(2).stores({ spaces: 'id, ownerId, pendingOwnerId, serverId', workDrafts: '[spaceId+id], spaceId', workRevisions: '[spaceId+revisionId], id, spaceId', workEvidence: '[spaceId+id], objectiveId, revisionId, spaceId', workHelp: '[spaceId+id], objectiveId, spaceId', workTeacherDrafts: '[spaceId+id], spaceId', syncItems: 'key, spaceId, status', claims: 'claimId, expectedAccountId, originLocalSpaceId', batches: 'id, accountId, spaceId, state' }).upgrade(async tx => {
      for (const [oldName, newName] of [['drafts', 'workDrafts'], ['revisions', 'workRevisions'], ['evidence', 'workEvidence'], ['help', 'workHelp'], ['teacherDrafts', 'workTeacherDrafts']]) {
        const records = await tx.table(oldName).toArray(); if (records.length) await tx.table(newName).bulkPut(records)
      }
      const old = await tx.table('meta').get('spaceId')
      if (old) {
        await tx.table('spaces').put({ id: old.value, ownerId: null, pendingOwnerId: null, serverId: null, cursor: null, createdAt: new Date().toISOString() })
        const position = await tx.table('meta').get('lastObjective')
        if (position) await tx.table('meta').put({ key: `position:${old.value}`, value: position.value })
      }
    })
    this.version(3).stores({ personalCourses: '[spaceId+id], spaceId', personalAttempts: '[spaceId+id], spaceId, courseId, topicId' })
    this.version(4).stores({ personalCourseVersions: '[spaceId+id], spaceId, courseId, [spaceId+courseId], [spaceId+courseId+version]' })
    this.version(5).stores({ personalAssists: '[spaceId+id], spaceId, courseId, topicId, attemptId' })
    this.version(6).stores({ courseAttempts: '[spaceId+id], spaceId, objectiveId, courseCode' })
    // Data-driven structured trace / bracket judgement activities (local-first).
    this.version(7).stores({ structuredAttempts: '[spaceId+id], spaceId, objectiveCode, activityVersion' })
    this.version(8).stores({ codeAttempts: '[spaceId+id], spaceId, activityKey' })
    this.codeAttempts = this.table('codeAttempts')
    this.drafts = this.table('workDrafts'); this.revisions = this.table('workRevisions'); this.evidence = this.table('workEvidence'); this.help = this.table('workHelp'); this.teacherDrafts = this.table('workTeacherDrafts'); this.personalCourses = this.table('personalCourses'); this.personalCourseVersions = this.table('personalCourseVersions'); this.personalAttempts = this.table('personalAttempts'); this.personalAssists = this.table('personalAssists'); this.courseAttempts = this.table('courseAttempts'); this.structuredAttempts = this.table('structuredAttempts')
  }
}

export const database = new LearningDatabase()
export const syncKey = (spaceId: string, type: ObjectType, id: string) => `${spaceId}:${type}:${id}`
export const MAX_SYNC_OPERATION_BYTES = 59000
export async function saveCodeAttempt(attempt: CodeAttempt, db = database): Promise<CodeAttempt> {
  const request = { ...attempt.request, stdin: attempt.request.stdin ?? '' }
  if (await canonicalHash(request) !== attempt.requestHash) throw new Error('代码内容与提交摘要不一致。')
  if (attempt.result && (attempt.result.client_artifact_id !== attempt.artifactId || attempt.result.client_revision_id !== attempt.id || attempt.result.request_sha256 !== attempt.requestHash || attempt.result.mastery_asserted !== false)) throw new Error('运行结果与代码版本不一致。')
  const operation = { op_id: crypto.randomUUID(), object_type: 'code_attempt', object_id: attempt.id, base_version: '9223372036854775806', payload_hash: '0'.repeat(64), payload: attempt }
  if (new TextEncoder().encode(JSON.stringify(operation)).byteLength > MAX_SYNC_OPERATION_BYTES) throw new Error('此代码记录超过可同步大小，请缩小源文件或导出。')
  return db.transaction('rw', [db.codeAttempts, db.meta, db.syncItems], async () => {
    await assertActive(attempt.spaceId, db)
    const old = await db.codeAttempts.get([attempt.spaceId, attempt.id])
    if (old && (old.result || canonicalJson({ ...old, result: null, resultTrust: null, updatedAt: '' }) !== canonicalJson({ ...attempt, request, result: null, resultTrust: null, updatedAt: '' }))) throw new Error('已提交代码不可改写，请创建新版本。')
    const next = { ...structuredClone(attempt), request }
    await db.codeAttempts.put(next)
    await markPending(attempt.spaceId, 'code_attempt', attempt.id, db)
    return next
  })
}
function assertSyncablePersonalRecord(type: 'personal_course' | 'personal_course_version' | 'personal_attempt' | 'personal_assist', id: string, payload: PersonalCourse | PersonalCourseVersion | PersonalAttempt | PersonalAssist) {
  // Use the largest permitted version so a saved record remains uploadable
  // after later edits, including UTF-8 text and operation metadata.
  const operation = { op_id: '00000000-0000-0000-0000-000000000000', object_type: type, object_id: id, base_version: '9223372036854775806', payload_hash: '0'.repeat(64), payload }
  if (new TextEncoder().encode(JSON.stringify(operation)).byteLength + 1 > MAX_SYNC_OPERATION_BYTES) {
    throw new Error('内容超过单条云同步大小限制，尚未保存。请缩短课程内容或本次尝试后重试。')
  }
}
export async function assertActive(spaceId: string, db = database) {
  if ((await db.meta.get('spaceId'))?.value !== spaceId) throw new Error('作品不属于当前本地空间。')
}
export async function markPending(spaceId: string, type: ObjectType, id: string, db = database) {
  const key = syncKey(spaceId, type, id); const old = await db.syncItems.get(key)
  await db.syncItems.put({ key, spaceId, objectType: type, objectId: id, version: old?.version ?? '0', acknowledgedJson: old?.acknowledgedJson ?? '', status: old?.status === 'conflict' ? 'conflict' : 'pending', remoteVersion: old?.remoteVersion, reason: old?.status === 'conflict' ? old.reason : undefined, modifiedAt: crypto.randomUUID() })
}

export async function openLocalSpace(db = database) {
  return db.transaction('rw', [db.meta, db.spaces, db.drafts, db.revisions, db.evidence, db.help, db.teacherDrafts, db.personalCourses, db.personalCourseVersions, db.personalAttempts, db.personalAssists, db.courseAttempts, db.structuredAttempts, db.codeAttempts], async () => {
    const existing = await db.meta.get('spaceId')
    if (existing) return existing.value
    const spaceId = crypto.randomUUID()
    await db.spaces.add({ id: spaceId, ownerId: null, pendingOwnerId: null, serverId: null, cursor: null, createdAt: new Date().toISOString() })
    await db.meta.add({ key: 'spaceId', value: spaceId })
    return spaceId
  })
}
export async function clearGuestSpace(spaceId: string, db = database) {
  return db.transaction('rw', [db.meta, db.spaces, db.drafts, db.revisions, db.evidence, db.help, db.teacherDrafts, db.personalCourses, db.personalCourseVersions, db.personalAttempts, db.personalAssists, db.courseAttempts, db.structuredAttempts, db.codeAttempts, db.syncItems, db.claims, db.batches], async () => {
    const active = await db.meta.get('spaceId')
    const space = await db.spaces.get(spaceId)
    if (active?.value !== spaceId || !space || space.ownerId || space.pendingOwnerId || space.serverId) throw new Error('仅可清理当前未关联账号的访客空间。')
    if (await db.claims.where('originLocalSpaceId').equals(spaceId).count() || await db.batches.where('spaceId').equals(spaceId).count()) throw new Error('此空间存在待确认的账号关联，不能在本机清理。')
    for (const table of [db.drafts, db.revisions, db.evidence, db.help, db.teacherDrafts, db.personalCourses, db.personalCourseVersions, db.personalAttempts, db.personalAssists, db.courseAttempts, db.structuredAttempts, db.codeAttempts, db.syncItems]) await table.where('spaceId').equals(spaceId).delete()
    await db.meta.delete(`position:${spaceId}`)
    await db.meta.delete(`position-time:${spaceId}`)
    await db.spaces.delete(spaceId)
    const nextId = crypto.randomUUID()
    await db.spaces.add({ id: nextId, ownerId: null, pendingOwnerId: null, serverId: null, cursor: null, createdAt: new Date().toISOString() })
    await db.meta.put({ key: 'spaceId', value: nextId })
    return nextId
  })
}
export async function activateSpace(accountId: string | null, freshGuest = false, db = database, isCurrent: () => boolean = () => true) {
  await openLocalSpace(db)
  return db.transaction('rw', [db.meta, db.spaces, db.drafts, db.revisions, db.evidence, db.help, db.teacherDrafts, db.personalCourses, db.personalCourseVersions, db.personalAttempts, db.personalAssists, db.courseAttempts, db.structuredAttempts, db.codeAttempts], async () => {
    if (!isCurrent()) throw new DOMException('身份变化已过期。', 'AbortError')
    const active = await db.spaces.get((await db.meta.get('spaceId'))!.value)
    const own = accountId ? (await db.spaces.where('ownerId').equals(accountId).toArray())[0] ?? (await db.spaces.where('pendingOwnerId').equals(accountId).toArray())[0] : undefined
    if (accountId && own && active && !active.ownerId && !active.pendingOwnerId) {
      const counts = await Promise.all([db.drafts, db.revisions, db.evidence, db.help, db.teacherDrafts, db.personalCourses, db.personalCourseVersions, db.personalAttempts, db.personalAssists, db.courseAttempts, db.structuredAttempts, db.codeAttempts].map(table => table.where('spaceId').equals(active.id).count()))
      if (!counts.some(Boolean)) {
        if (!isCurrent()) throw new DOMException('身份变化已过期。', 'AbortError')
        await db.meta.put({ key: 'spaceId', value: own.id }); return own.id
      }
    }
    if (!isCurrent()) throw new DOMException('身份变化已过期。', 'AbortError')
    if (!freshGuest && active && (accountId ? (active.ownerId === accountId || active.pendingOwnerId === accountId || (!active.ownerId && !active.pendingOwnerId)) : (!active.ownerId && !active.pendingOwnerId))) {
      if (accountId && !active.ownerId && !active.pendingOwnerId) await db.spaces.put({ ...active, pendingOwnerId: accountId })
      if (!isCurrent()) throw new DOMException('身份变化已过期。', 'AbortError')
      return active.id
    }
    const id = own?.id ?? crypto.randomUUID()
    if (!isCurrent()) throw new DOMException('身份变化已过期。', 'AbortError')
    if (!own) await db.spaces.add({ id, ownerId: null, pendingOwnerId: accountId, serverId: null, cursor: null, createdAt: new Date().toISOString() })
    await db.meta.put({ key: 'spaceId', value: id }); if (!isCurrent()) throw new DOMException('身份变化已过期。', 'AbortError'); return id
  })
}

export async function saveDraft(draft: Draft, db = database, expectedJson?: string) {
  await db.transaction('rw', [db.drafts, db.meta, db.syncItems], async () => {
    const owner = await db.meta.get('spaceId')
    if (owner?.value !== draft.spaceId) throw new Error('作品不属于当前本地空间。')
    const current = await db.drafts.get([draft.spaceId, draft.id])
    if (expectedJson !== undefined && current && canonicalJson(current) !== expectedJson) throw new Error('其他设备已更新此作品。当前输入仍在页面中，请先导出或读取更新后的版本再继续编辑。')
    await db.drafts.put(structuredClone(draft))
    await db.meta.put({ key: `position:${draft.spaceId}`, value: draft.id })
    await db.meta.put({ key: `position-time:${draft.spaceId}`, value: draft.updatedAt })
    await markPending(draft.spaceId, 'draft', draft.id, db); await markPending(draft.spaceId, 'position', 'learning-position', db)
  })
}

export async function saveRevision(draft: Draft, db = database): Promise<ArtifactRevision> {
  return db.transaction('rw', [db.revisions, db.meta, db.syncItems], async () => {
    const owner = await db.meta.get('spaceId')
    if (owner?.value !== draft.spaceId) throw new Error('作品不属于当前本地空间。')
    const previous = (await db.revisions.where('spaceId').equals(draft.spaceId).toArray()).filter(row => row.id === draft.id).sort((a, b) => BigInt(a.version) < BigInt(b.version) ? -1 : 1).at(-1)
    const revision = { ...structuredClone(draft), artifactId: previous?.artifactId ?? crypto.randomUUID(), revisionId: crypto.randomUUID(), version: String(BigInt(previous?.version ?? '0') + 1n) }
    await db.revisions.add(revision)
    await markPending(draft.spaceId, 'revision', revision.revisionId, db)
    return revision
  })
}

export async function recordEvidence(evidence: EvidenceRecord, db = database) {
  await db.transaction('rw', [db.evidence, db.revisions, db.meta, db.syncItems], async () => {
    const owner = await db.meta.get('spaceId')
    const revision = await db.revisions.get([evidence.spaceId, evidence.revisionId])
    if (owner?.value !== evidence.spaceId || revision?.spaceId !== evidence.spaceId) throw new Error('核验无法关联到本人作品版本。')
    if (evidence.result.client_revision_id !== revision.revisionId || evidence.result.client_artifact_id !== revision.artifactId) throw new Error('核验返回的作品版本与提交不一致。')
    await db.evidence.add(structuredClone(evidence))
    await markPending(evidence.spaceId, 'evidence', evidence.id, db)
  })
}

export async function loadDraft(objectiveId: string, spaceId: string, db = database) {
  await assertActive(spaceId, db)
  return await db.drafts.get([spaceId, objectiveId]) ?? newDraft(objectiveId, spaceId)
}
export async function recordHelp(event: HelpEvent, db = database) {
  await db.transaction('rw', [db.help, db.meta, db.syncItems], async () => { await assertActive(event.spaceId, db); await db.help.add(event); await markPending(event.spaceId, 'help', event.id, db) })
}
export async function recordTeacherDraft(record: TeacherDraft, db = database) {
  await db.transaction('rw', [db.teacherDrafts, db.meta, db.syncItems], async () => { await assertActive(record.spaceId, db); await db.teacherDrafts.add(record); await markPending(record.spaceId, 'teacher_draft', record.id, db) })
}

export async function saveCourseAttempt(attempt: CourseAttempt, db = database) {
  await db.transaction('rw', [db.courseAttempts, db.meta, db.syncItems], async () => {
    await assertActive(attempt.spaceId, db)
    const previous = await db.courseAttempts.get([attempt.spaceId, attempt.id])
    if (previous?.result || previous?.resultTrust) throw new Error('已核验的作品不可改写，请另建一次尝试。')
    if (previous?.submittedAt && (JSON.stringify(previous.rows) !== JSON.stringify(attempt.rows) || previous.explanation !== attempt.explanation || previous.submittedAt !== attempt.submittedAt)) throw new Error('已提交作品不可改写，请另建一次尝试。')
    if (previous && (previous.artifactId !== attempt.artifactId || previous.createdAt !== attempt.createdAt || previous.objectiveId !== attempt.objectiveId)) throw new Error('作品身份已变化。')
    if (attempt.result) {
      completeLogicRows(attempt.rows)
      if (attempt.result.client_artifact_id !== attempt.artifactId || attempt.result.client_revision_id !== attempt.id || attempt.result.mastery_asserted !== false) throw new Error('核验结果与本地作品不一致。')
    }
    await db.courseAttempts.put(structuredClone(attempt))
    await markPending(attempt.spaceId, 'course_attempt', attempt.id, db)
    await db.meta.put({ key: `position:${attempt.spaceId}`, value: attempt.objectiveId })
    await db.meta.put({ key: `position-time:${attempt.spaceId}`, value: attempt.updatedAt })
    await markPending(attempt.spaceId, 'position', 'learning-position', db)
  })
}

export async function saveStructuredAttempt(attempt: StructuredAttempt, db = database): Promise<StructuredAttempt> {
  return db.transaction('rw', [db.structuredAttempts, db.meta, db.syncItems], async () => {
    await assertActive(attempt.spaceId, db)
    const previous = await db.structuredAttempts.get([attempt.spaceId, attempt.id])
    if (previous?.result) throw new Error('已核验的活动版本不能覆盖；请开始新版本。')
    if (previous && ['artifactId', 'activityVersion', 'objectiveCode', 'courseCode', 'kind', 'createdAt'].some(key => previous[key as keyof StructuredAttempt] !== attempt[key as keyof StructuredAttempt])) throw new Error('活动作品身份不能改写。')
    if (previous?.submittedAt && (previous.submittedAt !== attempt.submittedAt || previous.explanation !== attempt.explanation || canonicalJson(previous.traceRows) !== canonicalJson(attempt.traceRows) || canonicalJson(previous.bracketRows) !== canonicalJson(attempt.bracketRows))) throw new Error('已提交作品不可改写，请另建一次尝试。')
    if (attempt.result) {
      if (attempt.result.client_artifact_id !== attempt.artifactId || attempt.result.client_revision_id !== attempt.id || attempt.result.mastery_asserted !== false) throw new Error('核验结果与本地活动版本不一致。')
    }
    const next: StructuredAttempt = { ...structuredClone(attempt), spaceId: attempt.spaceId, createdAt: previous?.createdAt ?? attempt.createdAt }
    await db.structuredAttempts.put(next)
    await markPending(attempt.spaceId, 'structured_attempt', attempt.id, db)
    return next
  })
}

export async function savePersonalCourse(course: PersonalCourse, expectedJson: string | null, db = database) {
  await db.transaction('rw', [db.personalCourses, db.meta, db.syncItems], async () => {
    await assertActive(course.spaceId, db)
    const current = await db.personalCourses.get([course.spaceId, course.id])
    if ((current ? canonicalJson(current) : null) !== expectedJson) throw new Error('课程已在其他页面更新，请重新打开后再修改。')
    if (!course.title.trim() || course.topics.length > 64 || course.topics.some(topic => !topic.title.trim() || !topic.expectedPerformance.trim())) throw new Error('请填写课程名称；已添加的学习点须有名称和可观察表现。')
    assertSyncablePersonalRecord('personal_course', course.id, course)
    await db.personalCourses.put(structuredClone(course))
    await markPending(course.spaceId, 'personal_course', course.id, db)
  })
}

async function stableScopeVersionId(spaceId: string, courseId: string, version: number) {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${spaceId}:${courseId}:scope:${version}`)))
  const bytes = [...hash.slice(0, 16)]
  bytes[6] = (bytes[6] & 0x0f) | 0x80
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.map(byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export async function confirmPersonalCourseScope(spaceId: string, courseId: string, expectedJson: string, db = database) {
  return db.transaction('rw', [db.personalCourses, db.personalCourseVersions, db.meta, db.syncItems], async () => {
    await assertActive(spaceId, db)
    const course = await db.personalCourses.get([spaceId, courseId])
    if (!course) throw new Error('个人课程不存在，请重新打开后再确认。')
    if (canonicalJson(course) !== expectedJson) throw new Error('课程已在其他页面更新，请重新打开后再确认。')
    if (!course.title.trim() || course.topics.length > 64 || course.topics.some(topic => !topic.title.trim() || !topic.expectedPerformance.trim())) throw new Error('请先修正课程名称或学习点内容。')
    const history = await db.personalCourseVersions.where('[spaceId+courseId]').equals([spaceId, courseId]).toArray()
    const version = Math.max(0, ...history.map(item => item.version)) + 1
    const gaps: PersonalCourseVersion['gaps'] = []
    if (!course.goal.trim()) gaps.push('goal')
    if (!course.topics.length) gaps.push('learning_points')
    const scope: PersonalCourseVersion = {
      id: await Dexie.waitFor(stableScopeVersionId(spaceId, courseId, version)),
      spaceId, courseId, version, title: course.title, goal: course.goal,
      topics: structuredClone(course.topics), scopeStatus: gaps.length ? 'exploration' : 'defined', gaps,
      confirmedAt: new Date().toISOString(),
    }
    assertSyncablePersonalRecord('personal_course_version', scope.id, scope)
    await db.personalCourseVersions.add(scope)
    await markPending(spaceId, 'personal_course_version', scope.id, db)
    return scope
  })
}

export async function recordPersonalAttempt(attempt: PersonalAttempt, db = database) {
  await db.transaction('rw', [db.personalCourses, db.personalCourseVersions, db.personalAttempts, db.meta, db.syncItems], async () => {
    await assertActive(attempt.spaceId, db)
    const course = await db.personalCourses.get([attempt.spaceId, attempt.courseId])
    if (!course?.topics.some(topic => topic.id === attempt.topicId)) throw new Error('学习点已变化，请重新打开课程后保存尝试。')
    const scope = attempt.scopeVersionId ? await db.personalCourseVersions.get([attempt.spaceId, attempt.scopeVersionId]) : undefined
    if (!scope) throw new Error('请先确认当前学习范围，再保存这次尝试。')
    if (scope.courseId !== attempt.courseId || !scope.topics.some(topic => topic.id === attempt.topicId)) throw new Error('学习点不属于这次确认的范围版本，未保存尝试。')
    if (![attempt.learningQuestion, attempt.theoryNote, attempt.action, attempt.observation, attempt.reflection, attempt.nextStep].every(value => value.trim())) throw new Error('请补齐问题、原理、操作、结果、理解和下一步。')
    assertSyncablePersonalRecord('personal_attempt', attempt.id, attempt)
    await db.personalAttempts.add(structuredClone(attempt))
    await markPending(attempt.spaceId, 'personal_attempt', attempt.id, db)
  })
}

export async function recordPersonalAssist(assist: PersonalAssist, db = database) {
  await db.transaction('rw', [db.personalAttempts, db.personalAssists, db.meta, db.syncItems], async () => {
    await assertActive(assist.spaceId, db)
    const attempt = await db.personalAttempts.get([assist.spaceId, assist.attemptId])
    if (!attempt || attempt.courseId !== assist.courseId || attempt.topicId !== assist.topicId || attempt.scopeVersionId !== assist.scopeVersionId) throw new Error('学习帮助不属于这次已保存的尝试，未保存答复。')
    if (![assist.question, assist.reply, assist.nextAction, assist.provider].every(value => value.trim())) throw new Error('学习帮助内容不完整，未保存答复。')
    assertSyncablePersonalRecord('personal_assist', assist.id, assist)
    await db.personalAssists.add(structuredClone(assist))
    await markPending(assist.spaceId, 'personal_assist', assist.id, db)
  })
}
