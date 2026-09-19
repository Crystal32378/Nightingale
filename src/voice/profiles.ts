/**
 * The chosen voices.
 *
 * Two, deliberately: people differ in which voice they hear clearly, and in a
 * hospital that is not a decoration. Same words, same timing, same register —
 * only the speaker changes.
 *
 * The settings below were chosen BY EAR in the MiniMax web interface, which is
 * the only way this decision can be made. They are recorded here so the next
 * generation sounds like the thing that was actually approved, rather than
 * whatever the API defaults happen to be.
 *
 * CAUTION: these numbers were read off the web UI. The web UI and the API do
 * not necessarily use the same scale or the same default for pitch and volume.
 * The first generated batch must be listened to against the web preview before
 * it is accepted; if it differs, adjust here, not in the caller.
 *
 * On volume: raised from 2 to 3 for an outpatient hall, where nobody is wearing
 * headphones. This is PROVISIONAL and has a real failure mode — pushing gain at
 * synthesis time can clip, and a clipped sentence is harder to understand in
 * noise, not easier. Listen for distortion on the first batch, especially on
 * `請問，神經外科？`, which is the loudest thing this product ever says. If it
 * breaks up, come back to 2 and make it louder at playback instead.
 *
 * Worth noting for later: the ask utterance is spoken TO A THIRD PERSON and has
 * to carry across a counter, while the guidance lines are spoken to the person
 * holding the phone. Those are different jobs and may deserve different levels.
 * Not split yet — one level, listened to first.
 */
export type VoiceGender = 'FEMALE' | 'MALE'

export interface VoiceProfile {
  /** stable key used in paths and manifest filenames */
  id: VoiceGender
  /** MiniMax voice id */
  voiceId: string
  speed: number
  pitch: number
  vol: number
  /** what this voice was picked for */
  note: string
}

export const VOICE_PROFILES: Record<VoiceGender, VoiceProfile> = {
  FEMALE: {
    id: 'FEMALE',
    voiceId: 'Chinese_crisp_podcaster_nv1',
    speed: 1,
    pitch: 1,
    vol: 2,
    note: '咬字清楚，不拖。門診大廳有底噪時仍聽得清。',
  },
  MALE: {
    id: 'MALE',
    voiceId: 'Chinese_calm_streamer_nv1',
    speed: 0.9,
    pitch: 1,
    vol: 2,
    note: '平穩，語速略慢。給聽女聲較吃力的人。',
  },
}

export const VOICE_GENDERS: VoiceGender[] = ['FEMALE', 'MALE']

export function profileFor(gender: string): VoiceProfile | null {
  return VOICE_PROFILES[gender as VoiceGender] ?? null
}

/** Where a profile's audio lives, relative to the public root. */
export function audioDirFor(gender: VoiceGender): string {
  return `audio/zh-TW/${gender.toLowerCase()}`
}

/** Where a profile's manifest lives, relative to the repo root. */
export function manifestPathFor(gender: VoiceGender): string {
  return `src/voice/manifest.zh-TW.${gender.toLowerCase()}.json`
}
