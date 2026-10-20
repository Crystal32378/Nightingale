import type { FetchLike } from '../remote/last300mClient'
import { DESTINATION_IDS, parseDestination, UNCERTAIN, type Destination, type DestinationId, type DestinationInterpreter } from './destination'

export const NEMOTRON_ENDPOINT = 'https://api.tokenfactory.nebius.com/v1/chat/completions'
export const NEMOTRON_MODEL = 'nvidia/nemotron-3-super-120b-a12b'

/** What each id means, in the words people use for it. */
const MEANINGS: Record<DestinationId, string> = {
  ENTRANCE: '醫院大門、入口',
  REGISTRATION: '掛號',
  ELEVATOR_IN: '電梯',
  NEUROSURGERY: '神經外科門診、看診',
  CASHIER: '批價、繳費、付錢',
  PHARMACY: '藥局、領藥、拿藥',
  EXIT: '出口、離開醫院',
}

const SYSTEM_PROMPT = [
  '你是醫院導覽的目的地分類器。使用者會說一句想去哪裡的話。',
  '只回覆下列其中一個 ID，不要任何其他文字：',
  ...DESTINATION_IDS.map((id) => `${id}：${MEANINGS[id]}`),
  'UNCERTAIN：你判斷不出使用者要去哪裡、使用者說不要去某個地方、或和找地點無關。（使用者說「不知道藥局在哪」仍然是要去藥局。）',
  '提到不只一個地點時：如果先後順序清楚（例如「先去批價再去藥局」），回第一個要去的地點；順序不清楚或是在問要選哪一個（例如「藥局還是批價？」），回 UNCERTAIN。',
].join('\n')

export interface NemotronOptions {
  apiKey: string
  fetchImpl?: FetchLike
  /** A person is standing there waiting; past this, 我陪你問 is the better answer. */
  timeoutMs?: number
}

/**
 * Asks Nemotron on Nebius Token Factory. Server-side only: it needs the API
 * key, which must never reach the browser bundle — the proxy reads it from
 * the environment and passes it in. Every failure is uncertain, never an
 * error; nothing here logs what the person typed.
 */
export class NemotronInterpreter implements DestinationInterpreter {
  readonly mode = 'nemotron'
  private readonly apiKey: string
  private readonly fetchImpl: FetchLike
  private readonly timeoutMs: number

  constructor({ apiKey, fetchImpl = (input, init) => fetch(input, init), timeoutMs = 8000 }: NemotronOptions) {
    this.apiKey = apiKey
    this.fetchImpl = fetchImpl
    this.timeoutMs = timeoutMs
  }

  async interpret(text: string): Promise<Destination> {
    if (!text.trim()) return UNCERTAIN
    try {
      const res = await this.fetchImpl(NEMOTRON_ENDPOINT, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: NEMOTRON_MODEL,
          temperature: 0,
          // Nemotron reasons before answering; 50–160 tokens in our first calls.
          max_tokens: 512,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: text },
          ],
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      })
      if (!res.ok) return UNCERTAIN
      const body = await res.json()
      return parseDestination(body?.choices?.[0]?.message?.content)
    } catch {
      return UNCERTAIN
    }
  }
}
