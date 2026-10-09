import { describe, expect, it } from 'vitest'
import { currentTraceEvidence, evidenceMatchesDraft, evidenceState, objectiveSummary, parseTrace } from './learning'
import { canonicalHash } from './integrity'
import { completeDraft, correctTrace, explanation, normativeHash, sampleEvidence, sampleResult } from '../test/fixtures'

describe('learning evidence projection', () => {
  it('keeps an unassessed target unknown, and does not assert mastery from this checker', () => {
    expect(evidenceState()).toBe('unknown')
    const result = sampleResult()
    expect(evidenceState(result)).toBe('partial')
    result.criteria.forEach(criterion => { criterion.status = 'met' })
    expect(evidenceState(result)).toBe('partial')
    expect(objectiveSummary([])).toEqual({ total: 32, verified: 0, partial: 0, consolidate: 0, unknown: 32 })
  })
  it('uses newest submitted revision rather than a delayed old response', () => {
    const old = sampleEvidence('1'); old.createdAt = '2026-10-03T12:00:00Z'
    const newer = sampleEvidence('2'); newer.result.criteria[0].status = 'not_met'
    expect(currentTraceEvidence([newer, old])?.revisionVersion).toBe('2')
    expect(objectiveSummary([newer, old]).consolidate).toBe(1)
    expect(objectiveSummary([newer, old]).verified).toBe(0)
  })
  it('ignores evidence from obsolete course or standard versions', () => {
    const old = sampleEvidence('10'); old.result.standard_version = 'obsolete-standard'
    expect(currentTraceEvidence([old])).toBeUndefined()
  })
  it('marks current work stale by actual content, including edits while checking', () => {
    const record = sampleEvidence()
    const draft = completeDraft('test-space')
    expect(evidenceMatchesDraft(record, draft)).toBe(true)
    draft.trace[0].stack = '[ 8 ]'
    expect(evidenceMatchesDraft(record, draft)).toBe(true)
    draft.explanation += '核验期间新增解释'
    expect(evidenceMatchesDraft(record, draft)).toBe(false)
  })
  it('validates student predictions without silently replacing them with expected answers', () => {
    const draft = completeDraft('test-space')
    expect(parseTrace(draft.trace)).toEqual(correctTrace)
    draft.trace[0].stack = '[99]'
    expect(parseTrace(draft.trace)[0].after_stack).toEqual([99])
    draft.trace[0].stack = ''
    expect(() => parseTrace(draft.trace)).toThrow('空栈填 []')
    draft.trace[0].stack = '[1.5]'
    expect(() => parseTrace(draft.trace)).toThrow('整数')
  })
  it('matches the actual Python checker Unicode canonical hash vector', async () => {
    expect(await canonicalHash({ kind: 'stack_trace_with_explanation', trace: correctTrace, explanation })).toBe(normativeHash)
  })
})
