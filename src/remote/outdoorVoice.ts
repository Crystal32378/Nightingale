import manifest from './outdoor-manifest.json'
import englishManifest from './outdoor-manifest.en.json'
import type { RemoteAction } from './last300mClient'
import type { OutdoorLocale } from './locale'

export type OutdoorVoice = 'Leda' | 'Puck' | 'quiet'
interface Recording { file: string; sha256: string; seconds: number }
interface Utterance { text: string; voices: Record<'Leda' | 'Puck', Recording> }
export const outdoorManifest: { routeId: string; utterances: Record<string, Utterance> } = manifest
const enManifest = englishManifest as { routeId: string; utterances: Record<string, { text: string; voices: Partial<Record<'Leda' | 'Puck', Recording>> }> }

// Only action identity selects speech. Server prose is never spoken or matched.
const ACTION_KEYS: Record<string, string[]> = {
  'REANCHOR:cp1': ['cp1.guide'],
  'GUIDE:cp1': ['cp1.exit'],
  'GUIDE:cp2': ['cp2.cross'],
  'GUIDE:cp2x': ['cp2.after', 'cp2.along'],
  'GUIDE:cp3': ['cp3.cross'],
  'GUIDE:cp3x': ['cp3.after'],
  'GUIDE:cp4': ['cp4.driveway'],
  'ASK:cp4': ['ask.entrance'],
  'ASK:cp5': ['ask.entrance'],
  'REANCHOR:cp2': ['reanchor'],
  'REANCHOR:cp3': ['reanchor'],
  'REANCHOR:cp4': ['reanchor'],
  'REANCHOR:cp5': ['reanchor'],
  'CONFIRM_ARRIVAL:cp5': ['arrived'],
  // RECOVER:cp5 identifies three different recoveries. Keep silent until the
  // protocol supplies an unambiguous verified identity for each one.
}

export function outdoorKeysFor(routeId: string, action: RemoteAction, locale: OutdoorLocale = 'zh-TW'): string[] {
  if (locale === 'en' && action.type === 'ASK' && action.messageKey !== 'ask.entrance') return []
  if (locale === 'en' && routeId === 'renai-001' && action.type === 'RECOVER' && action.checkpointId === 'cp5') {
    const keys: Record<string, string[]> = { 'recover.er': ['recover.er'], 'recover.daan': ['recover.daan.a', 'recover.daan.b'], 'recover.canopy': ['recover.canopy'] }
    const key = action.messageKey ?? ''
    return Object.prototype.hasOwnProperty.call(keys, key) ? [...keys[key]] : []
  }
  return routeId === outdoorManifest.routeId ? [...(ACTION_KEYS[`${action.type}:${action.checkpointId}`] ?? [])] : []
}

/** A new response, mute, help, or unmount cancels the whole previous sequence. */
export class OutdoorSequence {
  private controller: AbortController | null = null
  constructor(private readonly clip: (file: string, signal: AbortSignal) => Promise<void>) {}

  stop(): void {
    this.controller?.abort()
    this.controller = null
  }

  async play(keys: string[], voice: OutdoorVoice, locale: OutdoorLocale = 'zh-TW'): Promise<void> {
    this.stop()
    if (voice === 'quiet' || keys.length === 0) return
    const utterances = (locale === 'en' ? enManifest : outdoorManifest).utterances
    const recordings = keys.map(key => Object.prototype.hasOwnProperty.call(utterances, key) ? utterances[key]?.voices[voice] : undefined)
    if (recordings.some(recording => !recording)) return
    const controller = new AbortController()
    this.controller = controller
    try {
      for (const recording of recordings) {
        if (controller.signal.aborted) return
        await this.clip(recording!.file, controller.signal)
      }
    } catch {
      // Missing, blocked, offline: retain text; no device or remote TTS fallback.
    } finally {
      if (this.controller === controller) this.controller = null
    }
  }
}

/** Unlock on a real user press; responses arriving after fetch can then play. */
export function createOutdoorPlayer() {
  let context: AudioContext | null = null
  const player = new OutdoorSequence(async (file, signal) => {
    const active = context
    if (!active || active.state !== 'running' || signal.aborted) return
    const response = await fetch(import.meta.env.BASE_URL + file, { signal })
    if (!response.ok) throw new Error('Recording unavailable')
    const buffer = await active.decodeAudioData(await response.arrayBuffer())
    if (signal.aborted || active.state !== 'running') return
    await new Promise<void>((resolve) => {
      const source = active.createBufferSource()
      source.buffer = buffer
      source.connect(active.destination)
      const finish = () => {
        source.onended = null
        signal.removeEventListener('abort', stop)
        source.disconnect()
        resolve()
      }
      const stop = () => {
        source.stop()
        finish()
      }
      source.onended = finish
      signal.addEventListener('abort', stop, { once: true })
      source.start()
    })
  })
  return {
    play: (keys: string[], voice: OutdoorVoice, locale: OutdoorLocale = 'zh-TW') => player.play(keys, voice, locale),
    stop: () => player.stop(),
    unlock: () => {
      try {
        context ??= new AudioContext()
        void context.resume().catch(() => {})
      } catch { /* Text is always available. */ }
    },
    dispose: () => {
      player.stop()
      void context?.close().catch(() => {})
      context = null
    },
  }
}
