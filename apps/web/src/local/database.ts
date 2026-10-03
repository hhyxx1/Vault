import Dexie, { type EntityTable } from 'dexie'
import { newDraft, type Draft, type ArtifactRevision, type EvidenceRecord, type HelpEvent, type TeacherDraft } from '../domain/learning'

export class LearningDatabase extends Dexie {
  meta!: EntityTable<{ key: string; value: string }, 'key'>
  drafts!: EntityTable<Draft, 'id'>
  revisions!: EntityTable<ArtifactRevision, 'revisionId'>
  evidence!: EntityTable<EvidenceRecord, 'id'>
  help!: EntityTable<HelpEvent, 'id'>
  teacherDrafts!: EntityTable<TeacherDraft, 'id'>
  constructor(name = 'qionglong-unbound-local-v1') {
    super(name)
    this.version(1).stores({ meta: 'key', drafts: 'id, spaceId', revisions: 'revisionId, id, spaceId', evidence: 'id, objectiveId, revisionId, spaceId', help: 'id, objectiveId, spaceId', teacherDrafts: 'id, spaceId' })
  }
}

export const database = new LearningDatabase()

export async function openLocalSpace(db = database) {
  return db.transaction('rw', db.meta, async () => {
    const existing = await db.meta.get('spaceId')
    if (existing) return existing.value
    const spaceId = crypto.randomUUID()
    await db.meta.add({ key: 'spaceId', value: spaceId })
    return spaceId
  })
}

export async function saveDraft(draft: Draft, db = database) {
  await db.transaction('rw', db.drafts, db.meta, async () => {
    const owner = await db.meta.get('spaceId')
    if (owner?.value !== draft.spaceId) throw new Error('作品不属于当前本地空间。')
    await db.drafts.put(structuredClone(draft))
    await db.meta.put({ key: 'lastObjective', value: draft.id })
  })
}

export async function saveRevision(draft: Draft, db = database): Promise<ArtifactRevision> {
  return db.transaction('rw', db.revisions, db.meta, async () => {
    const owner = await db.meta.get('spaceId')
    if (owner?.value !== draft.spaceId) throw new Error('作品不属于当前本地空间。')
    const previous = (await db.revisions.where('id').equals(draft.id).toArray()).sort((a, b) => BigInt(a.version) < BigInt(b.version) ? -1 : 1).at(-1)
    const revision = { ...structuredClone(draft), artifactId: previous?.artifactId ?? crypto.randomUUID(), revisionId: crypto.randomUUID(), version: String(BigInt(previous?.version ?? '0') + 1n) }
    await db.revisions.add(revision)
    return revision
  })
}

export async function recordEvidence(evidence: EvidenceRecord, db = database) {
  await db.transaction('rw', db.evidence, db.revisions, db.meta, async () => {
    const owner = await db.meta.get('spaceId')
    const revision = await db.revisions.get(evidence.revisionId)
    if (owner?.value !== evidence.spaceId || revision?.spaceId !== evidence.spaceId) throw new Error('核验无法关联到本人作品版本。')
    if (evidence.result.client_revision_id !== revision.revisionId || evidence.result.client_artifact_id !== revision.artifactId) throw new Error('核验返回的作品版本与提交不一致。')
    await db.evidence.add(structuredClone(evidence))
  })
}

export async function loadDraft(objectiveId: string, spaceId: string, db = database) {
  return await db.drafts.get(objectiveId) ?? newDraft(objectiveId, spaceId)
}
