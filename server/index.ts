import { serve } from '@hono/node-server'
import { MockInterpreter } from '../src/destination/mock'
import { NemotronInterpreter } from '../src/destination/nemotron'
import { createApp } from './app'
import { tavilyExtract } from './tavily'

// The key lives in .env locally and in the platform's environment when
// deployed. A missing .env is fine: no key means the mock.
try {
  process.loadEnvFile()
} catch {
  // no .env
}

const apiKey = process.env.NEBIUS_API_KEY?.trim()
const interpreter = apiKey ? new NemotronInterpreter({ apiKey }) : new MockInterpreter()
// No Tavily key: the clinic lookup answers 503 and the screen links to the hospital site.
const tavilyKey = process.env.TAVILY_API_KEY?.trim()
const extract = tavilyKey ? tavilyExtract(tavilyKey) : undefined
const port = Number(process.env.PORT) || 8787
// Loopback only: anyone else who can reach this spends the key's credit
// without knowing it. A deploy sets HOST=0.0.0.0 behind its own protection.
const hostname = process.env.HOST || '127.0.0.1'

serve({ fetch: createApp(interpreter, extract).fetch, port, hostname }, () => {
  console.log(`indoor proxy on http://${hostname}:${port} (${interpreter.mode}, clinics ${extract ? 'on' : 'off'})`)
})
