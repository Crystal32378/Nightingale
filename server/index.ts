import { serve } from '@hono/node-server'
import { MockInterpreter } from '../src/destination/mock'
import { NemotronInterpreter } from '../src/destination/nemotron'
import { createApp } from './app'

// The key lives in .env locally and in the platform's environment when
// deployed. A missing .env is fine: no key means the mock.
try {
  process.loadEnvFile()
} catch {
  // no .env
}

const apiKey = process.env.NEBIUS_API_KEY?.trim()
const interpreter = apiKey ? new NemotronInterpreter({ apiKey }) : new MockInterpreter()
const port = Number(process.env.PORT) || 8787

serve({ fetch: createApp(interpreter).fetch, port }, () => {
  console.log(`indoor proxy on http://localhost:${port} (${interpreter.mode})`)
})
