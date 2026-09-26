import type { RemoteAction } from './last300mClient'
import { LAST300M_ZH } from './strings'

/**
 * The narrow outlet for server-authored text (福's ruling: no global
 * free-text exception). Only a validated Cloud Run action can produce a
 * GuidanceView; everything is plain text, control characters are stripped,
 * and lengths are capped. The route server owns what the words CLAIM;
 * this module only makes sure they are displayable and bounded.
 */

const LINE_MAX = 140
const LOOKFOR_ITEM_MAX = 40
const LOOKFOR_MAX_ITEMS = 5

export function sanitizeLine(raw: string, max = LINE_MAX): string {
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

export interface GuidanceView {
  kind: 'instruction' | 'question' | 'arrival'
  headline: string
  lookFor: string[]
}

export function deriveGuidance(action: RemoteAction): GuidanceView {
  switch (action.type) {
    case 'GUIDE':
    case 'RECOVER':
      return { kind: 'instruction', headline: sanitizeLine(action.instruction ?? ''), lookFor: [] }
    case 'ASK':
      return {
        kind: 'question',
        headline: sanitizeLine(action.question ?? '') || LAST300M_ZH['l3.reanchor.question'],
        lookFor: [],
      }
    case 'REANCHOR':
      return {
        kind: 'question',
        headline: LAST300M_ZH['l3.reanchor.question'],
        lookFor: (action.lookFor ?? [])
          .slice(0, LOOKFOR_MAX_ITEMS)
          .map((item) => sanitizeLine(item, LOOKFOR_ITEM_MAX))
          .filter((item) => item.length > 0),
      }
    case 'CONFIRM_ARRIVAL':
      return { kind: 'arrival', headline: LAST300M_ZH['l3.arrived.headline'], lookFor: [] }
  }
}
