import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { campusUrl, isCampusCode, parseCampuses, parseDepartments, TPECH_HOME } from '../src/clinics/tpech'
import type { DestinationInterpreter } from '../src/destination/destination'
import type { Extract } from './tavily'

/** A person says where they want to go in a sentence, not an essay. */
const MAX_TEXT = 200

/**
 * Token Factory has no spending cap, so the proxy keeps one: requests per
 * person per minute (every route), and model calls per Taipei day (all
 * people). A daily limit of 0 is the kill switch.
 */
export interface Limits {
  perMinute: number
  perDay: number
  now?: () => number
}

/** Limits from the environment. A value that is not a whole number refuses to start. */
export function readLimits(env: Record<string, string | undefined>): Limits {
  const read = (name: string, fallback: number, min: number) => {
    const raw = env[name]?.trim()
    if (!raw) return fallback
    if (!/^\d+$/.test(raw) || Number(raw) < min) throw new Error(`${name} must be a whole number ≥ ${min}, got "${raw}"`)
    return Number(raw)
  }
  return { perMinute: read('RATE_LIMIT_PER_MINUTE', 10, 1), perDay: read('DAILY_LIMIT', 400, 0) }
}

/**
 * The indoor proxy. Lives under /indoor-api because /api/** already rewrites
 * to the outdoor Cloud Run service. It never logs what the person typed.
 */
export function createApp(interpreter: DestinationInterpreter, extract?: Extract, limits: Limits = readLimits({})) {
  const app = new Hono()
  const now = limits.now ?? Date.now

  // Refusals carry the mode too, so the screen can tell a refused sentence
  // (uncertain) from a proxy it cannot use (the mock).
  const mode = interpreter.mode
  const tooLarge = bodyLimit({ maxSize: 4 * 1024, onError: (c) => c.json({ mode, error: 'body too large' }, 413) })

  // ponytail: in memory, so a restart or a second instance starts again at 0 —
  // deploy with --max-instances=1; a Firestore counter if a hard daily total is needed.
  let minute = -1
  const perPerson = new Map<string, number>()
  let day = ''
  let calls = 0

  app.use('/indoor-api/*', async (c, next) => {
    const thisMinute = Math.floor(now() / 60_000)
    if (thisMinute !== minute) {
      minute = thisMinute
      perPerson.clear()
    }
    // ponytail: the first forwarded address, which a client can forge; check what
    // Hosting → Cloud Run actually sends once deployed. The daily limit holds either way.
    const incoming = (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)?.incoming
    const who = c.req.header('x-forwarded-for')?.split(',')[0].trim() || incoming?.socket?.remoteAddress || 'unknown'
    const count = (perPerson.get(who) ?? 0) + 1
    perPerson.set(who, count)
    if (count > limits.perMinute) return c.json({ mode, error: 'too many requests' }, 429)
    await next()
  })

  app.post('/indoor-api/destination', tooLarge, async (c) => {
    const body: unknown = await c.req.json().catch(() => null)
    const text = (body as { text?: unknown } | null)?.text
    if (typeof text !== 'string' || !text.trim() || text.length > MAX_TEXT) {
      return c.json({ mode, error: 'text must be 1–200 characters' }, 400)
    }
    const today = new Date(now() + 8 * 3_600_000).toISOString().slice(0, 10) // Taipei, UTC+8
    if (today !== day) {
      day = today
      calls = 0
    }
    if (calls >= limits.perDay) return c.json({ mode, error: 'daily limit reached' }, 429)
    calls++
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
