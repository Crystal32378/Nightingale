import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  // /indoor-api goes to the indoor proxy (npm run server); /api stays the
  // outdoor service's. preview.proxy defaults to this too.
  server: { host: true, proxy: { '/indoor-api': 'http://localhost:8787' } },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
})
