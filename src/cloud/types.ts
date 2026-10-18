/**
 * Nightingale — cloud presentation contract.
 *
 * Geographic truth must be deterministic. Language is presentation.
 *
 * The engine hands down ONE next step and the renderer materializes it into a
 * deterministic base string. A cloud model (Gemini for the Google track,
 * Nemotron for the Nebius track) may ONLY paraphrase that base string — it may
 * never invent route truth, place names, distances, or directions.
 *
 * Anything the model returns must pass `guard.ts` before it reaches a screen.
 * Spoken output always stays on the recorded voice table unless a human
 * re-records; cloud paraphrases are screen / demo-draft only.
 *
 * This module is UI-free and DOM-free. It may import engine *types* only —
 * never engine behavior, never React, never an adapter — so engine purity
 * (`src/lint/enginePurity.test.ts`) is untouched.
 */

import type { Cue, Intent } from '../engine/types'

/** Which cloud track this presentation belongs to. Never mix them in one submission. */
export type CloudTrack = 'google' | 'nebius'

/** What the model is allowed to paraphrase. */
export interface PresentationInput {
  /** Deterministic base string from the renderer. The only source of truth. */
  baseText: string
  /** Registry key, never a display string. */
  placeId: string | null
  /** Verified display name, or null when the base text names no place. */
  placeName: string | null
  intent: Intent
  cue: Cue
  /** True while a LEFT/RIGHT instruction is still inside its TTL. */
  turnLive: boolean
  track: CloudTrack
}

export type PresentationSource = 'deterministic' | 'gemini' | 'nemotron'

export interface PresentationResult {
  text: string
  source: PresentationSource
  /** True when the model output was rejected and the base text was kept. */
  fallbackUsed: boolean
  /** Machine-readable reason, for the dev panel and submission logs. */
  reason: string | null
}

/** A cloud presenter. Implementations live in `googleGemini.ts` / `nebiusNemotron.ts`. */
export interface Presenter {
  readonly track: CloudTrack
  readonly source: Exclude<PresentationSource, 'deterministic'>
  present(input: PresentationInput): Promise<PresentationResult>
}

/** Wrap a deterministic base text without calling any model. */
export function deterministicResult(baseText: string): PresentationResult {
  return { text: baseText, source: 'deterministic', fallbackUsed: false, reason: null }
}

/** Wrap a rejection: keep the base text, say why. */
export function fallbackResult(baseText: string, reason: string): PresentationResult {
  return { text: baseText, source: 'deterministic', fallbackUsed: true, reason }
}
