import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { recordingMime, VoiceCapture, type CaptureState, type RecorderLike } from './voiceCapture'
import { transcribeAudio } from './voiceInputClient'

const messages: Record<string, string> = {
  unsupported: '這個瀏覽器暫時不能錄音。用文字跟我說也可以。',
  permission_denied: '麥克風沒有開啟。你可以改用文字，或在瀏覽器設定開啟權限。',
  permission_timeout: '還沒有取得麥克風。稍後再試，或用文字跟我說。',
  recording_failed: '這次沒有錄好。再說一次，或用文字也可以。',
  speech_unclear: '這段沒有聽清楚。再說一次，或用文字也可以。',
  audio_too_large: '這段錄音太大了。分成短句說，或用文字也可以。',
  audio_too_long: '這段錄音太長了。分成短句說，或用文字也可以。',
  invalid_audio: '這段錄音讀不到。再說一次，或用文字也可以。',
  audio_session_limit: '這趟的錄音額度用完了。接著用文字跟我說就可以。',
  transcription_limited: '現在有點忙。稍等一下再試，或用文字跟我說。',
  transcription_timeout: '這次等得有點久。再試一次，或用文字跟我說。',
  voice_step_changed: '步驟已經更新。請再說一次目前看到什麼。',
  voice_not_available_here: '請先完成畫面上的步驟，再用語音輸入。',
  transcription_failed: '這次沒有連上語音辨識。再試一次，或用文字跟我說。',
}

interface Props {
  baseUrl: string
  sessionId: string
  disabled: boolean
  control: MutableRefObject<VoiceCapture | null>
  beforeStart(): void
  onActive(active: boolean): void
  onTranscript(text: string): void
}

export function VoiceInput(props: Props) {
  const [state, setState] = useState<CaptureState>({ phase: 'idle' })
  const callbacks = useRef(props); callbacks.current = props
  const capture = useMemo(() => new VoiceCapture({
    mimeType: recordingMime(),
    getStream: () => navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false }),
    createRecorder: (stream, mimeType) => new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 64000 }) as unknown as RecorderLike,
    transcribe: (blob, signal) => transcribeAudio(props.baseUrl, props.sessionId, blob, signal),
    onState: next => {
      setState(next)
      callbacks.current.onActive(['requesting', 'recording', 'stopping', 'transcribing'].includes(next.phase))
      if (next.phase === 'review' && next.text) callbacks.current.onTranscript(next.text)
    },
  }), [props.baseUrl, props.sessionId])

  useEffect(() => {
    props.control.current = capture
    const hide = () => capture.cancel()
    const visibility = () => { if (document.visibilityState !== 'visible') hide() }
    document.addEventListener('visibilitychange', visibility); window.addEventListener('pagehide', hide)
    return () => {
      document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', hide)
      capture.dispose(); callbacks.current.onActive(false)
      if (callbacks.current.control.current === capture) callbacks.current.control.current = null
    }
  }, [capture, props.control])
  useEffect(() => { if (props.disabled) capture.cancel() }, [capture, props.disabled])

  const active = ['requesting', 'recording', 'stopping', 'transcribing'].includes(state.phase)
  const status = state.phase === 'requesting' ? '請允許使用麥克風。'
    : state.phase === 'recording' ? '正在聽，說一句就好。最長 15 秒。'
    : state.phase === 'stopping' ? '正在停止錄音。'
    : state.phase === 'transcribing' ? '錄音已停止，正在轉成文字。'
    : state.phase === 'review' ? '文字放好了。可以修改，確認後再按「傳送」。'
    : state.phase === 'error' ? messages[state.error || ''] || messages.transcription_failed : ''
  return (
    <section className="l3-voice-input" aria-label="語音輸入">
      <div className="l3-voice-input-actions">
        {state.phase === 'recording' ? (
          <button type="button" className="l3-primary" onClick={() => capture.stop()}>說完了</button>
        ) : !active ? (
          <button type="button" className="l3-secondary l3-icon-button" disabled={props.disabled} aria-describedby="l3-voice-purpose"
            onClick={() => { callbacks.current.beforeStart(); void capture.start() }}>
            <svg className="l3-btn-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4M8 22h8" />
            </svg>說一句
          </button>
        ) : null}
        {active ? <button type="button" className="l3-secondary" onClick={() => capture.cancel()}>取消錄音</button> : null}
      </div>
      <p className="l3-voice-input-status" role="status" aria-live="polite">{status}</p>
      <p className="l3-voice-purpose" id="l3-voice-purpose">先停在安全的地方。錄音會傳送給 Google Vertex AI 轉成文字，確認後再傳送。</p>
      <details className="l3-photo-details"><summary>錄音怎麼處理</summary>
        <p>Nightingale 只暫時處理錄音，不保存原始音訊。文字在你按「傳送」前，不會用來判斷路線。</p>
      </details>
    </section>
  )
}
