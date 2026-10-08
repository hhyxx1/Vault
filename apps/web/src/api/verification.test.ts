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
  it('sends personal assistance only after an explicit attempt-scoped request', async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
      calls.push({ url, body: options?.body ? JSON.parse(String(options.body)) : {} })
      if (url.endsWith('/guest-nonce')) return new Response(JSON.stringify({ nonce: 'test-nonce' }), { status: 200 })
      if (url.endsWith('/guest-leases')) return new Response(JSON.stringify({ lease_id: 'lease', token: 'token', absolute_expires_at: new Date(Date.now() + 3600000).toISOString() }), { status: 201 })
      return new Response(JSON.stringify({ message: '试另一组输入。', next_action: '记录新结果。', mastery_asserted: false }), { status: 200 })
    }))
    const { requestPersonalLearningAssist } = await import('./verification')
    const input = { request_id: crypto.randomUUID(), course_id: crypto.randomUUID(), scope_version_id: crypto.randomUUID(), topic_id: crypto.randomUUID(), attempt_id: crypto.randomUUID(),
      course_title: '操作系统', course_goal: '解释调度', topic_title: '时间片', expected_performance: '比较两种调度', attempt_excerpt: '已尝试两种时间片。', question: '接下来怎么改？', intent: 'practice' as const, disclosure_accepted: true as const }
    const reply = await requestPersonalLearningAssist(input)
    expect(reply.mastery_asserted).toBe(false)
    expect(calls[1].body).not.toHaveProperty('course_code')
    expect(calls[2].url).toContain('/personal-learning-assist')
    expect(calls[2].body).toMatchObject({ attempt_id: input.attempt_id, scope_version_id: input.scope_version_id, disclosure_accepted: true })
  })
  it('rejects a personal assistant reply that asserts mastery', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/guest-nonce')) return new Response(JSON.stringify({ nonce: 'test-nonce' }), { status: 200 })
      if (url.endsWith('/guest-leases')) return new Response(JSON.stringify({ lease_id: 'lease', token: 'token', absolute_expires_at: new Date(Date.now() + 3600000).toISOString() }), { status: 201 })
      return new Response(JSON.stringify({ message: '你已掌握。', next_action: '无需继续。', mastery_asserted: true }), { status: 200 })
    }))
    const { requestPersonalLearningAssist } = await import('./verification')
    await expect(requestPersonalLearningAssist({
      request_id: crypto.randomUUID(), course_id: crypto.randomUUID(), scope_version_id: crypto.randomUUID(),
      topic_id: crypto.randomUUID(), attempt_id: crypto.randomUUID(), course_title: '操作系统',
      course_goal: '解释调度', topic_title: '时间片', expected_performance: '比较两种调度',
      attempt_excerpt: '已尝试两种时间片。', question: '接下来怎么改？', intent: 'practice', disclosure_accepted: true,
    })).rejects.toThrow('掌握状态不符合契约')
  })
})
