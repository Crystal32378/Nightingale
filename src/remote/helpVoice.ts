import manifest from './help-voice-manifest.json'
import type { OutdoorLocale } from './locale'
import type { OutdoorVoice } from './outdoorVoice'
import { speechVolumeFor, subscribe } from '../ui/volumeStore'

/** Only the recorded, visible help sentence may select a file. */
export function helpRecordingFor(voice: OutdoorVoice, locale: OutdoorLocale, text: string) {
  const entry = manifest[locale]
  if (voice === 'quiet' || !entry || entry.text !== text) return undefined
  return entry.voices[voice]
}

/** Local fixed recordings only: no route observation, generated speech or device fallback. */
export function createHelpPlayer() {
  let context: AudioContext | null = null
  let ready: Promise<void> = Promise.resolve()
  let controller: AbortController | null = null
  let listening = false
  const stop = () => { controller?.abort(); controller = null }
  const onVisibility = () => { if (document.hidden) stop() }

  const unlock = () => {
    try {
      context ??= new AudioContext()
      ready = context.resume().catch(() => {})
      if (!listening) {
        window.addEventListener('pagehide', stop)
        document.addEventListener('visibilitychange', onVisibility)
        listening = true
      }
    } catch { /* The written question stays usable. */ }
  }

  const play = async (voice: OutdoorVoice, locale: OutdoorLocale, text: string) => {
    stop()
    const recording = helpRecordingFor(voice, locale, text)
    const active = context
    if (!recording || !active) return
    const current = new AbortController()
    controller = current
    const { signal } = current
    try {
      await ready
      if (signal.aborted || active.state !== 'running') return
      const response = await fetch(import.meta.env.BASE_URL + recording.file, { signal })
      if (!response.ok) return
      const buffer = await active.decodeAudioData(await response.arrayBuffer())
      if (signal.aborted || active.state !== 'running') return
      await new Promise<void>(resolve => {
        const source = active.createBufferSource()
        const gain = active.createGain()
        source.buffer = buffer
        // Preserve the existing four public-volume steps, all at or below unity.
        // This leaves headroom and never amplifies a recording into clipping.
        gain.gain.value = speechVolumeFor('ask.utterance')
        source.connect(gain)
        gain.connect(active.destination)
        const unsubscribe = subscribe(() => {
          gain.gain.setTargetAtTime(speechVolumeFor('ask.utterance'), active.currentTime, 0.03)
        })
        let finished = false
        const finish = () => {
          if (finished) return
          finished = true
          unsubscribe()
          source.onended = null
          signal.removeEventListener('abort', cancel)
          source.disconnect()
          gain.disconnect()
          resolve()
        }
        const cancel = () => {
          try { source.stop() } catch { /* Already ended. */ }
          finish()
        }
        source.onended = finish
        signal.addEventListener('abort', cancel, { once: true })
        try { source.start() } catch { finish() }
      })
    } catch { /* Download/decode errors retain text and stay silent. */ }
    finally { if (controller === current) controller = null }
  }

  return {
    unlock, play, stop,
    dispose: () => {
      stop()
      if (listening) {
        window.removeEventListener('pagehide', stop)
        document.removeEventListener('visibilitychange', onVisibility)
        listening = false
      }
      void context?.close().catch(() => {})
      context = null
    },
  }
}
