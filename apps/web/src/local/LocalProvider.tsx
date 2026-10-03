import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { database, openLocalSpace } from './database'
import { liveQuery } from 'dexie'
import type { EvidenceRecord, HelpEvent } from '../domain/learning'

type LocalContextValue = { spaceId: string; evidence: EvidenceRecord[]; help: HelpEvent[]; lastObjective: string | null; refresh: () => Promise<void>; error: string | null }
const LocalContext = createContext<LocalContextValue | null>(null)

export function LocalProvider({ children }: { children: ReactNode }) {
  const [spaceId, setSpaceId] = useState('')
  const [evidence, setEvidence] = useState<EvidenceRecord[]>([])
  const [help, setHelp] = useState<HelpEvent[]>([])
  const [lastObjective, setLastObjective] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const refresh = useCallback(async () => {
    const id = await openLocalSpace()
    const [records, events, last] = await Promise.all([database.evidence.where('spaceId').equals(id).toArray(), database.help.where('spaceId').equals(id).toArray(), database.meta.get('lastObjective')])
    setSpaceId(id)
    setEvidence(records.sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
    setHelp(events.sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
    setLastObjective(last?.value ?? null)
  }, [])
  useEffect(() => { refresh().catch(() => setError('无法打开本地学习空间。请检查浏览器存储权限；当前内容还不能保证保存。')) }, [refresh])
  useEffect(() => {
    const subscription = liveQuery(() => database.meta.get('lastObjective')).subscribe({ next: record => setLastObjective(record?.value ?? null), error: () => setError('继续学习位置暂时无法读取，请检查本地存储。') })
    return () => subscription.unsubscribe()
  }, [])
  return <LocalContext.Provider value={{ spaceId, evidence, help, lastObjective, refresh, error }}>{children}</LocalContext.Provider>
}

export function useLocal() {
  const value = useContext(LocalContext)
  if (!value) throw new Error('本地空间尚未初始化。')
  return value
}
