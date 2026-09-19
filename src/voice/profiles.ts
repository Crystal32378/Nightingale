import type { ListeningContext } from './level'

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
 * On volume: generated at 2. Loudness is not a property of the sentence, so it
 * is not baked into the file — see level.ts, which decides how loud at
 * playback, where the room and the ear are.
 *
 * ## Why pitch depends on who is being spoken to
 *
 * Both pitches were generated and listened to. The reading was that the lower
 * one sounds about forty and the higher one about twenty-five, and that each
 * one is better at a different job:
 *
 *   - Guidance is spoken TO the person holding the phone, who is often elderly
 *     and already unsure. The forty-year-old reading is the one that is
 *     comfortable to be led by. It is also the voice principle already written
 *     into the string table: someone who has done this many times.
 *
 *   - The ask utterance is spoken TO A THIRD PERSON, across a counter, over a
 *     queue, to someone who owes us nothing. The twenty-five-year-old reading
 *     is the one a stranger wants to help. A small polite bird asking for
 *     directions gets answered.
 *
 * This is not two voices. Same voiceId, same speed, same words — one speaker
 * who addresses a stranger differently from the person beside them, which is
 * what people do.
 *
 * The listening contexts are not invented here. `level.ts` already splits
 * PRIVATE from PUBLIC for loudness, reasoning from distance; this arrived at
 * the same line reasoning from who wants to help. One split, two reasons.
 *
 * THE RISK, and the test for it: if the two readings differ too much it stops
 * sounding like one bird. Play `往前走。` and `請問，神經外科？` back to back.
 * If it sounds like two people, bring PUBLIC back to PRIVATE's pitch — the
 * character of one companion matters more than the extra help.
 *
 * CAUTION: these numbers were read off the web UI. It is not documented how
 * many semitones one pitch step is, so the difference above is described by
 * ear, not by measurement.
 */
export type VoiceGender = 'FEMALE' | 'MALE'

/** The model that actually produced the approved audio, read off the filenames. */
export const VOICE_MODEL = 'speech-2.8-hd'

export interface VoiceProfile {
  /** stable key used in paths and manifest filenames */
  id: VoiceGender
  /** MiniMax voice id */
  voiceId: string
  speed: number
  /** one per listening context — see the note above */
  pitch: Record<ListeningContext, number>
  vol: number
  /** what this voice was picked for */
  note: string
}

const PITCH: Record<ListeningContext, number> = {
  /** steady, comfortable to be led by */
  PRIVATE: 0,
  /** younger, polite, easy to want to help */
  PUBLIC: 1,
}

export const VOICE_PROFILES: Record<VoiceGender, VoiceProfile> = {
  FEMALE: {
    id: 'FEMALE',
    voiceId: 'Chinese_crisp_podcaster_nv1',
    speed: 1,
    pitch: { ...PITCH },
    vol: 2,
    note: '咬字清楚，不拖。門診大廳有底噪時仍聽得清。',
  },
  MALE: {
    id: 'MALE',
    voiceId: 'Chinese_calm_streamer_nv1',
    speed: 0.9,
    pitch: { ...PITCH },
    vol: 2,
    note: '平穩，語速略慢。給聽女聲較吃力的人。',
  },
}

export const VOICE_GENDERS: VoiceGender[] = ['FEMALE', 'MALE']

export function profileFor(gender: string): VoiceProfile | null {
  return VOICE_PROFILES[gender as VoiceGender] ?? null
}

/** The pitch this profile speaks at when addressing this listener. */
export function pitchFor(profile: VoiceProfile, context: ListeningContext): number {
  return profile.pitch[context]
}

/** Where a profile's audio lives, relative to the public root. */
export function audioDirFor(gender: VoiceGender): string {
  return `audio/zh-TW/${gender.toLowerCase()}`
}

/** Where a profile's manifest lives, relative to the repo root. */
export function manifestPathFor(gender: VoiceGender): string {
  return `src/voice/manifest.zh-TW.${gender.toLowerCase()}.json`
}
