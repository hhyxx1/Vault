import { expect, test } from 'vitest'
import { parseProcessorTrace } from './processor-trace'
import { readFileSync } from 'node:fs'

const row = (cycle: number, phase: string) => [cycle, phase, 0, [0, 0, 0, 0], {}]
const report = {
  status: 'halted', cycles: 4, registers: [0, 0, 0, 0], memory: Array(16).fill(0),
  encoded_words: [0], cache_events: [], final_flush: [],
  trace: ['fetch', 'decode', 'execute', 'commit'].map((phase, i) => row(i + 1, phase)),
}

test('bounded actual processor output yields navigable phase and register snapshots', () => {
  const parsed = parseProcessorTrace(JSON.stringify(report))
  expect(parsed?.steps).toHaveLength(4)
  expect(parsed?.steps[3]).toEqual({ cycle: 4, phase: 'commit', pc: 0, registers: [0, 0, 0, 0], controls: {} })
})

test('all authored processor results retain navigable actual cycles', () => {
  const rows = JSON.parse(readFileSync(new URL('../../../../services/backend/fixtures/course-code/CS06-project.json', import.meta.url), 'utf8')) as { task: string; stdout: string }[]
  const selected = rows.filter(row => row.task.startsWith('processor-'))
  expect(selected).toHaveLength(6)
  for (const row of selected) {
    const parsed = parseProcessorTrace(row.stdout)
    expect(parsed?.status).toBe('halted')
    expect(parsed?.steps.at(-1)?.phase).toBe('commit')
  }
})

test('partial output and malformed snapshots do not fabricate a playable trace', () => {
  for (const value of ['{', '{}', JSON.stringify({ ...report, cycles: 5 }),
    JSON.stringify({ ...report, trace: [row(1, 'fetch')] }),
    JSON.stringify({ ...report, trace: [row(1, 'commit'), ...report.trace.slice(1)] }),
    JSON.stringify({ ...report, trace: [ [1, 'fetch', 0, [256, 0, 0, 0], {}], ...report.trace.slice(1)] }),
    JSON.stringify({ ...report, trace: [ [1, 'fetch', 0, [0, 0, 0, 0], { reg_write: 'true' }], ...report.trace.slice(1)] }),
    ' '.repeat(65537),
  ]) expect(parseProcessorTrace(value)).toBeNull()
})
