import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import type { DestinationInterpreter } from '../src/destination/destination'

/** A person says where they want to go in a sentence, not an essay. */
const MAX_TEXT = 200

/**
 * The indoor proxy. Lives under /indoor-api because /api/** already rewrites
 * to the outdoor Cloud Run service. It never logs what the person typed.
 */
export function createApp(interpreter: DestinationInterpreter) {
  const app = new Hono()

  app.post('/indoor-api/destination', bodyLimit({ maxSize: 4 * 1024 }), async (c) => {
    const body: unknown = await c.req.json().catch(() => null)
    const text = (body as { text?: unknown } | null)?.text
    if (typeof text !== 'string' || !text.trim() || text.length > MAX_TEXT) {
      return c.json({ error: 'text must be 1–200 characters' }, 400)
    }
    const destination = await interpreter.interpret(text)
    return c.json({ mode: interpreter.mode, destination })
  })

  return app
}
