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

it.each(['reload', 'expired', 'budget', 'busy'])('continues code execution safely after %s', async scenario => {
  const storage = new Map<string, string>()
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  })
  const request = { language: 'python313' as const, entry: 'main.py', files: { 'main.py': 'print(5)' }, stdin: '' }
  const attempt = { id: crypto.randomUUID(), artifactId: crypto.randomUUID(), spaceId: crypto.randomUUID(), activityKey: 'custom:continued', request, requestHash: await canonicalHash(request), result: null, resultTrust: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  let minted = 0
  let rejected = false
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith('/guest-nonce')) return Response.json({ nonce: 'nonce' })
    if (url.endsWith('/guest-leases')) {
      minted++
      return Response.json({ lease_id: `lease-${minted}`, token: 'anonymous-token', allowed_operations: ['run_code'], idle_expires_at: new Date(Date.now()+60000).toISOString(), absolute_expires_at: new Date(Date.now()+120000).toISOString() })
    }
    if (url.endsWith('/ack')) return Response.json({})
    if (!rejected && scenario !== 'reload') {
      rejected = true
      const code = scenario === 'expired' ? 'GUEST_LEASE_EXPIRED' : scenario === 'budget' ? 'GUEST_BUDGET_EXCEEDED' : 'CODE_WORKER_BUSY'
      return Response.json({ code, message: code }, { status: scenario === 'expired' ? 401 : 429 })
    }
    const body = JSON.parse(String(options?.body))
    const current = url.match(/guest-leases\/([^/]+)/)![1]
    return Response.json({ operation_id: body.client_revision_id, lease_id: current, kind: 'run_code', status: 'completed', revision: '2', result: { status: 'success', phase: 'run', stdout: '5\n', stderr: '', truncated: false, metadata: {}, runtime_profile: 'python313-isolate-dev@0.1.0', request_sha256: attempt.requestHash, mastery_asserted: false, client_artifact_id: body.client_artifact_id, client_revision_id: body.client_revision_id } })
  }))
  let api = await import('./verification')
  if (scenario === 'busy') {
    await expect(api.runCode(attempt)).rejects.toThrow('CODE_WORKER_BUSY')
    expect(minted).toBe(1)
  } else {
    const first = await api.runCode(attempt)
    await first.acknowledge()
    if (scenario === 'reload') {
      vi.resetModules()
      api = await import('./verification')
      await api.runCode({ ...attempt, id: crypto.randomUUID() })
      expect(minted).toBe(1)
    } else expect(minted).toBe(2)
  }
})
