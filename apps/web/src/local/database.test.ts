import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { LearningDatabase, clearGuestSpace, openLocalSpace, recordEvidence, saveDraft, saveRevision } from './database'
import { completeDraft, sampleEvidence } from '../test/fixtures'

const databases: LearningDatabase[] = []
afterEach(async () => { await Promise.all(databases.splice(0).map(db => db.delete())) })
function createDatabase() { const db = new LearningDatabase(`unit-test-${crypto.randomUUID()}`); databases.push(db); return db }

describe('local durable repository', () => {
  it('reuses the same unbound space and atomically keeps recovery position with work', async () => {
    const db = createDatabase(); const spaceId = await openLocalSpace(db)
    expect(await openLocalSpace(db)).toBe(spaceId)
    const draft = completeDraft(spaceId); await saveDraft(draft, db)
    expect((await db.drafts.get([spaceId, draft.id]))?.explanation).toBe(draft.explanation)
    expect((await db.meta.get('position:'+spaceId))?.value).toBe(draft.id)
  })
  it('preserves immutable versions and rejects a foreign-space write', async () => {
    const db = createDatabase(); const spaceId = await openLocalSpace(db)
    const draft = completeDraft(spaceId); const first = await saveRevision(draft, db)
    draft.explanation = 'new explanation'; await saveDraft(draft, db); const second = await saveRevision(draft, db)
    expect(second.version).toBe('2'); expect((await db.revisions.get([spaceId, first.revisionId]))?.explanation).not.toBe(draft.explanation)
    await expect(saveDraft({ ...draft, spaceId: 'other-space' }, db)).rejects.toThrow('不属于')
    expect((await db.drafts.get([spaceId, draft.id]))?.spaceId).toBe(spaceId)
  })
  it('cannot overwrite a newer live draft when an older submitted snapshot becomes a revision', async () => {
    const db = createDatabase(); const spaceId = await openLocalSpace(db)
    const submitted = completeDraft(spaceId)
    const edited = { ...submitted, explanation: 'edited while awaiting verification' }
    await saveDraft(edited, db)
    const revision = await saveRevision(submitted, db)
    expect((await db.drafts.get([spaceId, submitted.id]))?.explanation).toBe(edited.explanation)
    expect((await db.revisions.get([spaceId, revision.revisionId]))?.explanation).toBe(submitted.explanation)
  })
  it('only accepts evidence for the submitted local revision and refuses duplicate evidence', async () => {
    const db = createDatabase(); const spaceId = await openLocalSpace(db)
    const revision = await saveRevision(completeDraft(spaceId), db)
    const evidence = { ...sampleEvidence(), spaceId, revisionId: revision.revisionId, revisionVersion: revision.version }
    evidence.result.client_revision_id = revision.revisionId
    evidence.result.client_artifact_id = revision.artifactId
    await recordEvidence(evidence, db)
    await expect(recordEvidence(evidence, db)).rejects.toThrow()
    expect(await db.evidence.count()).toBe(1)
    const invalid = { ...sampleEvidence(), spaceId, revisionId: revision.revisionId }
    await expect(recordEvidence(invalid, db)).rejects.toThrow('版本与提交不一致')
    expect(await db.evidence.count()).toBe(1)
  })
  it('clears only the active unbound guest space and rejects stale writes', async () => {
    const db = createDatabase(); const id = await openLocalSpace(db)
    const draft = completeDraft(id); await saveDraft(draft, db)
    const revision = await saveRevision(draft, db)
    const evidence = { ...sampleEvidence(), spaceId: id, revisionId: revision.revisionId, revisionVersion: revision.version }
    evidence.result.client_revision_id = revision.revisionId; evidence.result.client_artifact_id = revision.artifactId
    await recordEvidence(evidence, db)
    const next = await clearGuestSpace(id, db)
    expect(next).not.toBe(id)
    expect((await db.meta.get('spaceId'))?.value).toBe(next)
    expect(await db.spaces.get(id)).toBeUndefined()
    expect(await db.drafts.where('spaceId').equals(id).count()).toBe(0)
    expect(await db.revisions.where('spaceId').equals(id).count()).toBe(0)
    expect(await db.evidence.where('spaceId').equals(id).count()).toBe(0)
    expect(await db.syncItems.where('spaceId').equals(id).count()).toBe(0)
    await expect(saveDraft(draft, db)).rejects.toThrow('不属于当前本地空间')
  })
  it('refuses to clear claimed, pending or inactive spaces', async () => {
    const db = createDatabase(); const id = await openLocalSpace(db)
    await db.spaces.update(id, { pendingOwnerId: crypto.randomUUID() })
    await expect(clearGuestSpace(id, db)).rejects.toThrow('未关联账号')
    expect(await db.spaces.get(id)).toBeDefined()
    await db.spaces.update(id, { pendingOwnerId: null })
    await db.claims.put({ claimId: crypto.randomUUID(), expectedAccountId: crypto.randomUUID(), originLocalSpaceId: id, manifestHash: 'fixed', manifest: [], state: 'pending' })
    await expect(clearGuestSpace(id, db)).rejects.toThrow('待确认')
    expect(await db.spaces.get(id)).toBeDefined()
    await db.claims.clear()
    await expect(clearGuestSpace(crypto.randomUUID(), db)).rejects.toThrow('未关联账号')
  })
})
