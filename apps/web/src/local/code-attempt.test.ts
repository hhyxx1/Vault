import 'fake-indexeddb/auto'
import { afterEach, expect, it } from 'vitest'
import * as repository from './database'
import { canonicalHash } from '../domain/integrity'
import { prepareClaim } from './sync'

const databases: repository.LearningDatabase[] = []
afterEach(async () => { await Promise.all(databases.splice(0).map(db => db.delete())) })
it('freezes submitted code, binds output to its exact request and isolates account spaces', async () => {
  const db = new repository.LearningDatabase(`code-test-${crypto.randomUUID()}`); databases.push(db)
  const spaceId = await repository.openLocalSpace(db)
  const now = new Date().toISOString()
  const request = { language: 'python313' as const, files: { 'main.py': 'print(2+3)' }, entry: 'main.py', stdin: '' }
  const attempt = { id: crypto.randomUUID(), artifactId: crypto.randomUUID(), spaceId, activityKey: 'my-custom-course:addition', request, requestHash: await canonicalHash(request), result: null, resultTrust: null, createdAt: now, updatedAt: now }
  expect(typeof repository.saveCodeAttempt).toBe('function')
  await repository.saveCodeAttempt(attempt, db)
  await expect(repository.saveCodeAttempt({ ...attempt, request: { ...request, stdin: 'different' } }, db)).rejects.toThrow()
  const result = { status: 'success' as const, phase: 'run' as const, stdout: '5\n', stderr: '', truncated: false, metadata: {}, runtime_profile: 'python313-isolate-dev@0.1.0', request_sha256: attempt.requestHash, mastery_asserted: false as const, client_artifact_id: attempt.artifactId, client_revision_id: attempt.id }
  await expect(repository.saveCodeAttempt({ ...attempt, result: { ...result, client_revision_id: crypto.randomUUID() } }, db)).rejects.toThrow()
  await expect(repository.saveCodeAttempt({ ...attempt, result: { ...result, task_assessment: { course_version_id: 'wrong', activity_version_id: 'wrong', objective_code: 'wrong', task_code: 'base', standard_version: 'cs01-fixed-condition-v1', provenance: 'server_deterministic_checker', mastery_asserted: false, criteria: [{ id: 'fixed_condition', status: 'met', reason: '' }, { id: 'explanation', status: 'needs_review', reason: '' }, { id: 'independent_transfer', status: 'needs_review', reason: '' }] } } }, db)).rejects.toThrow()
  await repository.saveCodeAttempt({ ...attempt, result }, db)
  const claim = await prepareClaim(spaceId, crypto.randomUUID(), db)
  expect(claim.manifest.filter(item => item.objectType === 'code_attempt' && item.objectId === attempt.id)).toHaveLength(1)
  expect((await db.codeAttempts.get([spaceId, attempt.id]))?.result?.stdout).toBe('5\n')
  await expect(repository.saveCodeAttempt({ ...attempt, result: { ...result, stdout: 'forged' } }, db)).rejects.toThrow()
  await repository.activateSpace(null, true, db)
  await expect(repository.saveCodeAttempt({ ...attempt, id: crypto.randomUUID() }, db)).rejects.toThrow('不属于')
  expect(await db.codeAttempts.where('spaceId').equals(spaceId).count()).toBe(1)
})
