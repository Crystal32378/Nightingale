import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { campusUrl, isCampusCode, parseCampuses, parseDepartments, TPECH_HOME } from '../src/clinics/tpech'
import type { DestinationInterpreter } from '../src/destination/destination'
import type { Extract } from './tavily'

/** A person says where they want to go in a sentence, not an essay. */
const MAX_TEXT = 200

/**
 * The indoor proxy. Lives under /indoor-api because /api/** already rewrites
 * to the outdoor Cloud Run service. It never logs what the person typed.
 */
export function createApp(interpreter: DestinationInterpreter, extract?: Extract) {
  const app = new Hono()

  // Refusals carry the mode too, so the screen can tell a refused sentence
  // (uncertain) from a proxy it cannot use (the mock).
  const mode = interpreter.mode
  const tooLarge = bodyLimit({ maxSize: 4 * 1024, onError: (c) => c.json({ mode, error: 'body too large' }, 413) })

  app.post('/indoor-api/destination', tooLarge, async (c) => {
    const body: unknown = await c.req.json().catch(() => null)
    const text = (body as { text?: unknown } | null)?.text
    if (typeof text !== 'string' || !text.trim() || text.length > MAX_TEXT) {
      return c.json({ mode, error: 'text must be 1–200 characters' }, 400)
    }
    const destination = await interpreter.interpret(text)
    return c.json({ mode, destination })
  })

  // Clinic lookup: the hospital's own pages, read through Tavily at request
  // time. Names come back as the page writes them; no page, no answer.
  app.get('/indoor-api/campuses', async (c) => {
    if (!extract) return c.json({ error: 'lookup not configured' }, 503)
    try {
      const campuses = parseCampuses(await extract(TPECH_HOME))
      if (campuses.length === 0) throw new Error('no campuses on the page')
      return c.json({ source: TPECH_HOME, campuses })
    } catch {
      return c.json({ error: 'hospital page unavailable' }, 502)
    }
  })

  app.get('/indoor-api/departments', async (c) => {
    if (!extract) return c.json({ error: 'lookup not configured' }, 503)
    const campus = c.req.query('campus') ?? ''
    if (!isCampusCode(campus)) return c.json({ error: 'unknown campus' }, 400)
    const source = campusUrl(campus)
    try {
      const departments = parseDepartments(await extract(source), campus)
      if (departments.length === 0) throw new Error('no departments on the page')
      return c.json({ source, departments })
    } catch {
      return c.json({ error: 'hospital page unavailable' }, 502)
    }
  })

  return app
}
