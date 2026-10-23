import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

export default defineConfig({
  plugins: [react()],
  base: './',
  // /indoor-api goes to the indoor proxy (npm run server); /api stays the
  // outdoor service's. preview.proxy defaults to this too. host: true lets a
  // phone open the page, so only this machine's own requests are forwarded —
  // anyone else would spend the key's credit. Others get 404 and the screen
  // falls back to the mock.
  server: {
    host: true,
    proxy: {
      '/indoor-api': {
        // Not localhost: it may resolve to ::1, and the proxy listens on 127.0.0.1.
        target: 'http://127.0.0.1:8787',
        bypass: (req) => (LOOPBACK.has(req.socket.remoteAddress ?? '') ? undefined : false),
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts'],
  },
})
