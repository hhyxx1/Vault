import { expect, it } from 'vitest'
import { newLogicAttempt } from './logic'
import { manualReviewContent } from './review-work'

it('binds manual review to student content without importing verdicts or local identity', async () => {
  const work = newLogicAttempt('local-space')
  const original = await manualReviewContent('course_attempt', work)
  const recovered = await manualReviewContent('course_attempt', { ...work, spaceId: 'other-local-space', updatedAt: 'later' })
  expect(recovered.hash).toBe(original.hash)
  const edited = await manualReviewContent('course_attempt', { ...work, explanation: 'changed reasoning' })
  expect(edited.hash).not.toBe(original.hash)
  expect(original.content).not.toHaveProperty('result')
  expect(original.content).not.toHaveProperty('spaceId')
})
