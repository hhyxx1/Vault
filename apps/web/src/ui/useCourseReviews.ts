import { useEffect, useState } from 'react'
import { listMyReviews, type ReviewAssignment } from '../api/reviews'
import { useAuth } from '../local/AuthProvider'
import { useLocal } from '../local/LocalProvider'

export function useCourseReviews(courseVersion: string) {
  const { account, ready, offline, epoch } = useAuth()
  const { spaceId } = useLocal()
  const [snapshot, setSnapshot] = useState<{ identity: string; rows: ReviewAssignment[]; unavailable: boolean } | null>(null)
  const identity = `${account?.id ?? 'guest'}:${epoch}:${spaceId}:${courseVersion}`
  useEffect(() => {
    setSnapshot(null)
    if (!ready || offline || account?.account_type !== 'student') return
    let active = true
    let controller: AbortController | null = null
    const refresh = () => {
      controller?.abort(); controller = new AbortController()
      const request = controller
      listMyReviews(request.signal).then(rows => {
        if (active && !request.signal.aborted) setSnapshot({ identity, rows, unavailable: false })
      }).catch(() => {
        if (active && !request.signal.aborted) setSnapshot({ identity, rows: [], unavailable: true })
      })
    }
    refresh()
    window.addEventListener('focus', refresh)
    return () => { active = false; controller?.abort(); window.removeEventListener('focus', refresh) }
  }, [account?.id, account?.account_type, ready, offline, epoch, spaceId, courseVersion, identity])
  return { rows: snapshot?.identity === identity ? snapshot.rows : [], unavailable: offline || (snapshot?.identity === identity && snapshot.unavailable), owner: account?.id ?? null }
}
