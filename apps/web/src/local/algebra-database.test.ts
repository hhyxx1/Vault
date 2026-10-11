import 'fake-indexeddb/auto'
import { afterEach, expect, test } from 'vitest'
import { newAlgebraAttempt, retryAlgebraAttempt } from '../domain/algebra'
import { LearningDatabase, clearGuestSpace, openLocalSpace, saveAlgebraAttempt } from './database'

const databases: LearningDatabase[] = []
afterEach(async () => { await Promise.all(databases.splice(0).map(db => db.delete())) })
const context = { objectiveCode: 'CS05-M07-O01', courseCode: 'CS05', courseVersionId: crypto.randomUUID(), activityVersionId: crypto.randomUUID(), activityVersion: 'CS05-M07-O01-ALGEBRA@0.1.0' }
const prompt = { mode: 'group' as const, table: [[0, 1], [1, 2]], second_table: null, mapping: null }

test('native draft is durable, submission is frozen, and retry preserves lineage', async () => {
  const db = new LearningDatabase(`algebra-${crypto.randomUUID()}`); databases.push(db)
  const spaceId = await openLocalSpace(db)
  const attempt = newAlgebraAttempt(spaceId, context, prompt)
  await saveAlgebraAttempt(attempt, db)
  expect((await db.algebraAttempts.get([spaceId, attempt.id]))?.table[1][1]).toBe('2')
  expect((await db.syncItems.toArray()).some(item => item.objectType === 'algebra_attempt')).toBe(true)
  attempt.predictions = { closed: 'false', associative: 'unchecked', is_group: 'false' }
  attempt.submittedAt = new Date().toISOString()
  await saveAlgebraAttempt(attempt, db)
  await expect(saveAlgebraAttempt({ ...attempt, explanation: '改写提交' }, db)).rejects.toThrow('不可改写')
  const retry = retryAlgebraAttempt(attempt)
  await saveAlgebraAttempt(retry, db)
  expect(await db.algebraAttempts.count()).toBe(2)
  await clearGuestSpace(spaceId, db)
  expect(await db.algebraAttempts.count()).toBe(0)
})

test('incomplete prediction cannot be submitted and foreign space cannot accept a native draft', async () => {
  const db = new LearningDatabase(`algebra-${crypto.randomUUID()}`); databases.push(db)
  const spaceId = await openLocalSpace(db)
  const attempt = newAlgebraAttempt(spaceId, context, prompt)
  await expect(saveAlgebraAttempt({ ...attempt, submittedAt: new Date().toISOString() }, db)).rejects.toThrow('预测')
  await expect(saveAlgebraAttempt({ ...attempt, spaceId: crypto.randomUUID() }, db)).rejects.toThrow('不属于')
})
