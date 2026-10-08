import type { FetchLike } from './last300mClient'
export class VoiceInputError extends Error {
  constructor(readonly code: string) { super(code) }
}
const SAFE_ERRORS = new Set(['audio_session_limit', 'transcription_limited', 'speech_unclear', 'invalid_audio', 'audio_too_long', 'audio_too_large', 'voice_step_changed', 'voice_not_available_here', 'transcription_timeout'])

export async function transcribeAudio(base: string, id: string, blob: Blob, signal: AbortSignal, fetchImpl: FetchLike = fetch): Promise<string> {
  if (signal.aborted) throw new VoiceInputError('cancelled')
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout>
  let abort = () => {}
  const stopped = new Promise<never>((_resolve, reject) => {
    abort = () => { controller.abort(); reject(new VoiceInputError('cancelled')) }
    signal.addEventListener('abort', abort, { once: true })
    timer = setTimeout(() => { controller.abort(); reject(new VoiceInputError('transcription_timeout')) }, 30000)
  })
  try {
    const request = async () => {
      const response = await fetchImpl(`${base}/api/sessions/${encodeURIComponent(id)}/transcriptions`, {
        method: 'POST', headers: { 'Content-Type': blob.type.split(';')[0] }, body: blob, signal: controller.signal, cache: 'no-store',
      })
      const body: unknown = await response.json()
      const b = body as { text?: unknown; error?: unknown } | null
      if (!response.ok) throw new VoiceInputError(typeof b?.error === 'string' && SAFE_ERRORS.has(b.error) ? b.error : response.status === 429 ? 'transcription_limited' : 'transcription_failed')
      if (!b || typeof b.text !== 'string' || !b.text.trim() || b.text.length > 500 || /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/.test(b.text)) throw new VoiceInputError('speech_unclear')
      return b.text.trim()
    }
    return await Promise.race([request(), stopped])
  } catch (error) {
    if (error instanceof VoiceInputError) throw error
    throw new VoiceInputError('transcription_failed')
  } finally {
    clearTimeout(timer!); signal.removeEventListener('abort', abort)
  }
}
