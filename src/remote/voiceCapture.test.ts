import { afterEach, describe, expect, it, vi } from 'vitest'
import { VoiceCapture, type CaptureState, type RecorderLike } from './voiceCapture'

function harness(options: { getStream?: () => Promise<MediaStream>; transcribe?: (blob: Blob, signal: AbortSignal) => Promise<string>; unsupported?: boolean; stopHangs?: boolean } = {}) {
  let stopped = false
  const track = { stop: () => { stopped = true } }
  const stream = { getTracks: () => [track] } as unknown as MediaStream
  const states: CaptureState[] = []; const requests: Blob[] = []
  let recorder: RecorderLike
  let permissionCalls = 0; let stoppedCalls = 0
  const capture = new VoiceCapture({
    mimeType: options.unsupported ? null : 'audio/mp4',
    getStream: options.getStream ?? (async () => { permissionCalls++; return stream }),
    createRecorder: () => {
      recorder = { state: 'inactive', mimeType: 'audio/mp4', ondataavailable: null, onstop: null, onerror: null,
        start() { this.state = 'recording' },
        stop() {
          stoppedCalls++; this.state = 'inactive'
          if (!options.stopHangs) queueMicrotask(() => {
            recorder.ondataavailable?.({ data: new Blob(['recorded audio'], { type: 'audio/mp4' }) })
            recorder.onstop?.()
          })
        },
      }
      return recorder
    },
    transcribe: async (blob, signal) => { requests.push(blob); return options.transcribe ? options.transcribe(blob, signal) : '我看到便利商店' },
    onState: s => states.push(s),
  })
  return { capture, states, requests, stream, track, stopped: () => stopped, permissionCalls: () => permissionCalls, stoppedCalls: () => stoppedCalls, recorder: () => recorder! }
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }
afterEach(() => vi.useRealTimers())

describe('short recording lifecycle', () => {
  it('does nothing before a press, stops tracks before transcription, and returns only review text', async () => {
    const h = harness({ transcribe: async () => { expect(h.stopped()).toBe(true); return '我看到便利商店' } })
    expect(h.permissionCalls()).toBe(0)
    await h.capture.start(); expect(h.states[h.states.length - 1]?.phase).toBe('recording')
    h.capture.stop(); await flush()
    expect(h.stopped()).toBe(true); expect(h.requests).toHaveLength(1)
    expect(h.states[h.states.length - 1]).toMatchObject({ phase: 'review', text: '我看到便利商店' })
    h.capture.dispose()
  })
  it('deduplicates rapid start and stop taps', async () => {
    const h = harness(); await Promise.all([h.capture.start(), h.capture.start()])
    h.capture.stop(); h.capture.stop(); await flush()
    expect(h.permissionCalls()).toBe(1); expect(h.stoppedCalls()).toBe(1); expect(h.requests).toHaveLength(1)
    h.capture.dispose()
  })
  it('cancels a late permission grant without recording or uploading', async () => {
    let grant: (s: MediaStream) => void = () => {}
    const h = harness({ getStream: () => new Promise(r => { grant = r }) })
    const start = h.capture.start(); h.capture.cancel(); grant(h.stream); await start
    expect(h.stopped()).toBe(true); expect(h.requests).toHaveLength(0); expect(h.states[h.states.length - 1]?.phase).toBe('idle')
  })
  it('permission timeout also stops a subsequently granted stream', async () => {
    vi.useFakeTimers(); let grant: (s: MediaStream) => void = () => {}
    const h = harness({ getStream: () => new Promise(r => { grant = r }) })
    const start = h.capture.start(); await vi.advanceTimersByTimeAsync(12001)
    expect(h.states[h.states.length - 1]).toMatchObject({ phase: 'error', error: 'permission_timeout' })
    grant(h.stream); await start; expect(h.stopped()).toBe(true); expect(h.requests).toHaveLength(0)
  })
  it('handles unsupported API and permission denial without capture', async () => {
    const unsupported = harness({ unsupported: true }); await unsupported.capture.start()
    expect(unsupported.permissionCalls()).toBe(0); expect(unsupported.states[unsupported.states.length - 1]?.error).toBe('unsupported')
    const denied = harness({ getStream: async () => { throw Object.assign(new Error(), { name: 'NotAllowedError' }) } })
    await denied.capture.start(); expect(denied.states[denied.states.length - 1]?.error).toBe('permission_denied')
  })
  it('stops at the short sentence limit and clears timers', async () => {
    vi.useFakeTimers(); const h = harness(); await h.capture.start()
    await vi.advanceTimersByTimeAsync(15000)
    expect(h.stopped()).toBe(true); expect(h.requests).toHaveLength(1); expect(vi.getTimerCount()).toBe(0)
  })
  it('recovers if the recorder never emits stop', async () => {
    vi.useFakeTimers(); const h = harness({ stopHangs: true }); await h.capture.start(); h.capture.stop()
    expect(h.stopped()).toBe(true); await vi.advanceTimersByTimeAsync(2001)
    expect(h.states[h.states.length - 1]?.error).toBe('recording_failed'); expect(h.requests).toHaveLength(0); expect(vi.getTimerCount()).toBe(0)
  })
  it('cancel during recording releases tracks and discards the final recorder event', async () => {
    const h = harness(); await h.capture.start(); h.capture.cancel(); await flush()
    expect(h.stopped()).toBe(true); expect(h.requests).toHaveLength(0); expect(h.states[h.states.length - 1]?.phase).toBe('idle')
  })
  it('abort plus generation token rejects late transcript callbacks', async () => {
    let finish: (s: string) => void = () => {}; let signal: AbortSignal | undefined
    const h = harness({ transcribe: (_blob, s) => { signal = s; return new Promise(r => { finish = r }) } })
    await h.capture.start(); h.capture.stop(); await flush(); h.capture.cancel()
    expect(signal?.aborted).toBe(true); finish('遲到的文字'); await flush()
    expect(h.states.some(s => s.phase === 'review')).toBe(false)
  })
  it('rejects oversize chunks and recorder errors without sending audio', async () => {
    const h = harness(); await h.capture.start()
    h.recorder().ondataavailable?.({ data: new Blob([new Uint8Array(2 * 1024 * 1024 + 1)]) })
    expect(h.states[h.states.length - 1]?.error).toBe('audio_too_large'); expect(h.stopped()).toBe(true); expect(h.requests).toHaveLength(0)
    await h.capture.start(); h.recorder().onerror?.(); expect(h.states[h.states.length - 1]?.error).toBe('recording_failed')
    expect(h.stopped()).toBe(true)
  })
})
