import { expect, it } from 'vitest'
import { redactHiddenSuites } from './redaction'

it('removes hidden inputs and aggregate reasons from nested historical exports without changing work', () => {
  const record = { request: { files: { 'main.c': 'student work' } }, result: { suite_assessment: {
    cases: [{ kind: 'independent', stdin: 'secret-input', expected_stdout: 'secret-answer', observed_stdout: 'secret-output', case_code: 'secret-code', reason: 'secret-reason', status: 'not_met' }, { kind: 'visible', stdin: 'public', reason: 'public reason' }],
    criteria: [{ id: 'fixed_condition', status: 'not_met', reason: 'failed secret-input' }],
  } } }
  const result = redactHiddenSuites({ codeAttempts: [record] })
  expect(JSON.stringify(result)).not.toContain('secret-')
  expect(result.codeAttempts[0].request).toEqual(record.request)
  expect(result.codeAttempts[0].result.suite_assessment.criteria[0].status).toBe('not_met')
  expect(result.codeAttempts[0].result.suite_assessment.cases[1].stdin).toBe('public')
  expect(record.result.suite_assessment.cases[0].stdin).toBe('secret-input')
  expect(redactHiddenSuites(result)).toEqual(result)
})
