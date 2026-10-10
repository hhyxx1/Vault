import 'fake-indexeddb/auto'
import { afterEach, expect, it } from 'vitest'
import * as repository from './database'
import { prepareClaim } from './sync'

const databases: repository.LearningDatabase[] = []
afterEach(async () => { await Promise.all(databases.splice(0).map(db => db.delete())) })

it('persists editable code and learning notes before execution and claims each draft once', async () => {
  const db = new repository.LearningDatabase(`draft-${crypto.randomUUID()}`); databases.push(db)
  const spaceId = await repository.openLocalSpace(db)
  const request = { language: 'c17' as const, files: { 'main.c': 'int main(void){return 0;}' }, entry: 'main.c', stdin: '' }
  expect(typeof repository.saveCodeDraft).toBe('function')
  const draft = await repository.saveCodeDraft({ spaceId, activityKey: 'custom-topic:run', request, prediction: '编译成功', reflection: '', learningContext: null }, db)
  const updated = await repository.saveCodeDraft({ ...draft, prediction: '先编译再执行', reflection: '修改结束状态' }, db)
  expect(updated.id).toBe(draft.id)
  expect(await db.codeDrafts.count()).toBe(1)
  expect((await db.codeDrafts.get([spaceId, draft.id]))?.reflection).toBe('修改结束状态')
  expect(await db.codeAttempts.count()).toBe(0)
  const claim = await prepareClaim(spaceId, crypto.randomUUID(), db)
  expect(claim.manifest.filter(item => item.objectType === 'code_draft')).toEqual([{ objectType: 'code_draft', objectId: draft.id }])
  await repository.activateSpace(null, true, db)
  await expect(repository.saveCodeDraft({ ...updated, reflection: 'wrong account' }, db)).rejects.toThrow('不属于')
})

it('rejects unsafe filenames and oversized notes before saving a draft', async () => {
  const db = new repository.LearningDatabase(`draft-${crypto.randomUUID()}`); databases.push(db)
  const spaceId = await repository.openLocalSpace(db)
  const value = { spaceId, activityKey: 'practice', request: { language: 'python313' as const, entry: 'main.py', files: { 'main.py': 'print(1)' }, stdin: '' }, prediction: '', reflection: '', learningContext: null }
  await expect(repository.saveCodeDraft({ ...value, request: { ...value.request, files: { '../main.py': '' }, entry: '../main.py' } }, db)).rejects.toThrow()
  await expect(repository.saveCodeDraft({ ...value, prediction: 'a'.repeat(4001) }, db)).rejects.toThrow()
  await expect(repository.saveCodeDraft({ ...value, reflections: { invalid: 'note' } }, db)).rejects.toThrow()
  await expect(repository.saveCodeDraft({ ...value, reflections: { [crypto.randomUUID()]: 'a'.repeat(4001) } }, db)).rejects.toThrow()
  expect(await db.codeDrafts.count()).toBe(0)
})
