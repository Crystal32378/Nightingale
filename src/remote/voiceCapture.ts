export interface CaptureState {
  phase: 'idle' | 'requesting' | 'recording' | 'stopping' | 'transcribing' | 'review' | 'error'
  text?: string
  error?: string
}
export interface RecorderLike {
  state: string; mimeType: string;
  start(): void; stop(): void;
  ondataavailable: ((e: { data: Blob }) => void) | null;
  onstop: (() => void) | null; onerror: (() => void) | null;
}
export interface CaptureDeps {
  mimeType: string | null;
  getStream(): Promise<MediaStream>;
  createRecorder(stream: MediaStream, mimeType: string): RecorderLike;
  transcribe(blob: Blob, signal: AbortSignal): Promise<string>;
  onState(state: CaptureState): void;
}
export class VoiceCapture {
  private generation = 0
  private phase: CaptureState['phase'] = 'idle'
  private stream: MediaStream | null = null
  private recorder: RecorderLike | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private request: AbortController | null = null
  private chunks: Blob[] = []
  private size = 0
  constructor(private deps: CaptureDeps) {}

  get active() { return ['requesting', 'recording', 'stopping', 'transcribing'].includes(this.phase) }
  private publish(state: CaptureState) { this.phase = state.phase; this.deps.onState(state) }
  private clearTimer() { if (this.timer) clearTimeout(this.timer); this.timer = null }
  private releaseStream() { this.stream?.getTracks().forEach(track => track.stop()); this.stream = null }
  private cleanup() {
    this.generation++
    this.clearTimer(); this.request?.abort(); this.request = null
    if (this.recorder) {
      this.recorder.ondataavailable = null; this.recorder.onstop = null; this.recorder.onerror = null
      try { if (this.recorder.state !== 'inactive') this.recorder.stop() } catch { /* tracks still released */ }
      this.recorder = null
    }
    this.releaseStream(); this.chunks = []; this.size = 0
  }
  private fail(error: string) { this.cleanup(); this.publish({ phase: 'error', error }) }

  async start() {
    if (this.active) return
    this.cleanup()
    if (!this.deps.mimeType) { this.fail('unsupported'); return }
    const generation = this.generation
    this.publish({ phase: 'requesting' })
    this.timer = setTimeout(() => this.fail('permission_timeout'), 12000)
    try {
      const stream = await this.deps.getStream()
      if (generation !== this.generation) { stream.getTracks().forEach(track => track.stop()); return }
      this.clearTimer(); this.stream = stream
      const recorder = this.deps.createRecorder(stream, this.deps.mimeType)
      this.recorder = recorder
      recorder.ondataavailable = event => {
        if (generation !== this.generation || !event.data.size) return
        this.size += event.data.size
        if (this.size > 2 * 1024 * 1024) { this.fail('audio_too_large'); return }
        this.chunks.push(event.data)
      }
      recorder.onerror = () => { if (generation === this.generation) this.fail('recording_failed') }
      recorder.onstop = () => { if (generation === this.generation) void this.finished(generation, recorder.mimeType) }
      recorder.start()
      this.publish({ phase: 'recording' })
      this.timer = setTimeout(() => this.stop(), 15000)
    } catch (error) {
      if (generation !== this.generation) return
      this.fail((error as { name?: string })?.name === 'NotAllowedError' ? 'permission_denied' : 'recording_failed')
    }
  }
  stop() {
    if (this.phase !== 'recording' || !this.recorder) return
    this.clearTimer(); this.publish({ phase: 'stopping' })
    this.timer = setTimeout(() => this.fail('recording_failed'), 2000)
    try { this.recorder.stop() } catch { this.fail('recording_failed') }
    this.releaseStream()
  }
  private async finished(generation: number, recorderMime: string) {
    this.clearTimer(); this.releaseStream()
    const mime = (this.chunks.find(c => c.type)?.type || recorderMime).split(';')[0].trim().toLowerCase()
    if (!['audio/mp4', 'audio/webm'].includes(mime)) { this.fail('unsupported'); return }
    if (!this.size) { this.fail('speech_unclear'); return }
    const blob = new Blob(this.chunks, { type: mime }); this.chunks = []; this.size = 0
    if (this.recorder) { this.recorder.ondataavailable = null; this.recorder.onstop = null; this.recorder.onerror = null; this.recorder = null }
    const request = new AbortController(); this.request = request
    this.publish({ phase: 'transcribing' })
    try {
      const text = await this.deps.transcribe(blob, request.signal)
      if (generation !== this.generation) return
      this.request = null
      this.publish({ phase: 'review', text })
    } catch (error) {
      if (generation !== this.generation) return
      this.fail((error as { code?: string })?.code || 'transcription_failed')
    }
  }
  cancel() { this.cleanup(); this.publish({ phase: 'idle' }) }
  dispose() { this.cleanup(); this.phase = 'idle' }
}

/** Presence alone is not proof of LINE support; actual capture follows a user press. */
export function recordingMime(): string | null {
  if (!globalThis.isSecureContext || !globalThis.navigator?.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return null
  try { return ['audio/webm;codecs=opus', 'audio/mp4'].find(mime => MediaRecorder.isTypeSupported(mime)) ?? null } catch { return null }
}
