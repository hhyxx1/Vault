import Dexie from 'dexie'
import { accountRequest, authenticatedRequest, AccountApiError, type Account } from '../api/accounts'
import { canonicalHash, canonicalJson } from '../domain/integrity'
import type { Draft, ArtifactRevision, EvidenceRecord, HelpEvent, TeacherDraft } from '../domain/learning'
import type { PersonalAssist, PersonalAttempt, PersonalCourse, PersonalCourseVersion } from '../domain/personal'
import { database, syncKey, MAX_SYNC_OPERATION_BYTES, type LearningDatabase, type LocalSpaceRecord, type ObjectType, type ClaimJournal, type BatchJournal, type SyncItem } from './database'

type SyncContext = { account: Account; isCurrent: () => boolean; signal?: AbortSignal; db?: LearningDatabase }
type ClaimResponse = { claim_id: string; expected_account_id: string; origin_local_space_id: string; manifest_hash: string; server_space_id: string; state: 'committed' }
type BatchResponse = { batch_id: string; space_id: string; results: { op_id: string; object_type: ObjectType; object_id: string; status: 'applied' | 'already_applied' | 'conflict' | 'rejected' | 'dependency_pending'; current_version: string; reason: string | null; conflict_id: string | null }[] }
type Change = { object_type: ObjectType; object_id: string; version: string; deleted: boolean; payload: Record<string, unknown> | null; payload_hash: string; provenance: 'client_reported'; requires_review: boolean }
const types: ObjectType[] = ['draft', 'revision', 'help', 'evidence', 'teacher_draft', 'personal_course', 'personal_course_version', 'personal_attempt', 'personal_assist', 'position']
export const syncTables = (db: LearningDatabase) => [db.meta, db.spaces, db.claims, db.batches, db.syncItems, db.drafts, db.revisions, db.evidence, db.help, db.teacherDrafts, db.personalCourses, db.personalCourseVersions, db.personalAttempts, db.personalAssists]
function guard(context: SyncContext) { if (!context.isCurrent() || context.signal?.aborted) throw new DOMException('账号空间已切换，同步等待已取消。', 'AbortError') }
function tableFor(type: Exclude<ObjectType, 'position'>, db: LearningDatabase) {
  return { draft: db.drafts, revision: db.revisions, evidence: db.evidence, help: db.help, teacher_draft: db.teacherDrafts, personal_course: db.personalCourses, personal_course_version: db.personalCourseVersions, personal_attempt: db.personalAttempts, personal_assist: db.personalAssists }[type]
}
async function allPayloads(spaceId: string, db: LearningDatabase): Promise<{ type: ObjectType; id: string; payload: Record<string, unknown> }[]> {
  const records: { type: ObjectType; id: string; payload: Record<string, unknown> }[] = []
  for (const type of types.filter(type => type !== 'position')) {
    for (const value of await tableFor(type as Exclude<ObjectType, 'position'>, db).where('spaceId').equals(spaceId).toArray()) {
      const payload = { ...value } as Record<string, unknown>; delete payload.trust
      records.push({ type, id: String(type === 'revision' ? payload.revisionId : payload.id), payload })
    }
  }
  const position = await db.meta.get(`position:${spaceId}`)
  if (position) records.push({ type: 'position', id: 'learning-position', payload: { id: 'learning-position', spaceId, lastObjective: position.value, updatedAt: (await db.meta.get(`position-time:${spaceId}`))?.value ?? '2026-10-03T00:00:00Z' } })
  return records
}
export async function prepareClaim(spaceId: string, accountId: string, db = database): Promise<ClaimJournal> {
  return db.transaction('rw', syncTables(db), async () => {
    const space = await db.spaces.get(spaceId)
    if (!space || (space.ownerId && space.ownerId !== accountId) || (space.pendingOwnerId && space.pendingOwnerId !== accountId)) throw new Error('这个本地空间已关联其他账号，不能重新认领。')
    const old = (await db.claims.where('originLocalSpaceId').equals(spaceId).toArray())[0]
    if (old) { if (old.expectedAccountId !== accountId) throw new Error('已有认领请求属于其他账号。'); return old }
    const records = await allPayloads(spaceId, db)
    const manifest = records.map(record => ({ objectType: record.type, objectId: record.id }))
    const manifestHash = await Dexie.waitFor(canonicalHash(records.map(record => ({ object_type: record.type, object_id: record.id, payload: record.payload }))))
    const claim: ClaimJournal = { claimId: crypto.randomUUID(), expectedAccountId: accountId, originLocalSpaceId: spaceId, manifestHash, manifest, state: 'pending' }
    // Ownership reservation and the exact retry request are durable before HTTP.
    await db.spaces.put({ ...space, pendingOwnerId: accountId }); await db.claims.add(claim)
    return claim
  })
}
export async function claimSpace(spaceId: string, context: SyncContext) {
  const db = context.db ?? database; guard(context)
  const existing = await db.spaces.get(spaceId)
  if (existing?.ownerId === context.account.id && existing.serverId) return existing.serverId
  const claim = await prepareClaim(spaceId, context.account.id, db); guard(context)
  if (claim.state === 'committed') return claim.serverSpaceId!
  let response: ClaimResponse
  try { response = await accountRequest<ClaimResponse>(`sync/claims/${claim.claimId}`, { signal: context.signal }) }
  catch (error) {
    if (!(error instanceof AccountApiError) || error.status !== 404) throw error
    response = await authenticatedRequest<ClaimResponse>('sync/claims', { claim_id: claim.claimId, expected_account_id: claim.expectedAccountId, origin_local_space_id: claim.originLocalSpaceId, manifest_hash: claim.manifestHash }, context.signal, claim.claimId)
  }
  guard(context)
  if (response.claim_id !== claim.claimId || response.expected_account_id !== claim.expectedAccountId || response.origin_local_space_id !== spaceId || response.manifest_hash !== claim.manifestHash || response.state !== 'committed') throw new Error('认领返回与本地固定请求不一致，已停止关联。')
  await db.transaction('rw', syncTables(db), async () => {
    guard(context)
    const space = await db.spaces.get(spaceId)
    if (!space || space.pendingOwnerId !== context.account.id) throw new Error('认领归属已发生变化。')
    await db.spaces.put({ ...space, ownerId: context.account.id, pendingOwnerId: null, serverId: response.server_space_id })
    await db.claims.put({ ...claim, state: 'committed', serverSpaceId: response.server_space_id })
    for (const record of await allPayloads(spaceId, db)) {
      const key = syncKey(spaceId, record.type, record.id)
      if (!(await db.syncItems.get(key))) await db.syncItems.put({ key, spaceId, objectType: record.type, objectId: record.id, version: '0', acknowledgedJson: '', status: 'pending' })
    }
  })
  return response.server_space_id
}
async function uploadSpace(space: LocalSpaceRecord, context: SyncContext) {
  const db = context.db ?? database; guard(context)
  let batch = (await db.batches.where('spaceId').equals(space.id).toArray()).find(batch => batch.state === 'pending' && batch.accountId === context.account.id)
  if (!batch) {
    const snapshot = await db.transaction('r', syncTables(db), async () => {
      const payloads = await allPayloads(space.id, db); const items = await db.syncItems.where('spaceId').equals(space.id).toArray()
      return payloads.filter(record => { const item = items.find(item => item.objectType === record.type && item.objectId === record.id); return item?.status !== 'conflict' && item?.status !== 'rejected' && canonicalJson(record.payload) !== item?.acknowledgedJson }).slice(0, 40).map(record => ({ record, item: items.find(item => item.objectType === record.type && item.objectId === record.id) }))
    })
    if (!snapshot.length) return false
    const candidates = await Promise.all(snapshot.map(async ({ record, item }) => ({ op_id: crypto.randomUUID(), object_type: record.type, object_id: record.id, base_version: item?.version ?? '0', payload_hash: await canonicalHash(record.payload), payload: record.payload })))
    const operations: BatchJournal['operations'] = []; let bytes = 512
    for (const operation of candidates) {
      const size = new TextEncoder().encode(JSON.stringify(operation)).byteLength + 1
      if (size > MAX_SYNC_OPERATION_BYTES) {
        await db.syncItems.put({ key: syncKey(space.id, operation.object_type, operation.object_id), spaceId: space.id, objectType: operation.object_type, objectId: operation.object_id, version: operation.base_version, acknowledgedJson: '', status: 'rejected', reason: '此条记录超过单次同步大小限制，已保留本机，请缩小作品或导出。' }); continue
      }
      if (bytes + size > 60000) break
      operations.push(operation); bytes += size
    }
    if (!operations.length) return false
    guard(context)
    batch = { id: crypto.randomUUID(), accountId: context.account.id, spaceId: space.id, serverId: space.serverId!, operations, state: 'pending' }
    await db.batches.add(batch)
  }
  guard(context)
  const response = await authenticatedRequest<BatchResponse>(`sync/spaces/${space.serverId}/batches`, { expected_account_id: batch.accountId, batch_id: batch.id, operations: batch.operations }, context.signal, batch.id)
  guard(context)
  if (response.batch_id !== batch.id || response.space_id !== space.serverId || response.results.length !== batch.operations.length) throw new Error('逐项同步返回与请求不一致，保留固定批次等待重试。')
  await db.transaction('rw', syncTables(db), async () => {
    guard(context)
    if ((await db.spaces.get(space.id))?.ownerId !== context.account.id) throw new Error('账号空间已切换。')
    const current = await allPayloads(space.id, db)
    for (const result of response.results) {
      const operation = batch!.operations.find(operation => operation.op_id === result.op_id)
      if (!operation || operation.object_type !== result.object_type || operation.object_id !== result.object_id) throw new Error('同步条目不一致。')
      const key = syncKey(space.id, result.object_type, result.object_id); const old = await db.syncItems.get(key)
      const applied = result.status === 'applied' || result.status === 'already_applied'
      const savedJson = canonicalJson(operation.payload)
      const liveJson = canonicalJson(current.find(record => record.type === operation.object_type && record.id === operation.object_id)?.payload)
      await db.syncItems.put({ key, spaceId: space.id, objectType: result.object_type, objectId: result.object_id, version: applied ? result.current_version : old?.version ?? operation.base_version, acknowledgedJson: applied ? savedJson : old?.acknowledgedJson ?? '', status: applied ? (liveJson === savedJson ? 'synced' : 'pending') : result.status as 'conflict' | 'rejected' | 'dependency_pending', reason: result.reason ?? undefined, remoteVersion: !applied ? result.current_version : undefined })
    }
    await db.batches.put({ ...batch!, state: 'complete' })
  })
  return true
}
async function putChange(spaceId: string, change: Change, db: LearningDatabase) {
  if (change.object_type === 'position') {
    if (change.deleted) { await db.meta.delete(`position:${spaceId}`); return }
    await db.meta.put({ key: `position:${spaceId}`, value: String(change.payload?.lastObjective ?? '') }); await db.meta.put({ key: `position-time:${spaceId}`, value: String(change.payload?.updatedAt) }); return
  }
  const table = tableFor(change.object_type, db)
  if (change.deleted) { await table.delete([spaceId, change.object_id]); return }
  const payload = { ...change.payload, spaceId }
  if (change.object_type === 'evidence') (payload as unknown as EvidenceRecord).trust = 'client_reported'
  // Schemas are validated by the API, then written to the matching compound store.
  await table.put(payload as Draft & ArtifactRevision & EvidenceRecord & HelpEvent & TeacherDraft & PersonalCourse & PersonalCourseVersion & PersonalAttempt & PersonalAssist)
}
export async function pullSpace(space: LocalSpaceRecord, context: SyncContext) {
  const db = context.db ?? database; let cursor = space.cursor; let more = true
  while (more) {
    guard(context)
    const response = await accountRequest<{ space_id: string; changes: Change[]; next_cursor: string; has_more: boolean }>(`sync/spaces/${space.serverId}/changes${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, { signal: context.signal })
    guard(context)
    if (response.space_id !== space.serverId) throw new Error('恢复空间与当前账号不一致。')
    for (const change of response.changes) if (change.payload && await canonicalHash(change.payload) !== change.payload_hash) throw new Error('云端条目内容校验失败，未恢复数据。')
    await db.transaction('rw', syncTables(db), async () => {
      guard(context)
      if ((await db.spaces.get(space.id))?.ownerId !== context.account.id) throw new Error('恢复记录不属于当前账号。')
      for (const change of response.changes) {
        const key = syncKey(space.id, change.object_type, change.object_id); const item = await db.syncItems.get(key)
        const local = (await allPayloads(space.id, db)).find(record => record.type === change.object_type && record.id === change.object_id)
        const remoteJson = canonicalJson(change.payload); const localJson = local ? canonicalJson(local.payload) : ''
        if (local && localJson !== item?.acknowledgedJson && localJson !== remoteJson) {
          await db.syncItems.put({ key, spaceId: space.id, objectType: change.object_type, objectId: change.object_id, version: item?.version ?? '0', acknowledgedJson: item?.acknowledgedJson ?? '', status: 'conflict', reason: '云端与本机都有修改，已保留本机作品，等待选择。', remoteVersion: change.version, remotePayload: change.payload, remoteDeleted: change.deleted }); continue
        }
        // Keep a real checker result already on this device. Downloaded evidence
        // on another device remains a client report, regardless of result fields.
        if (!local || localJson !== remoteJson || change.deleted) await putChange(space.id, change, db)
        await db.syncItems.put({ key, spaceId: space.id, objectType: change.object_type, objectId: change.object_id, version: change.version, acknowledgedJson: remoteJson, status: 'synced' })
      }
      await db.spaces.put({ ...space, cursor: response.next_cursor })
    })
    cursor = response.next_cursor; more = response.has_more
  }
}
export async function syncAccount(activeSpaceId: string, context: SyncContext) {
  const db = context.db ?? database; guard(context)
  await claimSpace(activeSpaceId, context)
  // A response may have been lost before switching to another account. Every
  // reserved space keeps its original account and exact claim on return.
  for (const pending of await db.spaces.where('pendingOwnerId').equals(context.account.id).toArray()) {
    guard(context); if (pending.id !== activeSpaceId) await claimSpace(pending.id, context)
  }
  const response = await accountRequest<{ spaces: { space_id: string; origin_local_space_id: string; kind: 'personal'; bound_at: string }[] }>('sync/spaces', { signal: context.signal }); guard(context)
  for (const remote of response.spaces) {
    let space = (await db.spaces.where('serverId').equals(remote.space_id).toArray())[0]
    if (!space) {
      const collision = await db.spaces.get(remote.origin_local_space_id)
      if (collision && collision.ownerId !== context.account.id) throw new Error('云空间标识与其他本机空间冲突，请导出后联系支持。')
      space = { id: remote.origin_local_space_id, ownerId: context.account.id, pendingOwnerId: null, serverId: remote.space_id, cursor: null, createdAt: remote.bound_at }
      await db.spaces.put(space)
    }
    if (space.ownerId !== context.account.id) throw new Error('云空间归属不一致。')
    // Bound work is queued before download, so concurrent remote edits become
    // explicit conflicts instead of silently replacing an offline local draft.
    while (await uploadSpace(space, context)) { guard(context); const rejected = (await db.syncItems.where('spaceId').equals(space.id).toArray()).some(item => item.status === 'dependency_pending'); if (rejected) break }
    await pullSpace(space, context)
  }
}
export async function chooseLocalConflict(item: SyncItem, db = database) {
  if (item.status !== 'conflict' || !item.remoteVersion) return
  await db.syncItems.put({ ...item, version: item.remoteVersion, status: 'pending', reason: undefined })
}
export async function chooseRemoteConflict(item: SyncItem, db = database) {
  if (item.status !== 'conflict' || !item.remoteVersion || item.remotePayload === undefined) throw new Error('云端版本尚未下载，请先重试同步。')
  await db.transaction('rw', syncTables(db), async () => {
    if ((await db.meta.get('spaceId'))?.value !== item.spaceId) throw new Error('空间已切换。')
    await putChange(item.spaceId, { object_type: item.objectType, object_id: item.objectId, version: item.remoteVersion!, deleted: item.remoteDeleted ?? false, payload: item.remotePayload!, payload_hash: '', provenance: 'client_reported', requires_review: item.objectType === 'evidence' }, db)
    await db.syncItems.put({ ...item, version: item.remoteVersion!, acknowledgedJson: canonicalJson(item.remotePayload), status: 'synced', reason: undefined, remotePayload: undefined, remoteVersion: undefined })
  })
}
