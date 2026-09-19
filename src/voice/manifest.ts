import type { CanonicalUtterance } from './utterances'

/**
 * The voice manifest.
 *
 * The `text` field is not documentation — it is the comparison point. An audio
 * file is only ever played when the text recorded beside it is character-for-
 * character the text the renderer produced for that same utterance. That is
 * what stops the screen and the voice drifting apart when a sentence is edited
 * and nobody re-records it.
 */
export interface VoiceManifestEntry {
  text: string
  /** path under the public audio root, e.g. audio/zh-TW/guidance.turn.right.mp3 */
  file: string
  sha256: string
  bytes: number
  durationMs: number
}

export interface VoiceManifest {
  locale: 'zh-TW'
  /** which chosen voice this is — FEMALE or MALE */
  profile: string
  voiceId: string
  model: string
  /** the settings that were approved by ear; recorded so a re-run sounds the same */
  voiceSettings: { speed: number; pitch: number; vol: number }
  generatedAt: string
  utterances: Record<string, VoiceManifestEntry>
}

export type ManifestProblem =
  | { kind: 'MISSING'; id: string; expected: string }
  | { kind: 'TEXT_MISMATCH'; id: string; expected: string; found: string }
  | { kind: 'ORPHAN'; id: string }

/**
 * Compare a manifest against the derived canonical utterances.
 *
 * MISSING is not fatal at runtime — a missing file falls back to device TTS
 * reading the same verified string. TEXT_MISMATCH is fatal: it means the
 * recording says something the product no longer says.
 */
export function checkManifest(manifest: VoiceManifest, utterances: CanonicalUtterance[]): ManifestProblem[] {
  const problems: ManifestProblem[] = []
  const expected = new Map(utterances.map((u) => [u.id, u.text]))

  for (const [id, text] of expected) {
    const entry = manifest.utterances[id]
    if (!entry) {
      problems.push({ kind: 'MISSING', id, expected: text })
      continue
    }
    if (entry.text !== text) {
      problems.push({ kind: 'TEXT_MISMATCH', id, expected: text, found: entry.text })
    }
  }

  for (const id of Object.keys(manifest.utterances)) {
    if (!expected.has(id)) problems.push({ kind: 'ORPHAN', id })
  }

  return problems
}

export function isPlayable(manifest: VoiceManifest, id: string, verifiedText: string): boolean {
  const entry = manifest.utterances[id]
  return entry !== undefined && entry.text === verifiedText
}
