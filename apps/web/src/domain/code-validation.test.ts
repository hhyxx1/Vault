import { expect, test } from 'vitest'
import { validateCodeRequest, type CodeRequest } from './code'

test('explicit scientific Python profile accepts only controlled Python files', () => {
  const request = { language: 'python313ml', entry: 'main.py', files: { 'main.py': 'import sklearn' }, stdin: '' } as CodeRequest
  expect(() => validateCodeRequest(request)).not.toThrow()
  expect(() => validateCodeRequest({ ...request, entry: 'main.js', files: { 'main.js': 'import sklearn' } })).toThrow()
})

test('isolated SQL requests preserve a single script and reject client commands', () => {
  const request = { language: 'postgres18', entry: 'main.sql', files: { 'main.sql': 'SELECT 1;' }, stdin: '' } as CodeRequest
  expect(() => validateCodeRequest(request)).not.toThrow()
  for (const source of ['SELECT 1;\\connect postgres', '\\! id']) {
    expect(() => validateCodeRequest({ ...request, files: { 'main.sql': source } })).toThrow()
  }
  expect(() => validateCodeRequest({ ...request, stdin: '1' })).toThrow()
  expect(() => validateCodeRequest({ ...request, files: { 'main.sql': 'SELECT 1;', 'other.sql': 'SELECT 2;' } })).toThrow()
})
