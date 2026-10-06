import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

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
  server: { proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: false } } },
  build: { target: 'es2022' },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
