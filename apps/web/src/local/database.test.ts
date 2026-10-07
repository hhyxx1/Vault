import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { LearningDatabase, activateSpace, clearGuestSpace, openLocalSpace, recordEvidence, recordPersonalAttempt, saveDraft, savePersonalCourse, saveRevision } from './database'
import { completeDraft, sampleEvidence } from '../test/fixtures'
import { canonicalJson } from '../domain/integrity'
import type { PersonalAttempt, PersonalCourse } from '../domain/personal'

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
  it('starts an arbitrary named course without inventing a goal and appends only linked attempts', async () => {
    const db = createDatabase(); const spaceId = await openLocalSpace(db); const now = new Date().toISOString()
    const course: PersonalCourse = { id: crypto.randomUUID(), spaceId, title: '编译原理', goal: '', topics: [], createdAt: now, updatedAt: now }
    await savePersonalCourse(course, null, db)
    expect((await db.personalCourses.get([spaceId, course.id]))?.topics).toEqual([])
    const topic = { id: crypto.randomUUID(), title: '词法分析', expectedPerformance: '编写扫描器并记录输出' }
    const attempt: PersonalAttempt = { id: crypto.randomUUID(), spaceId, courseId: course.id, topicId: topic.id, learningQuestion: '如何识别标识符？', theoryNote: '有限自动机', action: '写了扫描器', observation: '输入 abc 得到 ID', reflection: '规则覆盖普通字母', nextStep: '测试数字边界', createdAt: now }
    await expect(recordPersonalAttempt(attempt, db)).rejects.toThrow('学习点已变化')
    const expanded = { ...course, goal: '完成扫描器并解释状态转换', topics: [topic], updatedAt: new Date(Date.now() + 1000).toISOString() }
    await savePersonalCourse(expanded, canonicalJson(course), db)
    await recordPersonalAttempt(attempt, db)
    expect(await db.personalAttempts.where('spaceId').equals(spaceId).count()).toBe(1)
    await expect(recordPersonalAttempt(attempt, db)).rejects.toThrow()
    await expect(savePersonalCourse({ ...expanded, goal: 'stale update' }, canonicalJson(course), db)).rejects.toThrow('其他页面')
    await expect(recordPersonalAttempt({ ...attempt, id: crypto.randomUUID(), spaceId: crypto.randomUUID() }, db)).rejects.toThrow('不属于')
  })
  it('keeps a guest personal course in its space on account claim and removes it with guest clear', async () => {
    const db = createDatabase(); const spaceId = await openLocalSpace(db)
    const course: PersonalCourse = { id: crypto.randomUUID(), spaceId, title: '计算机网络', goal: '', topics: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    await savePersonalCourse(course, null, db)
    const accountId = crypto.randomUUID()
    expect(await activateSpace(accountId, false, db)).toBe(spaceId)
    expect((await db.spaces.get(spaceId))?.pendingOwnerId).toBe(accountId)
    const guest = await activateSpace(null, true, db)
    expect(guest).not.toBe(spaceId)
    expect(await db.personalCourses.where('spaceId').equals(guest).count()).toBe(0)
    expect(await activateSpace(accountId, false, db)).toBe(spaceId)
    expect((await db.personalCourses.get([spaceId, course.id]))?.title).toBe('计算机网络')
    await activateSpace(null, true, db)
    const currentGuest = (await db.meta.get('spaceId'))!.value
    const disposable = { ...course, spaceId: currentGuest, id: crypto.randomUUID() }
    await savePersonalCourse(disposable, null, db)
    await clearGuestSpace(currentGuest, db)
    expect(await db.personalCourses.where('spaceId').equals(currentGuest).count()).toBe(0)
    expect((await db.personalCourses.get([spaceId, course.id]))?.title).toBe('计算机网络')
  })
  it('rejects a course or immutable attempt too large for a single UTF-8 sync operation before saving', async () => {
    const db = createDatabase(); const spaceId = await openLocalSpace(db); const now = new Date().toISOString()
    const course: PersonalCourse = { id: crypto.randomUUID(), spaceId, title: '数据库系统', goal: '', topics: [], createdAt: now, updatedAt: now }
    const oversizedTopics = Array.from({ length: 64 }, () => ({ id: crypto.randomUUID(), title: '索'.repeat(120), expectedPerformance: '证'.repeat(500) }))
    await expect(savePersonalCourse({ ...course, topics: oversizedTopics }, null, db)).rejects.toThrow('云同步大小限制')
    expect(await db.personalCourses.where('spaceId').equals(spaceId).count()).toBe(0)

    const topic = { id: crypto.randomUUID(), title: '事务隔离', expectedPerformance: '重现并解释不可重复读' }
    await savePersonalCourse({ ...course, topics: [topic] }, null, db)
    const attempt: PersonalAttempt = { id: crypto.randomUUID(), spaceId, courseId: course.id, topicId: topic.id,
      learningQuestion: '如何重现？', theoryNote: '原'.repeat(3500), action: '操'.repeat(3500), observation: '结'.repeat(3500), reflection: '思'.repeat(3500), nextStep: '试'.repeat(3500), createdAt: now }
    await recordPersonalAttempt(attempt, db)
    await expect(recordPersonalAttempt({ ...attempt, id: crypto.randomUUID(), theoryNote: '原'.repeat(4000), action: '操'.repeat(4000), observation: '结'.repeat(4000), reflection: '思'.repeat(4000), nextStep: '试'.repeat(4000) }, db)).rejects.toThrow('云同步大小限制')
    expect(await db.personalAttempts.where('spaceId').equals(spaceId).count()).toBe(1)
  })
})
