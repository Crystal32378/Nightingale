import type { RemoteAction } from './last300mClient'
import type { OutdoorLocale } from './locale'
import englishScript from './outdoor-en-script.json'

/**
 * What the screen shows for one step: a verified short label (≤ 4–5 字) and a
 * landmark icon. The full sentence is for the ear; the eye gets the label.
 * Keyed by route + the checkpoint the action refers to + action type, the same
 * key the recorded-voice manifest uses, so the label and the recording can
 * never describe two different steps. No entry → the page falls back to the
 * server's bounded text.
 */

export type StepIcon = 'exit' | 'crossing' | 'walk' | 'hospital'

export interface StepCard {
  label: string
  icon: StepIcon
  /**
   * The step's full verified wording, in the recorded-voice order. Read out by
   * screen readers and behind 全文 on screen, so the short label never stands
   * alone while the recordings are not yet wired.
   */
  speech: string[]
  signs?: string[]
}

const RENAI: Record<string, StepCard> = {
  'REANCHOR:cp1': { label: '到出口2', icon: 'exit', speech: ['搭1號電梯到一樓。出電梯，就是出口2。'] },
  'GUIDE:cp1': { label: '出站右轉', icon: 'exit', speech: ['出口2出來，往右轉。'] },
  'GUIDE:cp2': { label: '過復興南路', icon: 'crossing', speech: ['等綠燈，過復興南路。'] },
  'GUIDE:cp2x': { label: '右轉直走', icon: 'walk', speech: ['過完馬路，往右轉。', '沿復興南路直走。'] },
  'GUIDE:cp3': { label: '過仁愛路', icon: 'crossing', speech: ['等綠燈，過仁愛路。'] },
  'GUIDE:cp3x': { label: '左轉找入口', icon: 'hospital', speech: ['過完左轉，醫院在這一側。'] },
  'GUIDE:cp4': { label: '大廳在前', icon: 'hospital', speech: ['大廳入口還在前面一點。'] },
  'CONFIRM_ARRIVAL:cp5': { label: '到了', icon: 'hospital', speech: ['醫院入口，到了。'] },
}

/** What the one button says while a step waits for the walker. */
const RENAI_DONE: Record<string, string> = { cp1: '我到出口2了' }

const EN = englishScript.utterances
const RENAI_EN: Record<string, StepCard> = {
  'REANCHOR:cp1': { label: 'Find Exit 2', icon: 'exit', speech: [EN['cp1.guide']], signs: ['聯合醫院仁愛院區 — Taipei City Hospital, Renai Branch'] },
  'GUIDE:cp1': { label: 'Turn right outside', icon: 'exit', speech: [EN['cp1.exit']] },
  'GUIDE:cp2': { label: 'Cross Fuxing South Road', icon: 'crossing', speech: [EN['cp2.cross']], signs: ['復興南路 — Fuxing South Road'] },
  'GUIDE:cp2x': { label: 'Right, then straight', icon: 'walk', speech: [EN['cp2.after'], EN['cp2.along']], signs: ['復興南路 — Fuxing South Road'] },
  'GUIDE:cp3': { label: 'Cross Renai Road', icon: 'crossing', speech: [EN['cp3.cross']], signs: ['仁愛路 — Renai Road'] },
  'GUIDE:cp3x': { label: 'Left toward the entrance', icon: 'hospital', speech: [EN['cp3.after']] },
  'GUIDE:cp4': { label: 'Lobby farther ahead', icon: 'hospital', speech: [EN['cp4.driveway']], signs: ['急診 — Emergency'] },
  'CONFIRM_ARRIVAL:cp5': { label: 'At the entrance', icon: 'hospital', speech: [EN.arrived] },
}

export const STEP_CARDS: Record<string, Record<string, StepCard>> = { 'renai-001': RENAI }

export const DONE_LABELS: Record<string, Record<string, string>> = { 'renai-001': RENAI_DONE }

export function doneLabelFor(routeId: string, checkpointId: string | undefined, fallback: string, locale: OutdoorLocale = 'zh-TW'): string {
  if (locale === 'en') return routeId === 'renai-001' && checkpointId === 'cp1' ? 'I am at Exit 2' : fallback
  return (checkpointId && DONE_LABELS[routeId]?.[checkpointId]) || fallback
}

export function stepCardFor(routeId: string, action: RemoteAction, locale: OutdoorLocale = 'zh-TW'): StepCard | null {
  if (locale === 'en') return routeId === 'renai-001' ? RENAI_EN[`${action.type}:${action.checkpointId}`] ?? null : null
  return STEP_CARDS[routeId]?.[`${action.type}:${action.checkpointId}`] ?? null
}
