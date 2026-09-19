import { speechVolumeFor } from './volumeStore'

/**
 * Speech is a playback device, not a writer. It receives the verified string
 * and says it. It may not rephrase, soften, or add a single character.
 *
 * Loudness is not the sentence's business either: it comes from the level the
 * person chose for this listening context (see volumeStore / voice/level.ts).
 */
export function speak(text: string, key = 'guidance.go'): void {
  if (text.trim().length === 0) return
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-TW'
    utterance.rate = 0.95
    utterance.volume = speechVolumeFor(key)
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  } catch {
    // A silent phone is an acceptable outcome. A wrong sentence is not.
  }
}
