import Dexie, { type Table } from 'dexie'
import { newDraft, type Draft, type ArtifactRevision, type EvidenceRecord, type HelpEvent, type TeacherDraft } from '../domain/learning'
import { canonicalJson } from '../domain/integrity'
import type { PersonalAttempt, PersonalCourse } from '../domain/personal'

export type ObjectType = 'draft' | 'revision' | 'evidence' | 'help' | 'teacher_draft' | 'personal_course' | 'personal_attempt' | 'position'
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
  personalAttempts!: Table<PersonalAttempt, [string, string]>
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
    this.drafts = this.table('workDrafts'); this.revisions = this.table('workRevisions'); this.evidence = this.table('workEvidence'); this.help = this.table('workHelp'); this.teacherDrafts = this.table('workTeacherDrafts'); this.personalCourses = this.table('personalCourses'); this.personalAttempts = this.table('personalAttempts')
  }
}

export const database = new LearningDatabase()
export const syncKey = (spaceId: string, type: ObjectType, id: string) => `${spaceId}:${type}:${id}`
export const MAX_SYNC_OPERATION_BYTES = 59000
function assertSyncablePersonalRecord(type: 'personal_course' | 'personal_attempt', id: string, payload: PersonalCourse | PersonalAttempt) {
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
  return db.transaction('rw', [db.meta, db.spaces, db.drafts, db.revisions, db.evidence, db.help, db.teacherDrafts, db.personalCourses, db.personalAttempts], async () => {
    const existing = await db.meta.get('spaceId')
    if (existing) return existing.value
    const spaceId = crypto.randomUUID()
    await db.spaces.add({ id: spaceId, ownerId: null, pendingOwnerId: null, serverId: null, cursor: null, createdAt: new Date().toISOString() })
    await db.meta.add({ key: 'spaceId', value: spaceId })
    return spaceId
  })
}
export async function clearGuestSpace(spaceId: string, db = database) {
  return db.transaction('rw', [db.meta, db.spaces, db.drafts, db.revisions, db.evidence, db.help, db.teacherDrafts, db.personalCourses, db.personalAttempts, db.syncItems, db.claims, db.batches], async () => {
    const active = await db.meta.get('spaceId')
    const space = await db.spaces.get(spaceId)
    if (active?.value !== spaceId || !space || space.ownerId || space.pendingOwnerId || space.serverId) throw new Error('仅可清理当前未关联账号的访客空间。')
    if (await db.claims.where('originLocalSpaceId').equals(spaceId).count() || await db.batches.where('spaceId').equals(spaceId).count()) throw new Error('此空间存在待确认的账号关联，不能在本机清理。')
    for (const table of [db.drafts, db.revisions, db.evidence, db.help, db.teacherDrafts, db.personalCourses, db.personalAttempts, db.syncItems]) await table.where('spaceId').equals(spaceId).delete()
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
  return db.transaction('rw', [db.meta, db.spaces, db.drafts, db.revisions, db.evidence, db.help, db.teacherDrafts, db.personalCourses, db.personalAttempts], async () => {
    if (!isCurrent()) throw new DOMException('身份变化已过期。', 'AbortError')
    const active = await db.spaces.get((await db.meta.get('spaceId'))!.value)
    const own = accountId ? (await db.spaces.where('ownerId').equals(accountId).toArray())[0] ?? (await db.spaces.where('pendingOwnerId').equals(accountId).toArray())[0] : undefined
    if (accountId && own && active && !active.ownerId && !active.pendingOwnerId) {
      const counts = await Promise.all([db.drafts, db.revisions, db.evidence, db.help, db.teacherDrafts, db.personalCourses, db.personalAttempts].map(table => table.where('spaceId').equals(active.id).count()))
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

export async function recordPersonalAttempt(attempt: PersonalAttempt, db = database) {
  await db.transaction('rw', [db.personalCourses, db.personalAttempts, db.meta, db.syncItems], async () => {
    await assertActive(attempt.spaceId, db)
    const course = await db.personalCourses.get([attempt.spaceId, attempt.courseId])
    if (!course?.topics.some(topic => topic.id === attempt.topicId)) throw new Error('学习点已变化，请重新打开课程后保存尝试。')
    if (![attempt.learningQuestion, attempt.theoryNote, attempt.action, attempt.observation, attempt.reflection, attempt.nextStep].every(value => value.trim())) throw new Error('请补齐问题、原理、操作、结果、理解和下一步。')
    assertSyncablePersonalRecord('personal_attempt', attempt.id, attempt)
    await db.personalAttempts.add(structuredClone(attempt))
    await markPending(attempt.spaceId, 'personal_attempt', attempt.id, db)
  })
}
