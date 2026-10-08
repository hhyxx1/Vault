import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { persistIdentitySpace } from './AuthProvider'
import { confirmPersonalCourseScope, LearningDatabase, openLocalSpace, savePersonalCourse } from './database'
import type { Account } from '../api/accounts'
import { canonicalJson } from '../domain/integrity'
import type { PersonalCourse } from '../domain/personal'

const databases: LearningDatabase[] = []
afterEach(async () => { await Promise.all(databases.splice(0).map(db => db.delete())) })

describe('identity space transition', () => {
  it('claims an existing guest personal course on login and isolates it after logout', async () => {
    const db = new LearningDatabase(`identity-test-${crypto.randomUUID()}`); databases.push(db)
    const guest = await openLocalSpace(db)
    const now = new Date().toISOString()
    const course: PersonalCourse = { id: crypto.randomUUID(), spaceId: guest, title: '编译原理', goal: '', topics: [], createdAt: now, updatedAt: now }
    await savePersonalCourse(course, null, db)
    const scope = await confirmPersonalCourseScope(guest, course.id, canonicalJson(course), db)
    const account: Account = { id: crypto.randomUUID(), email: 'student@example.test', display_name: 'Student', account_type: 'student', teacher_verification_state: null }

    await persistIdentitySpace(account, false, db)
    expect((await db.meta.get('spaceId'))?.value).toBe(guest)
    expect((await db.spaces.get(guest))?.pendingOwnerId).toBe(account.id)
    expect((await db.personalCourses.get([guest, course.id]))?.title).toBe(course.title)
    expect((await db.personalCourseVersions.get([guest, scope.id]))?.scopeStatus).toBe('exploration')
    expect(JSON.parse((await db.meta.get('cachedAccount'))!.value).id).toBe(account.id)

    await persistIdentitySpace(null, true, db)
    const freshGuest = (await db.meta.get('spaceId'))?.value
    expect(freshGuest).not.toBe(guest)
    expect((await db.personalCourses.get([guest, course.id]))?.title).toBe(course.title)
    expect(await db.personalCourses.where('spaceId').equals(freshGuest!).count()).toBe(0)
    expect((await db.meta.get('cachedAccount'))?.value).toBe('null')
  })
})
