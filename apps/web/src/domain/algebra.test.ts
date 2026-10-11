import { expect, test } from 'vitest'
import { algebraSubmission, currentAlgebraAttempt, newAlgebraAttempt, retryAlgebraAttempt, type AlgebraResult } from './algebra'

const prompt = {
  mode: 'group' as const, table: [[0, 1], [1, 2]], second_table: null, mapping: null,
}
const context = { objectiveCode: 'CS05-M07-O01', courseCode: 'CS05', courseVersionId: 'version', activityVersionId: 'activity', activityVersion: 'table@0.1.0' }

test('native draft starts without invented predictions and keeps numeric table as editable cells', () => {
  const attempt = newAlgebraAttempt('space', context, prompt)
  expect(attempt.table).toEqual([['0', '1'], ['1', '2']])
  expect(attempt.predictions).toEqual({ closed: '', associative: '', is_group: '' })
  expect(() => algebraSubmission(attempt)).toThrow('预测')
})

test('explicit unchecked prediction becomes null rather than false', () => {
  const attempt = newAlgebraAttempt('space', context, prompt)
  attempt.predictions = { closed: 'false', associative: 'unchecked', is_group: 'false' }
  const submission = algebraSubmission(attempt)
  expect(submission.predictions).toEqual({ closed: false, associative: null, is_group: false })
  expect(submission.client_revision_id).toBe(attempt.id)
  expect(submission.table[1][1]).toBe(2)
})

test('malformed or partial cells cannot silently become zero', () => {
  for (const value of ['', '1.2', 'true', '1e2', '1000001']) {
    const attempt = newAlgebraAttempt('space', context, prompt)
    attempt.predictions = { closed: 'true', associative: 'true', is_group: 'true' }
    attempt.table[0][0] = value
    expect(() => algebraSubmission(attempt)).toThrow('整数')
  }
})

test('retry preserves artifact lineage and source evidence while allocating new version', () => {
  const attempt = newAlgebraAttempt('space', context, prompt)
  attempt.explanation = '旧解释'
  attempt.submittedAt = new Date().toISOString()
  const retry = retryAlgebraAttempt(attempt)
  expect(retry.artifactId).toBe(attempt.artifactId)
  expect(retry.id).not.toBe(attempt.id)
  expect(retry.submittedAt).toBeUndefined()
  expect(retry.result).toBeNull()
  retry.table[0][0] = '1'
  expect(attempt.table[0][0]).toBe('0')
})

test('graph only selects bound local checks and never upgrades imported or older-version work', () => {
  const attempt = newAlgebraAttempt('space', context, prompt)
  attempt.submittedAt = new Date().toISOString()
  attempt.result = { client_artifact_id: attempt.artifactId, client_revision_id: attempt.id, course_code: 'CS05', course_version_id: context.courseVersionId, activity_version_id: context.activityVersionId, activity_version: context.activityVersion, standard_version: 'finite-algebra-exhaustive-v1', checker_version: 'finite-algebra-exhaustive-v1', provenance: 'server_deterministic_checker', mastery_asserted: false, prediction_correct: true } as AlgebraResult
  expect(currentAlgebraAttempt([attempt], context.objectiveCode, context.courseVersionId, context.activityVersionId)?.id).toBe(attempt.id)
  expect(currentAlgebraAttempt([{ ...attempt, resultTrust: 'client_reported' }], context.objectiveCode, context.courseVersionId, context.activityVersionId)).toBeUndefined()
  expect(currentAlgebraAttempt([attempt], context.objectiveCode, 'different-version', context.activityVersionId)).toBeUndefined()
  expect(currentAlgebraAttempt([{ ...attempt, result: { ...attempt.result, client_revision_id: 'wrong' } }], context.objectiveCode, context.courseVersionId, context.activityVersionId)).toBeUndefined()
})
