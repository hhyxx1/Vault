import { describe, expect, it } from 'vitest'
import {
  STRUCTURED_ACTIVITIES,
  emptyAttempt,
  emptyBracketRows,
  emptyTraceRows,
  nextStructuredActivity,
  parseBracketJudgements,
  parseTraceSteps,
  structuredActivityByVersion,
  structuredActivityForObjective,
  structuredAttemptState,
  type BracketRowInput,
  type StructuredResult,
  type TraceActivityPrompt,
  type TraceRowInput,
} from './structured'

const traceActivity = (version: string): TraceActivityPrompt => {
  const activity = structuredActivityByVersion(version)
  if (!activity || activity.kind !== 'structured_trace') throw new Error(`missing trace activity ${version}`)
  return activity
}

describe('structured activity discovery', () => {
  it('exposes the five new data-driven activities but not the legacy demo', () => {
    expect(STRUCTURED_ACTIVITIES.map(activity => activity.version)).toEqual([
      'CS03-STACK-U01-TRACE@0.1.0',
      'CS03-QUEUE-U02-TRACE@0.1.0',
      'CS03-QUEUE-U03-TRACE@0.1.0',
      'CS03-STACK-U04-JUDGE@0.1.0',
      'CS03-STACK-U05-TRACE@0.1.0',
    ])
    expect(STRUCTURED_ACTIVITIES.some(activity => activity.version === 'CS03-STACK-01-TRACE@0.1.0')).toBe(false)
  })

  it('binds queue objectives through the objective route and keeps stack variants on practice only', () => {
    expect(structuredActivityForObjective('CS03-QUEUE-02')?.version).toBe('CS03-QUEUE-U02-TRACE@0.1.0')
    expect(structuredActivityForObjective('CS03-QUEUE-01')?.version).toBe('CS03-QUEUE-U03-TRACE@0.1.0')
    expect(structuredActivityForObjective('CS03-STACK-01')).toBeUndefined()
    expect(structuredActivityForObjective('CS03-STACK-02')).toBeUndefined()
  })

  it('orders activities for the next-activity navigation', () => {
    expect(nextStructuredActivity('CS03-STACK-U01-TRACE@0.1.0')?.version).toBe('CS03-QUEUE-U02-TRACE@0.1.0')
    expect(nextStructuredActivity('CS03-STACK-U05-TRACE@0.1.0')).toBeUndefined()
  })

  it('declares prompt metadata without leaking an answer key', () => {
    const u02 = traceActivity('CS03-QUEUE-U02-TRACE@0.1.0')
    expect(u02.machine).toBe('ring_queue')
    expect(u02.capacity).toBe(3)
    expect(u02.stateFields.map(field => field.name)).toEqual(['buffer', 'head', 'tail', 'size'])
    expect(u02.operations).toHaveLength(11)
    const u04 = structuredActivityByVersion('CS03-STACK-U04-JUDGE@0.1.0')!
    expect(u04.kind).toBe('bracket_judgement')
    expect(JSON.stringify(u04)).not.toContain('mismatch_index')
  })
})

describe('trace step parsing', () => {
  it('parses the bounded stack U01 correct trajectory', () => {
    const u01 = traceActivity('CS03-STACK-U01-TRACE@0.1.0')
    const rows = emptyTraceRows(u01)
    const fill = (index: number, items: string, value: string, status: TraceRowInput['status']): void => {
      rows[index] = { state: { items }, value, status }
    }
    // pop(underflow), push4, push7, pop->7, push9, push2, push5(full rejected)
    fill(0, '[]', '', 'underflow')
    fill(1, '[4]', '', 'ok')
    fill(2, '[4, 7]', '', 'ok')
    fill(3, '[4]', '7', 'ok')
    fill(4, '[4, 9]', '', 'ok')
    fill(5, '[4, 9, 2]', '', 'ok')
    fill(6, '[4, 9, 2]', '', 'full')
    const steps = parseTraceSteps(u01, rows)
    expect(steps).toHaveLength(7)
    expect(steps[0]).toEqual({ state: { items: [] }, value: null, status: 'underflow' })
    expect(steps[3]).toEqual({ state: { items: [4] }, value: 7, status: 'ok' })
    expect(steps[6]).toEqual({ state: { items: [4, 9, 2] }, value: null, status: 'full' })
  })

  it('parses nullable ring-queue buffers and integer pointer fields', () => {
    const u02 = traceActivity('CS03-QUEUE-U02-TRACE@0.1.0')
    const rows = emptyTraceRows(u02)
    const placeholder: TraceRowInput = { state: { buffer: '[null, null, null]', head: '0', tail: '0', size: '0' }, value: '', status: 'ok' }
    rows.forEach((_, index) => { rows[index] = { ...placeholder } })
    rows[0] = { state: { buffer: '[null, null, null]', head: '0', tail: '0', size: '0' }, value: '', status: 'underflow' }
    const steps = parseTraceSteps(u02, rows)
    expect(steps[0].state).toEqual({ buffer: [null, null, null], head: 0, tail: 0, size: 0 })
  })

  it('rejects missing status, malformed lists and non-integer outputs', () => {
    const u01 = traceActivity('CS03-STACK-U01-TRACE@0.1.0')
    const missingStatus = emptyTraceRows(u01)
    expect(() => parseTraceSteps(u01, missingStatus)).toThrow(/状态/)
    const badList = emptyTraceRows(u01)
    badList[0] = { state: { items: '[a]' }, value: '', status: 'ok' }
    expect(() => parseTraceSteps(u01, badList)).toThrow(/整数列表/)
    const badOutput = emptyTraceRows(u01)
    badOutput[0] = { state: { items: '[]' }, value: 'x', status: 'ok' }
    expect(() => parseTraceSteps(u01, badOutput)).toThrow(/输出/)
  })
})

describe('bracket judgement parsing', () => {
  it('parses the six fixed cases with verdicts and first-offender indexes', () => {
    const u04 = structuredActivityByVersion('CS03-STACK-U04-JUDGE@0.1.0')!
    const rows = emptyBracketRows(u04.kind === 'bracket_judgement' ? u04 : expect.fail())
    const set = (index: number, matched: BracketRowInput['matched'], mismatchIndex = ''): void => {
      rows[index] = { ...rows[index], matched, mismatchIndex }
    }
    set(0, 'matched'); set(1, 'matched'); set(2, 'matched')
    set(3, 'mismatch', '2'); set(4, 'mismatch', '0'); set(5, 'mismatch', '0')
    const judgements = parseBracketJudgements(rows)
    expect(judgements).toEqual([
      { case: '', matched: true, mismatch_index: null },
      { case: '([{}])', matched: true, mismatch_index: null },
      { case: '()[]{}', matched: true, mismatch_index: null },
      { case: '([)]', matched: false, mismatch_index: 2 },
      { case: ')(', matched: false, mismatch_index: 0 },
      { case: '(()', matched: false, mismatch_index: 0 },
    ])
  })

  it('requires a verdict and a non-negative index for mismatches', () => {
    const u04 = structuredActivityByVersion('CS03-STACK-U04-JUDGE@0.1.0')!
    const untouched = emptyBracketRows(u04.kind === 'bracket_judgement' ? u04 : expect.fail())
    expect(() => parseBracketJudgements(untouched)).toThrow(/匹配/)
    const noIndex = emptyBracketRows(u04.kind === 'bracket_judgement' ? u04 : expect.fail())
    noIndex[0] = { ...noIndex[0], matched: 'mismatch', mismatchIndex: '' }
    expect(() => parseBracketJudgements(noIndex)).toThrow(/索引/)
  })
})

describe('structured attempt revision', () => {
  it('carries previous answers and explanation into a new revision but clears the result', () => {
    const u01 = traceActivity('CS03-STACK-U01-TRACE@0.1.0')
    const rows = emptyTraceRows(u01)
    rows[0] = { state: { items: '[4]' }, value: '', status: 'ok' }
    const first = { ...emptyAttempt(u01, 'space'), traceRows: rows, explanation: '我的理由' }
    const revised = emptyAttempt(u01, 'space', first)
    expect(revised.id).not.toBe(first.id)
    expect(revised.artifactId).toBe(first.artifactId)
    expect(revised.result).toBeNull()
    expect(revised.explanation).toBe('我的理由')
    expect(revised.traceRows[0]).toEqual({ state: { items: '[4]' }, value: '', status: 'ok' })
    expect(revised.traceRows).not.toBe(first.traceRows)
  })
})

describe('structured attempt state', () => {
  const resultWith = (statuses: Array<'met' | 'not_met' | 'needs_review'>): StructuredResult => ({
    criteria: statuses.map(status => ({ id: 'x', title: 'x', status, reason: '' })),
  } as StructuredResult)

  it('never asserts mastery: full trace is partial, a miss is consolidate, restored is unknown', () => {
    const activity = traceActivity('CS03-STACK-U01-TRACE@0.1.0')
    const passed = { ...emptyAttempt(activity, 'space'), result: resultWith(['met', 'met', 'needs_review', 'needs_review']) }
    expect(structuredAttemptState(passed)).toBe('partial')
    const missed = { ...emptyAttempt(activity, 'space'), result: resultWith(['not_met', 'met']) }
    expect(structuredAttemptState(missed)).toBe('consolidate')
    const restored = { ...passed, resultTrust: 'client_reported' }
    expect(structuredAttemptState(restored)).toBe('unknown')
    expect(structuredAttemptState(emptyAttempt(activity, 'space'))).toBe('unknown')
  })
})
