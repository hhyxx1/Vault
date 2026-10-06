// Identity changes flush the visible work first. Epoch changes invalidate requests
// in every mounted workbench, including changes announced by another tab.
const flushers = new Set<() => Promise<unknown>>()
export function registerIdentityFlusher(flush: () => Promise<unknown>) { flushers.add(flush); return () => { flushers.delete(flush) } }
export async function flushBeforeIdentityChange() { await Promise.all([...flushers].map(flush => flush())) }
