import { speechVolumeFor } from './volumeStore'
import recordings from './ask-recordings.en.json'
import maleRecordings from './ask-recordings.en.male.json'

/**
 * Speech is a playback device, not a writer. It receives the verified string
 * and says it. It may not rephrase, soften, or add a single character.
 *
 * Loudness is not the sentence's business either: it comes from the level the
 * person chose for this listening context (see volumeStore / voice/level.ts).
 *
 * English help sentences have recordings (scripts/record-indoor-en.ts), chosen
 * by the exact verified text, in the voice the person chose. A sentence without
 * its recording, or a recording that will not play, is said by the device voice
 * instead.
 */
export type RecordedVoice = 'female' | 'male'
const RECORDED: Record<RecordedVoice, Record<string, { file: string }>> = { female: recordings, male: maleRecordings }

// ponytail: not persisted, like the outdoor voice choice; localStorage like volumeStore if people ask.
let voice: RecordedVoice = 'female'

export function setVoice(next: RecordedVoice): void {
  voice = next
}

let playing: HTMLAudioElement | null = null

export function stopSpeaking(): void {
  try {
    playing?.pause()
    playing = null
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
  } catch {
    // Nothing to stop.
  }
}

export function speak(text: string, key = 'guidance.go', lang = 'zh-TW'): void {
  if (text.trim().length === 0) return
  try {
    if (typeof window === 'undefined') return
    stopSpeaking()
    const recorded = RECORDED[voice]
    const recording = lang.startsWith('en') && Object.prototype.hasOwnProperty.call(recorded, text) ? recorded[text] : undefined
    if (recording && typeof Audio !== 'undefined') {
      const audio = new Audio(import.meta.env.BASE_URL + recording.file)
      // ponytail: iOS ignores element volume (hardware buttons only); a GainNode if the levels must apply there.
      audio.volume = speechVolumeFor(key)
      playing = audio
      void Promise.resolve(audio.play()).catch(() => {
        if (playing === audio) say(text, key, lang)
      })
      return
    }
    say(text, key, lang)
  } catch {
    // A silent phone is an acceptable outcome. A wrong sentence is not.
  }
}

function say(text: string, key: string, lang: string): void {
  if (!('speechSynthesis' in window)) return
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = lang
  utterance.rate = 0.95
  utterance.volume = speechVolumeFor(key)
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
}
