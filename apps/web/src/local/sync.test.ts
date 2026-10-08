import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { activateSpace, confirmPersonalCourseScope, LearningDatabase, loadDraft, openLocalSpace, saveDraft, saveRevision, recordEvidence, recordPersonalAttempt, savePersonalCourse, syncKey } from './database'
import { claimSpace, prepareClaim, pullSpace, syncAccount, chooseRemoteConflict } from './sync'
import { completeDraft, sampleEvidence } from '../test/fixtures'
import { canonicalHash, canonicalJson } from '../domain/integrity'
import { currentTraceEvidence } from '../domain/learning'
import type { Account } from '../api/accounts'
import type { PersonalAttempt, PersonalCourse } from '../domain/personal'
const account: Account = { id: crypto.randomUUID(), email: 'a@example.test', display_name: 'A', account_type: 'student', teacher_verification_state: null }
const otherAccount = { ...account, id: crypto.randomUUID(), email: 'b@example.test', display_name: 'B' }
const databases: LearningDatabase[] = []
afterEach(async () => { vi.unstubAllGlobals(); await Promise.all(databases.splice(0).map(db => db.delete())) })
function createDb() { const db = new LearningDatabase(`sync-test-${crypto.randomUUID()}`); databases.push(db); return db }
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
async function boundDb() {
  const db = createDb(); const id = await openLocalSpace(db); const serverId = crypto.randomUUID()
  const space = { id, ownerId: account.id, pendingOwnerId: null, serverId, cursor: null, createdAt: new Date().toISOString() }
  await db.spaces.put(space); return { db, id, serverId, space }
}
describe('account isolation and durable sync', () => {
  it('migrates existing v1 guest drafts without deleting the original records', async () => {
    const dbName = `migration-${crypto.randomUUID()}`; const old = new Dexie(dbName)
    old.version(1).stores({ meta: 'key', drafts: 'id, spaceId', revisions: 'revisionId, id, spaceId', evidence: 'id, objectiveId, revisionId, spaceId', help: 'id, objectiveId, spaceId', teacherDrafts: 'id, spaceId' })
    const id = crypto.randomUUID(); const draft = completeDraft(id)
    await old.table('meta').bulkPut([{ key: 'spaceId', value: id }, { key: 'lastObjective', value: draft.id }]); await old.table('drafts').put(draft); old.close()
    const db = new LearningDatabase(dbName); databases.push(db)
    expect((await loadDraft(draft.id, id, db)).explanation).toBe(draft.explanation)
    expect(await db.table('drafts').count()).toBe(1)
    expect((await db.meta.get(`position:${id}`))?.value).toBe(draft.id)
  })
  it('reserves a guest space at login before the claim HTTP request and isolates the same objective for A and B', async () => {
    const db = createDb(); const guest = await openLocalSpace(db); const aDraft = completeDraft(guest); await saveDraft(aDraft, db)
    await activateSpace(account.id, false, db)
    expect((await db.spaces.get(guest))?.pendingOwnerId).toBe(account.id)
    const b = await activateSpace(otherAccount.id, false, db)
    expect(b).not.toBe(guest)
    await expect(loadDraft(aDraft.id, guest, db)).rejects.toThrow('不属于')
    expect((await loadDraft(aDraft.id, b, db)).explanation).toBe('')
    await saveDraft({ ...completeDraft(b), explanation: 'B only' }, db)
    expect((await db.drafts.get([guest, aDraft.id]))?.explanation).toBe(aDraft.explanation)
    const bRevision = await saveRevision(completeDraft(b), db); expect(bRevision.version).toBe('1')
    expect(await activateSpace(account.id, false, db)).toBe(guest)
  })
  it('rolls back an obsolete identity transition instead of selecting its account space', async () => {
    const db = createDb(); const id = await openLocalSpace(db); let checks = 0
    await expect(activateSpace(account.id, false, db, () => ++checks < 3)).rejects.toThrow()
    expect((await db.spaces.get(id))?.pendingOwnerId).toBeNull()
    expect((await db.meta.get('spaceId'))?.value).toBe(id)
  })
  it('opens a new guest on logout and keeps account work out of the guest space', async () => {
    const { db, id } = await boundDb(); const draft = completeDraft(id); await saveDraft(draft, db)
    const guest = await activateSpace(null, true, db)
    expect(guest).not.toBe(id); expect((await loadDraft(draft.id, guest, db)).explanation).toBe('')
    expect((await db.drafts.get([id, draft.id]))?.explanation).toBe(draft.explanation)
  })
  it('restores an existing account space when logging in from an empty new guest', async () => {
    const { db, id } = await boundDb(); await saveDraft(completeDraft(id), db)
    const guest = await activateSpace(null, true, db); expect(guest).not.toBe(id)
    expect(await activateSpace(account.id, false, db)).toBe(id)
    expect((await db.spaces.get(guest))?.pendingOwnerId).toBeNull()
  })
  it('refuses a stale editor snapshot after a cloud draft changed instead of silently overwriting unseen fields', async () => {
    const { db, id } = await boundDb(); const shown = completeDraft(id); await saveDraft(shown, db)
    const cloud = { ...shown, explanation: 'new explanation from another device' }; await db.drafts.put(cloud)
    await expect(saveDraft({ ...shown, goal: 'edit to a different field' }, db, canonicalJson(shown))).rejects.toThrow('其他设备')
    expect((await loadDraft(shown.id, id, db)).explanation).toBe(cloud.explanation)
    await saveDraft({ ...cloud, goal: 'edit after reading the new version' }, db, canonicalJson(cloud))
    expect((await loadDraft(shown.id, id, db)).explanation).toBe(cloud.explanation)
  })
  it('recovers a lost committed claim through the same durable journal and never transfers it to B', async () => {
    const db = createDb(); const id = await openLocalSpace(db); await saveDraft(completeDraft(id), db)
    let saved: Record<string, unknown> | null = null; let posts = 0
    vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/auth/csrf')) return json({ csrf_token: 'csrf' })
      if (url.endsWith('/sync/claims') && options?.method === 'POST') { posts++; const input = JSON.parse(String(options.body)); saved = { ...input, server_space_id: crypto.randomUUID(), state: 'committed' }; throw new TypeError('Lost response after commit') }
      return saved ? json(saved) : json({ code: 'CLAIM_NOT_FOUND', message: 'not found' }, 404)
    }))
    const context = { account, isCurrent: () => true, db }
    await expect(claimSpace(id, context)).rejects.toThrow('Lost response')
    const journal = (await db.claims.toArray())[0]; expect(journal.state).toBe('pending'); expect((await db.spaces.get(id))?.pendingOwnerId).toBe(account.id)
    await expect(prepareClaim(id, otherAccount.id, db)).rejects.toThrow('其他账号')
    await claimSpace(id, context); expect(posts).toBe(1)
    expect((await db.claims.get(journal.claimId))?.state).toBe('committed')
    expect((await db.spaces.get(id))?.ownerId).toBe(account.id)
    expect((await db.syncItems.where('spaceId').equals(id).toArray()).every(item => item.status === 'pending')).toBe(true)
  })
  it('ignores a late batch response after identity change and leaves the exact batch for recovery', async () => {
    const { db, id, serverId } = await boundDb(); await saveDraft(completeDraft(id), db); let current = true
    vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/auth/csrf')) return json({ csrf_token: 'csrf' })
      if (url.endsWith('/sync/spaces')) return json({ spaces: [{ space_id: serverId, origin_local_space_id: id, kind: 'personal', bound_at: new Date().toISOString() }] })
      const input = JSON.parse(String(options?.body)); current = false
      return json({ batch_id: input.batch_id, space_id: serverId, results: input.operations.map((op: Record<string, unknown>) => ({ ...op, status: 'applied', current_version: '1' })) })
    }))
    await expect(syncAccount(id, { account, isCurrent: () => current, db })).rejects.toThrow('账号空间')
    expect((await db.batches.toArray())[0].state).toBe('pending')
    expect((await db.syncItems.toArray()).every(item => item.status === 'pending')).toBe(true)
  })
  it('retains offline work when cloud has changed, then explicitly adopts the selected cloud version', async () => {
    const { db, id, space, serverId } = await boundDb(); const original = completeDraft(id); await saveDraft(original, db)
    await db.syncItems.put({ key: syncKey(id, 'draft', original.id), spaceId: id, objectType: 'draft', objectId: original.id, version: '1', status: 'synced', acknowledgedJson: canonicalJson(original) })
    const local = { ...original, explanation: 'offline local edit' }; await saveDraft(local, db)
    const remote = { ...original, explanation: 'cloud edit' }
    vi.stubGlobal('fetch', vi.fn(async () => json({ space_id: serverId, changes: [{ object_type: 'draft', object_id: original.id, version: '2', deleted: false, payload: remote, payload_hash: await canonicalHash(remote), provenance: 'client_reported', requires_review: false }], next_cursor: 'cursor-2', has_more: false })))
    await pullSpace(space, { account, isCurrent: () => true, db })
    expect((await loadDraft(original.id, id, db)).explanation).toBe('offline local edit')
    const conflict = (await db.syncItems.get(syncKey(id, 'draft', original.id)))!; expect(conflict.status).toBe('conflict')
    await chooseRemoteConflict(conflict, db); expect((await loadDraft(original.id, id, db)).explanation).toBe('cloud edit')
  })
  it('preserves same-content real local checker evidence while treating a new-device cloud copy as untrusted', async () => {
    const { db, id, space, serverId } = await boundDb(); const revision = await saveRevision(completeDraft(id), db)
    const record = { ...sampleEvidence(), spaceId: id, revisionId: revision.revisionId, revisionVersion: revision.version }
    record.result.client_revision_id = revision.revisionId; record.result.client_artifact_id = revision.artifactId; await recordEvidence(record, db)
    const change = { object_type: 'evidence', object_id: record.id, version: '1', deleted: false, payload: record, payload_hash: await canonicalHash(record), provenance: 'client_reported', requires_review: true }
    vi.stubGlobal('fetch', vi.fn(async () => json({ space_id: serverId, changes: [change], next_cursor: 'cursor', has_more: false })))
    await pullSpace(space, { account, isCurrent: () => true, db })
    expect((await db.evidence.get([id, record.id]))?.trust).toBeUndefined()
    expect(currentTraceEvidence(await db.evidence.toArray())).toBeDefined()
    const other = createDb(); await openLocalSpace(other); await other.spaces.put(space)
    await pullSpace(space, { account, isCurrent: () => true, db: other })
    expect((await other.evidence.get([id, record.id]))?.trust).toBe('client_reported')
    expect(currentTraceEvidence(await other.evidence.toArray())).toBeUndefined()
  })
  it('uploads course, confirmed scope version, and its bound attempt in dependency order', async () => {
    const { db, id, serverId, space } = await boundDb(); const now = new Date().toISOString(); const topicId = crypto.randomUUID()
    const course: PersonalCourse = { id: crypto.randomUUID(), spaceId: id, title: '数据库系统', goal: '实现并解释事务隔离', topics: [{ id: topicId, title: '并发异常', expectedPerformance: '重现并解释不可重复读' }], createdAt: now, updatedAt: now }
    const attemptId = crypto.randomUUID()
    await savePersonalCourse(course, null, db)
    const scope = await confirmPersonalCourseScope(id, course.id, canonicalJson(course), db)
    const attempt: PersonalAttempt = { id: attemptId, spaceId: id, courseId: course.id, topicId, scopeVersionId: scope.id, learningQuestion: '如何重现不可重复读？', theoryNote: '两个事务读写同一行', action: '按顺序运行 SQL', observation: '第二次读到新值', reflection: '事务隔离级别需要检查', nextStep: '改为更高隔离级别重试', createdAt: now }
    await recordPersonalAttempt(attempt, db)
    const submitted: { object_type: string; object_id: string }[][] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/auth/csrf')) return json({ csrf_token: 'csrf' })
      if (url.endsWith('/sync/spaces')) return json({ spaces: [{ space_id: serverId, origin_local_space_id: id, kind: 'personal', bound_at: now }] })
      if (url.endsWith('/batches')) {
        const input = JSON.parse(String(options?.body)); submitted.push(input.operations)
        return json({ batch_id: input.batch_id, space_id: serverId, results: input.operations.map((op: { op_id: string; object_type: string; object_id: string }) => ({ ...op, status: 'applied', current_version: '1', reason: null, conflict_id: null })) })
      }
      return json({ space_id: serverId, changes: [], next_cursor: 'c1', has_more: false })
    }))
    await syncAccount(id, { account, isCurrent: () => true, db })
    expect(submitted.flat().map(op => op.object_type)).toEqual(['personal_course', 'personal_course_version', 'personal_attempt'])
    expect((await db.syncItems.get(syncKey(id, 'personal_course', course.id)))?.status).toBe('synced')
    expect((await db.syncItems.get(syncKey(id, 'personal_course_version', scope.id)))?.status).toBe('synced')
    expect((await db.syncItems.get(syncKey(id, 'personal_attempt', attempt.id)))?.status).toBe('synced')
    const restored = createDb(); await openLocalSpace(restored); await restored.spaces.put(space)
    const changes = await Promise.all([course, scope, attempt].map(async (payload, index) => ({ object_type: ['personal_course', 'personal_course_version', 'personal_attempt'][index], object_id: payload.id, version: '1', deleted: false, payload, payload_hash: await canonicalHash(payload), provenance: 'client_reported', requires_review: false })))
    vi.stubGlobal('fetch', vi.fn(async () => json({ space_id: serverId, changes, next_cursor: 'c1', has_more: false })))
    await pullSpace(space, { account, isCurrent: () => true, db: restored })
    expect((await restored.personalCourses.get([id, course.id]))?.title).toBe('数据库系统')
    expect((await restored.personalCourseVersions.get([id, scope.id]))?.version).toBe(1)
    expect((await restored.personalAttempts.get([id, attempt.id]))?.observation).toBe('第二次读到新值')
  })
})
