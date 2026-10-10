import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { database, openLocalSpace, type LocalSpaceRecord, type SyncItem } from './database'
import { liveQuery } from 'dexie'
import type { EvidenceRecord, HelpEvent } from '../domain/learning'
import type { CodeAttempt } from '../domain/code'
import type { CourseAttempt } from '../domain/logic'
import type { StructuredAttempt } from '../domain/structured'
import { useAuth } from './AuthProvider'
import { syncAccount } from './sync'
import { flushBeforeIdentityChange } from './identity'
type LocalContextValue = { spaceId: string; evidence: EvidenceRecord[]; courseAttempts: CourseAttempt[]; structuredAttempts: StructuredAttempt[]; codeAttempts: CodeAttempt[]; help: HelpEvent[]; lastObjective: string | null; refresh: () => Promise<void>; error: string | null; spaces: LocalSpaceRecord[]; syncItems: SyncItem[]; syncing: boolean; syncError: string | null; syncNow: () => Promise<void>; selectSpace: (id: string) => Promise<void> }
const LocalContext = createContext<LocalContextValue | null>(null)
export function LocalProvider({ children }: { children: ReactNode }) {
  const auth = useAuth(); const currentAuth = useRef(auth); currentAuth.current = auth
  const [spaceId, setSpaceId] = useState(''); const spaceRef = useRef(''); spaceRef.current = spaceId
  const [evidence, setEvidence] = useState<EvidenceRecord[]>([]); const [help, setHelp] = useState<HelpEvent[]>([])
  const [courseAttempts, setCourseAttempts] = useState<CourseAttempt[]>([])
  const [codeAttempts, setCodeAttempts] = useState<CodeAttempt[]>([])
  const [structuredAttempts, setStructuredAttempts] = useState<StructuredAttempt[]>([])
  const [lastObjective, setLastObjective] = useState<string | null>(null); const [error, setError] = useState<string | null>(null)
  const [spaces, setSpaces] = useState<LocalSpaceRecord[]>([]); const [syncItems, setSyncItems] = useState<SyncItem[]>([])
  const [syncing, setSyncing] = useState(false); const [syncError, setSyncError] = useState<string | null>(null)
  const flight = useRef<AbortController | null>(null)
  const refresh = useCallback(async () => {
    const expectedEpoch = currentAuth.current.epoch
    const expectedAccountId = currentAuth.current.account?.id ?? null
    const id = await openLocalSpace()
    const [records, attempts, structured, code, events, last, allSpaces, items] = await Promise.all([database.evidence.where('spaceId').equals(id).toArray(), database.courseAttempts.where('spaceId').equals(id).toArray(), database.structuredAttempts.where('spaceId').equals(id).toArray(), database.codeAttempts.where('spaceId').equals(id).toArray(), database.help.where('spaceId').equals(id).toArray(), database.meta.get(`position:${id}`), database.spaces.toArray(), database.syncItems.where('spaceId').equals(id).toArray()])
    const accountId = currentAuth.current.account?.id ?? null
    const activeId = (await database.meta.get('spaceId'))?.value
    if (expectedEpoch !== currentAuth.current.epoch || expectedAccountId !== accountId || !currentAuth.current.ready || activeId !== id) return
    const active = allSpaces.find(space => space.id === id)
    if (!active || (accountId ? active.ownerId !== accountId && active.pendingOwnerId !== accountId && !!(active.ownerId || active.pendingOwnerId) : !!(active.ownerId || active.pendingOwnerId))) return
    setSpaceId(id); setEvidence(records.sort((a, b) => a.createdAt.localeCompare(b.createdAt))); setCourseAttempts(attempts.sort((a, b) => a.createdAt.localeCompare(b.createdAt))); setCodeAttempts(code); setStructuredAttempts(structured.sort((a, b) => a.createdAt.localeCompare(b.createdAt))); setHelp(events.sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
    setLastObjective(last?.value || null); setSpaces(allSpaces.filter(space => accountId ? space.ownerId === accountId || space.pendingOwnerId === accountId || space.id === id : space.id === id)); setSyncItems(items)
  }, [])
  useEffect(() => {
    flight.current?.abort(); flight.current = null; setSyncing(false); setSyncError(null); setSpaceId(''); setEvidence([]); setCourseAttempts([]); setStructuredAttempts([]); setCodeAttempts([]); setHelp([]); setLastObjective(null); setSpaces([]); setSyncItems([])
    if (!auth.ready) return
    const subscription = liveQuery(async () => { await database.meta.toArray(); await database.spaces.toArray(); await database.syncItems.toArray(); await database.evidence.count(); await database.courseAttempts.count(); await database.structuredAttempts.count(); await database.codeAttempts.count(); await database.help.count(); return true }).subscribe({ next: () => refresh().catch(() => setError('无法读取本地空间，请检查浏览器存储权限。')), error: () => setError('本地学习空间暂时不可用。') })
    return () => { subscription.unsubscribe(); flight.current?.abort(); flight.current = null }
  }, [auth.ready, auth.epoch, refresh])
  const syncNow = useCallback(async () => {
    const state = currentAuth.current; const id = spaceRef.current
    if (!state.account || state.offline || !id || flight.current) return
    const controller = new AbortController(); flight.current = controller; setSyncing(true); setSyncError(null)
    const expectedEpoch = state.epoch
    const isCurrent = () => currentAuth.current.epoch === expectedEpoch && currentAuth.current.account?.id === state.account!.id && spaceRef.current === id && !controller.signal.aborted
    try { await syncAccount(id, { account: state.account, isCurrent, signal: controller.signal }); if (isCurrent()) await refresh() }
    catch (failure) { if (isCurrent()) setSyncError(failure instanceof Error ? failure.message : '同步未完成，作品保留在本机。') }
    finally { if (flight.current === controller) { flight.current = null; setSyncing(false) } }
  }, [refresh])
  const pendingSignature = syncItems.filter(item => item.status === 'pending' || item.status === 'dependency_pending').map(item => `${item.key}:${item.modifiedAt ?? item.version}`).join('|')
  useEffect(() => {
    if (!auth.account || auth.offline || !spaceId) return
    const timer = window.setTimeout(() => { syncNow().catch(() => undefined) }, 900)
    return () => window.clearTimeout(timer)
  }, [auth.account?.id, auth.epoch, auth.offline, spaceId, pendingSignature, syncNow])
  async function selectSpace(id: string) {
    const expectedEpoch = auth.epoch; const expectedAccountId = auth.account?.id; const expectedActiveId = spaceRef.current
    const isCurrent = () => currentAuth.current.ready && currentAuth.current.epoch === expectedEpoch && currentAuth.current.account?.id === expectedAccountId
    await flushBeforeIdentityChange()
    await database.transaction('rw', database.meta, database.spaces, async () => {
      if (!expectedAccountId || !isCurrent()) throw new Error('账号已变化，已取消空间切换。')
      const cached = await database.meta.get('cachedAccount'); const active = await database.meta.get('spaceId'); const space = await database.spaces.get(id)
      if (!isCurrent() || !cached || JSON.parse(cached.value)?.id !== expectedAccountId || active?.value !== expectedActiveId) throw new Error('账号或空间已变化，已取消迟到的切换。')
      if (!space || (space.ownerId !== expectedAccountId && space.pendingOwnerId !== expectedAccountId)) throw new Error('该空间不属于当前账号。')
      await database.meta.put({ key: 'spaceId', value: id })
      if (!isCurrent()) throw new Error('账号已变化，已取消空间切换。')
    })
    flight.current?.abort(); flight.current = null; setSyncing(false); await refresh()
  }
  if (!auth.ready || !spaceId) return <div className="page page-loading" role="status">{error ?? '正在确认账号并打开独立学习空间…'}</div>
  return <LocalContext.Provider value={{ spaceId, evidence, courseAttempts, structuredAttempts, codeAttempts, help, lastObjective, refresh, error, spaces, syncItems, syncing, syncError, syncNow, selectSpace }}>{children}</LocalContext.Provider>
}
export function useLocal() { const value = useContext(LocalContext); if (!value) throw new Error('本地空间尚未初始化。'); return value }
