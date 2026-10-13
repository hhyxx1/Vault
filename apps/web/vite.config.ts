import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

// A local managed preview can move ports without interrupting an existing UI.
// CI has no ignored pointer and keeps the standard 8000 target.
function apiProxyTarget() {
  const configured = process.env.VAULT_API_PROXY_TARGET
  if (configured && configured !== 'http://127.0.0.1:8000' && configured !== 'http://localhost:8000') return configured
  try {
    const pointer = JSON.parse(readFileSync(new URL('../../.pytest-tmp-svc/active-preview.json', import.meta.url), 'utf8'))
    if (Number.isInteger(pointer.api_port) && pointer.api_port >= 1024 && pointer.api_port <= 65535) return `http://127.0.0.1:${pointer.api_port}`
  } catch { /* The normal development/CI target remains usable. */ }
  return configured ?? 'http://127.0.0.1:8000'
}


export default defineConfig({
  plugins: [react(), {
    name: 'vault-public-offline-shell',
    apply: 'build',
    generateBundle(_options, bundle) {
      const assets = ['/', '/index.html', '/favicon.svg', ...Object.keys(bundle).filter(name => !name.endsWith('.map')).map(name => `/${name}`)]
      const cacheName = `vault-shell-${Date.now()}`
      const template = readFileSync(new URL('./offline-sw.js', import.meta.url), 'utf8')
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: template.replace('__CACHE_NAME__', JSON.stringify(cacheName)).replace('__SHELL_ASSETS__', JSON.stringify(assets)) })
    },
  }],
  server: {
    allowedHosts: ['.frp-six.com'],
    proxy: { '/api': { target: apiProxyTarget(), changeOrigin: false } },
  },
  build: { target: 'es2022' },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
