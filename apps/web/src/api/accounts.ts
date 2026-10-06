export type Account = { id: string; email: string; display_name: string; account_type: 'student' | 'teacher'; teacher_verification_state: string | null }
export class AccountApiError extends Error {
  constructor(message: string, public status: number, public code: string) { super(message) }
}
export async function accountRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/v1/${path}`, { ...options, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...options.headers } })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new AccountApiError(data.message ?? '账号服务暂时无法完成请求，请重试。', response.status, data.code ?? 'REQUEST_FAILED')
  }
  return response.status === 204 ? undefined as T : response.json()
}
export async function authNonce() { return (await accountRequest<{ nonce: string }>('auth/nonce', { method: 'POST' })).nonce }
export async function csrfToken() { return (await accountRequest<{ csrf_token: string }>('auth/csrf')).csrf_token }
export async function authenticatedRequest<T>(path: string, body: unknown, signal?: AbortSignal, key?: string): Promise<T> {
  const csrf = await csrfToken()
  return accountRequest<T>(path, { method: 'POST', body: JSON.stringify(body), signal, headers: { 'X-CSRF-Token': csrf, ...(key ? { 'Idempotency-Key': key } : {}) } })
}
