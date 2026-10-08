import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { LearningDatabase, activateSpace, clearGuestSpace, confirmPersonalCourseScope, openLocalSpace, recordEvidence, recordPersonalAssist, recordPersonalAttempt, saveDraft, savePersonalCourse, saveRevision } from './database'
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
    const scope = await confirmPersonalCourseScope(spaceId, course.id, canonicalJson(expanded), db)
    await recordPersonalAttempt({ ...attempt, scopeVersionId: scope.id }, db)
    expect(await db.personalAttempts.where('spaceId').equals(spaceId).count()).toBe(1)
    await expect(recordPersonalAttempt({ ...attempt, scopeVersionId: scope.id }, db)).rejects.toThrow()
    await expect(savePersonalCourse({ ...expanded, goal: 'stale update' }, canonicalJson(course), db)).rejects.toThrow('其他页面')
    await expect(recordPersonalAttempt({ ...attempt, id: crypto.randomUUID(), spaceId: crypto.randomUUID() }, db)).rejects.toThrow('不属于')
  })
  it('confirms append-only personal course scope versions and binds attempts to the chosen version', async () => {
    const db = createDatabase(); const spaceId = await openLocalSpace(db); const now = new Date().toISOString()
    const topic = { id: crypto.randomUUID(), title: '路由选择', expectedPerformance: '构造路由表并解释转发结果' }
    const course: PersonalCourse = { id: crypto.randomUUID(), spaceId, title: '计算机网络', goal: '解释并验证路由决策', topics: [topic], createdAt: now, updatedAt: now }
    await savePersonalCourse(course, null, db)
    const first = await confirmPersonalCourseScope(spaceId, course.id, canonicalJson(course), db)
    expect(first.version).toBe(1)
    expect(first.scopeStatus).toBe('defined')

    const updated = { ...course, goal: '解释路由决策并定位故障', updatedAt: new Date(Date.now() + 1000).toISOString() }
    await savePersonalCourse(updated, canonicalJson(course), db)
    const second = await confirmPersonalCourseScope(spaceId, course.id, canonicalJson(updated), db)
    expect(second.version).toBe(2)
    expect((await db.personalCourseVersions.get([spaceId, first.id]))?.goal).toBe(course.goal)
    expect((await db.personalCourseVersions.get([spaceId, second.id]))?.goal).toBe(updated.goal)

    const attempt: PersonalAttempt = { id: crypto.randomUUID(), spaceId, courseId: course.id, topicId: topic.id, scopeVersionId: first.id,
      learningQuestion: '为什么数据包走了另一条路？', theoryNote: '最长前缀匹配', action: '检查路由表', observation: '命中更具体路由', reflection: '默认路由不是唯一候选', nextStep: '改变目标网段再试', createdAt: now }
    await recordPersonalAttempt(attempt, db)
    expect((await db.personalAttempts.get([spaceId, attempt.id]))?.scopeVersionId).toBe(first.id)
    await expect(confirmPersonalCourseScope(spaceId, course.id, canonicalJson(course), db)).rejects.toThrow('其他页面')
  })
  it('does not save a personal attempt without a confirmed scope version', async () => {
    const db = createDatabase(); const spaceId = await openLocalSpace(db); const now = new Date().toISOString()
    const topic = { id: crypto.randomUUID(), title: '事务隔离', expectedPerformance: '复现并解释不可重复读' }
    const course: PersonalCourse = { id: crypto.randomUUID(), spaceId, title: '数据库系统', goal: '解释并发异常', topics: [topic], createdAt: now, updatedAt: now }
    await savePersonalCourse(course, null, db)
    const attempt: PersonalAttempt = { id: crypto.randomUUID(), spaceId, courseId: course.id, topicId: topic.id,
      learningQuestion: '如何复现？', theoryNote: '事务可见性', action: '执行两组事务', observation: '读到旧值', reflection: '隔离级别影响可见性', nextStep: '提高隔离级别复测', createdAt: now }
    await expect(recordPersonalAttempt(attempt, db)).rejects.toThrow('先确认当前学习范围')
    expect(await db.personalAttempts.where('spaceId').equals(spaceId).count()).toBe(0)
  })
  it('binds an immutable personal assistant reply to one saved attempt and active space', async () => {
    const db = createDatabase(); const spaceId = await openLocalSpace(db); const now = new Date().toISOString()
    const topic = { id: crypto.randomUUID(), title: '路由选择', expectedPerformance: '构造路由表并解释结果' }
    const course: PersonalCourse = { id: crypto.randomUUID(), spaceId, title: '计算机网络', goal: '理解路由选择', topics: [topic], createdAt: now, updatedAt: now }
    await savePersonalCourse(course, null, db)
    const scope = await confirmPersonalCourseScope(spaceId, course.id, canonicalJson(course), db)
    const attempt: PersonalAttempt = { id: crypto.randomUUID(), spaceId, courseId: course.id, topicId: topic.id, scopeVersionId: scope.id,
      learningQuestion: '为什么没走默认路由？', theoryNote: '最长前缀匹配', action: '构造两条路由', observation: '更具体的路由生效', reflection: '目标地址决定选择', nextStep: '改变目标网段', createdAt: now }
    await recordPersonalAttempt(attempt, db)
    const assist = { id: crypto.randomUUID(), spaceId, courseId: course.id, scopeVersionId: scope.id, topicId: topic.id, attemptId: attempt.id,
      intent: 'practice' as const, question: '下一步怎么验证？', reply: '试一条不同的目标网段。', nextAction: '记录新的路由表。', modelProfileId: 'local', provider: '本人模型', disclosureVersion: 'personal-learning-assist-v1' as const, createdAt: now }
    await recordPersonalAssist(assist, db)
    expect((await db.personalAssists.get([spaceId, assist.id]))?.attemptId).toBe(attempt.id)
    expect((await db.syncItems.get(`${spaceId}:personal_assist:${assist.id}`))?.status).toBe('pending')
    await expect(recordPersonalAssist({ ...assist, id: crypto.randomUUID(), topicId: crypto.randomUUID() }, db)).rejects.toThrow('不属于')
    await expect(recordPersonalAssist(assist, db)).rejects.toThrow()
    await clearGuestSpace(spaceId, db)
    expect(await db.personalAssists.where('spaceId').equals(spaceId).count()).toBe(0)
  })
  it('keeps a guest personal course in its space on account claim and removes it with guest clear', async () => {
    const db = createDatabase(); const spaceId = await openLocalSpace(db)
    const course: PersonalCourse = { id: crypto.randomUUID(), spaceId, title: '计算机网络', goal: '', topics: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    await savePersonalCourse(course, null, db)
    const scope = await confirmPersonalCourseScope(spaceId, course.id, canonicalJson(course), db)
    const accountId = crypto.randomUUID()
    expect(await activateSpace(accountId, false, db)).toBe(spaceId)
    expect((await db.spaces.get(spaceId))?.pendingOwnerId).toBe(accountId)
    const guest = await activateSpace(null, true, db)
    expect(guest).not.toBe(spaceId)
    expect(await db.personalCourses.where('spaceId').equals(guest).count()).toBe(0)
    expect(await db.personalCourseVersions.where('spaceId').equals(guest).count()).toBe(0)
    expect(await activateSpace(accountId, false, db)).toBe(spaceId)
    expect((await db.personalCourses.get([spaceId, course.id]))?.title).toBe('计算机网络')
    expect((await db.personalCourseVersions.get([spaceId, scope.id]))?.scopeStatus).toBe('exploration')
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
    const confirmed = { ...course, topics: [topic] }
    const scope = await confirmPersonalCourseScope(spaceId, course.id, canonicalJson(confirmed), db)
    const attempt: PersonalAttempt = { id: crypto.randomUUID(), spaceId, courseId: course.id, topicId: topic.id,
      scopeVersionId: scope.id, learningQuestion: '如何重现？', theoryNote: '原'.repeat(3500), action: '操'.repeat(3500), observation: '结'.repeat(3500), reflection: '思'.repeat(3500), nextStep: '试'.repeat(3500), createdAt: now }
    await recordPersonalAttempt(attempt, db)
    await expect(recordPersonalAttempt({ ...attempt, id: crypto.randomUUID(), theoryNote: '原'.repeat(4000), action: '操'.repeat(4000), observation: '结'.repeat(4000), reflection: '思'.repeat(4000), nextStep: '试'.repeat(4000) }, db)).rejects.toThrow('云同步大小限制')
    expect(await db.personalAttempts.where('spaceId').equals(spaceId).count()).toBe(1)
  })
})
