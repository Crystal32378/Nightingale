import type { RemoteAction } from './last300mClient'

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
}

const RENAI: Record<string, StepCard> = {
  'GUIDE:cp1': { label: '出站右轉', icon: 'exit' },
  'GUIDE:cp2': { label: '過復興路', icon: 'crossing' },
  'GUIDE:cp2x': { label: '右轉直走', icon: 'walk' },
  'GUIDE:cp3': { label: '過仁愛路', icon: 'crossing' },
  'GUIDE:cp3x': { label: '左轉找入口', icon: 'hospital' },
  'GUIDE:cp4': { label: '大廳在前', icon: 'hospital' },
  'CONFIRM_ARRIVAL:cp5': { label: '到了', icon: 'hospital' },
}

export const STEP_CARDS: Record<string, Record<string, StepCard>> = { 'renai-001': RENAI }

export function stepCardFor(routeId: string, action: RemoteAction): StepCard | null {
  return STEP_CARDS[routeId]?.[`${action.type}:${action.checkpointId}`] ?? null
}
