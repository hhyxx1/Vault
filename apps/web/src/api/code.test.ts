import { afterEach, expect, it, vi } from 'vitest'
import { canonicalHash } from '../domain/integrity'
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })
it.each([false, true])('polls a submitted code version and refuses mismatched output (tampered=%s)', async tampered => {
  const request = { language: 'python313' as const, files: { 'main.py': 'print(5)' }, entry: 'main.py', stdin: '' }
  const attempt = { id: crypto.randomUUID(), artifactId: crypto.randomUUID(), spaceId: crypto.randomUUID(), activityKey: 'custom:addition', request, requestHash: await canonicalHash(request), result: null, resultTrust: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  const result = { status: 'success', phase: 'run', stdout: '5\n', stderr: '', truncated: false, metadata: {}, runtime_profile: 'python313-isolate-dev@0.1.0', request_sha256: tampered ? '0'.repeat(64) : attempt.requestHash, mastery_asserted: false, client_artifact_id: attempt.artifactId, client_revision_id: attempt.id }
  const calls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    calls.push(url)
    if (url.endsWith('/guest-nonce')) return Response.json({ nonce: 'nonce' })
    if (url.endsWith('/guest-leases')) return Response.json({ lease_id: 'lease', token: 'token', allowed_operations: ['run_code'], absolute_expires_at: new Date(Date.now()+60000).toISOString() })
    if (url.endsWith('/operations')) {
      const body = JSON.parse(String(options?.body))
      expect(body.code.files['main.py']).toBe('print(5)')
      expect(options?.headers).toMatchObject({ 'Idempotency-Key': attempt.id })
      return Response.json({ operation_id: 'op', lease_id: 'lease', kind: 'run_code', status: 'running', revision: '1', result: null })
    }
    if (url.endsWith('/ack')) return Response.json({})
    return Response.json({ operation_id: 'op', lease_id: 'lease', kind: 'run_code', status: 'completed', revision: '2', result })
  }))
  const api = await import('./verification')
  expect(typeof api.runCode).toBe('function')
  if (tampered) await expect(api.runCode(attempt)).rejects.toThrow('不一致')
  else {
    const response = await api.runCode(attempt)
    expect(response.result.stdout).toBe('5\n')
    expect(calls.some(path => path.endsWith('/ack'))).toBe(false)
    await response.acknowledge()
    expect(calls.at(-1)).toMatch(/\/ack$/)
  }
})
