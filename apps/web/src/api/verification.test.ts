import { afterEach, describe, expect, it, vi } from 'vitest'
import { completeDraft, correctTrace, sampleResult } from '../test/fixtures'
import { canonicalHash, artifactContent } from '../domain/integrity'

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

describe('verification client integrity', () => {
  async function arrange(tamper: 'hash' | 'version' | null = null) {
    const revision = { ...completeDraft('test-space'), artifactId: crypto.randomUUID(), revisionId: crypto.randomUUID(), version: '1' }
    const result = sampleResult(); result.client_artifact_id = revision.artifactId; result.client_revision_id = revision.revisionId
    result.artifact_hash = await canonicalHash(artifactContent(revision, correctTrace))
    if (tamper === 'hash') result.artifact_hash = '0'.repeat(64)
    if (tamper === 'version') result.standard_version = 'wrong-version'
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ nonce: 'fixture-nonce' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ lease_id: 'fixture-lease', token: 'fixture-token', absolute_expires_at: new Date(Date.now() + 3600000).toISOString() }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ operation_id: 'fixture-op', lease_id: 'fixture-lease', revision: '1', result }), { status: 201 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { verifyTrace } = await import('./verification')
    return { revision, fetchMock, verifyTrace }
  }
  it('checks content hash and keeps cleanup explicit until the caller saves', async () => {
    const { revision, fetchMock, verifyTrace } = await arrange()
    const response = await verifyTrace(revision, correctTrace, 'fixture-stable-key')
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[2][1].headers['Idempotency-Key']).toBe('fixture-stable-key')
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).client_revision_id).toBe(revision.revisionId)
    await response.acknowledge()
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })
  it.each(['hash', 'version'] as const)('rejects mismatched %s before acknowledgement', async tamper => {
    const { revision, fetchMock, verifyTrace } = await arrange(tamper)
    await expect(verifyTrace(revision, correctTrace, 'fixture-key')).rejects.toThrow('来源或作品版本不一致')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
