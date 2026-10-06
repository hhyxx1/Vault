const CACHE_NAME = __CACHE_NAME__
const SHELL_ASSETS = __SHELL_ASSETS__
const STATIC_PATHS = new Set(SHELL_ASSETS)

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS)))
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names.filter(name => name.startsWith('vault-shell-') && name !== CACHE_NAME).map(name => caches.delete(name)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname === '/api' || url.pathname.startsWith('/api/')) return
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => {
      const shell = await caches.match('/index.html')
      if (shell) return shell
      throw new Error('Offline app shell is unavailable')
    }))
    return
  }
  if (STATIC_PATHS.has(url.pathname)) {
    event.respondWith(caches.match(url.pathname).then(cached => cached || fetch(request)))
  }
})
