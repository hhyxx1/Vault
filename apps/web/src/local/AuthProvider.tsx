import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { AccountApiError, accountRequest, authenticatedRequest, authNonce, type Account } from '../api/accounts'
import { activateSpace, database, type LearningDatabase } from './database'
import { flushBeforeIdentityChange, localTabId } from './identity'
type AuthValue = { account: Account | null; epoch: number; ready: boolean; offline: boolean; error: string | null; login: (email: string, password: string) => Promise<void>; register: (email: string, password: string, displayName: string, type: 'student' | 'teacher') => Promise<void>; verifyEmail: (token: string) => Promise<void>; requestPasswordReset: (email: string) => Promise<void>; confirmPasswordReset: (token: string, password: string) => Promise<void>; logout: () => Promise<void>; refreshSession: () => Promise<void> }
const AuthContext = createContext<AuthValue | null>(null)
export async function persistIdentitySpace(value: Account | null, freshGuest = false, db: LearningDatabase = database, isCurrent: () => boolean = () => true) {
  await db.transaction('rw', [db.meta, db.spaces, db.drafts, db.revisions, db.evidence, db.help, db.teacherDrafts, db.personalCourses, db.personalCourseVersions, db.personalAttempts, db.personalAssists, db.courseAttempts, db.structuredAttempts], async () => {
    if (!isCurrent()) throw new DOMException('身份变化已过期。', 'AbortError')
    await activateSpace(value?.id ?? null, freshGuest, db, isCurrent)
    await db.meta.put({ key: 'cachedAccount', value: JSON.stringify(value) })
    if (!isCurrent()) throw new DOMException('身份变化已过期。', 'AbortError')
  })
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null)
  const [epoch, setEpoch] = useState(0); const [ready, setReady] = useState(false); const [offline, setOffline] = useState(false); const [error, setError] = useState<string | null>(null)
  const identity = useRef<string | null>(null); const request = useRef(0); const channel = useRef<BroadcastChannel | null>(null)
  const applyAccount = useCallback(async (value: Account | null, freshGuest = false, transition = request.current) => {
    const isCurrent = () => transition === request.current
    setReady(false); setEpoch(current => current + 1)
    await persistIdentitySpace(value, freshGuest, database, isCurrent)
    if (!isCurrent()) return
    identity.current = value?.id ?? null; setAccount(value); setReady(true)
  }, [])
  const refreshSession = useCallback(async () => {
    const current = ++request.current
    try {
      const response = await accountRequest<{ account: Account }>('auth/session')
      if (current !== request.current) return
      await applyAccount(response.account, false, current); if (current === request.current) { setOffline(false); setError(null) }
    } catch (failure) {
      if (current !== request.current) return
      if (failure instanceof AccountApiError && failure.status === 401) { await applyAccount(null, identity.current !== null, current); if (current === request.current) { setOffline(false); setError(null) } }
      else {
        const cached = await database.meta.get('cachedAccount'); const previous = cached ? JSON.parse(cached.value) as Account | null : null
        if (current !== request.current) return
        await applyAccount(previous, false, current); if (current === request.current) { setOffline(true); setError('暂时无法确认在线会话。可以继续编辑本机作品，联网后再确认账号与同步。') }
      }
    }
  }, [applyAccount])
  useEffect(() => {
    refreshSession().catch(() => { setError('账号与本地空间暂时无法打开，请检查浏览器存储。'); setReady(true) })
    if (typeof BroadcastChannel === 'undefined') return
    const bus = new BroadcastChannel('qionglong-identity'); channel.current = bus
    bus.onmessage = event => { if (event.data?.sender === localTabId) return; ++request.current; setReady(false); setEpoch(current => current + 1); refreshSession().catch(() => undefined) }
    return () => { ++request.current; bus.close(); channel.current = null }
  }, [refreshSession])
  useEffect(() => { const online = () => refreshSession().catch(() => undefined); window.addEventListener('online', online); return () => window.removeEventListener('online', online) }, [refreshSession])
  async function login(email: string, password: string) {
    await flushBeforeIdentityChange(); const current = ++request.current
    const nonce = await authNonce()
    const response = await accountRequest<{ account: Account; csrf_token: string }>('auth/login', { method: 'POST', body: JSON.stringify({ nonce, email, password }) })
    if (current !== request.current) throw new Error('另一个标签页已改变账号，请重新确认。')
    await applyAccount(response.account, false, current); if (current === request.current) { setOffline(false); setError(null); channel.current?.postMessage({ kind: 'identity_changed' }) }
  }
  async function register(email: string, password: string, displayName: string, type: 'student' | 'teacher') {
    const nonce = await authNonce()
    await accountRequest('auth/register', { method: 'POST', body: JSON.stringify({ nonce, email, password, display_name: displayName, account_type: type }) })
  }
  async function verifyEmail(token: string) {
    const nonce = await authNonce(); await accountRequest('auth/verify-email', { method: 'POST', body: JSON.stringify({ nonce, token }) })
  }
  async function requestPasswordReset(email: string) {
    const nonce = await authNonce(); await accountRequest('auth/password-reset/request', { method: 'POST', body: JSON.stringify({ nonce, email }) })
  }
  async function confirmPasswordReset(token: string, password: string) {
    await flushBeforeIdentityChange()
    const nonce = await authNonce(); await accountRequest('auth/password-reset/confirm', { method: 'POST', body: JSON.stringify({ nonce, token, password }) })
    channel.current?.postMessage({ kind: 'identity_changed' }); await refreshSession()
  }
  async function logout() {
    await flushBeforeIdentityChange(); const current = ++request.current
    await authenticatedRequest<void>('auth/logout', {})
    if (current !== request.current) throw new Error('账号状态已由另一标签页改变，请重新确认。')
    await applyAccount(null, true, current); if (current === request.current) { setOffline(false); setError(null); channel.current?.postMessage({ kind: 'identity_changed' }) }
  }
  return <AuthContext.Provider value={{ account, epoch, ready, offline, error, login, register, verifyEmail, requestPasswordReset, confirmPasswordReset, logout, refreshSession }}>{children}</AuthContext.Provider>
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('账号上下文尚未初始化。'); return value }
