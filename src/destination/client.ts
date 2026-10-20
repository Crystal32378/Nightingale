import type { FetchLike } from '../remote/last300mClient'
import { parseDestination, UNCERTAIN, type Destination } from './destination'
import { MockInterpreter } from './mock'

export type InterpreterMode = 'mock' | 'nemotron'

/** What the screen gets: where to go, and which interpreter decided (模擬 / Nemotron). */
export interface DestinationAnswer {
  mode: InterpreterMode
  destination: Destination
}

export interface DestinationClientOptions {
  /** Where the indoor proxy lives; '' means the same origin (Vite proxies it in dev). */
  baseUrl?: string
  fetchImpl?: FetchLike
  /** Longer than the server's 8 s Nemotron timeout, so its uncertain arrives first. */
  timeoutMs?: number
}

/**
 * The screen's side of the indoor proxy. Whenever the proxy cannot be used —
 * not there, an HTTP error, an answer it does not recognise, too slow — the
 * mock answers instead and says so. A place the proxy names still goes
 * through parseDestination.
 */
export class DestinationClient {
  private readonly baseUrl: string
  private readonly fetchImpl: FetchLike
  private readonly timeoutMs: number
  private readonly mock = new MockInterpreter()

  constructor({ baseUrl = '', fetchImpl = (input, init) => fetch(input, init), timeoutMs = 10_000 }: DestinationClientOptions = {}) {
    this.baseUrl = baseUrl
    this.fetchImpl = fetchImpl
    this.timeoutMs = timeoutMs
  }

  async interpret(text: string): Promise<DestinationAnswer> {
    const fromProxy = await this.askProxy(text)
    return fromProxy ?? { mode: 'mock', destination: await this.mock.interpret(text) }
  }

  /** The proxy's answer, or null when it cannot be used. */
  private async askProxy(text: string): Promise<DestinationAnswer | null> {
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/indoor-api/destination`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(this.timeoutMs),
      })
      if (!res.ok) return null
      const { mode, destination } = (await res.json()) ?? {}
      if (mode !== 'mock' && mode !== 'nemotron') return null
      if (destination?.kind === 'uncertain') return { mode, destination: UNCERTAIN }
      if (destination?.kind === 'place') return { mode, destination: parseDestination(destination.placeId) }
      return null
    } catch {
      return null
    }
  }
}
