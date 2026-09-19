import { describe, expect, it } from 'vitest'
import { audioDirFor, manifestPathFor, profileFor, VOICE_GENDERS, VOICE_PROFILES } from './profiles'

describe('the chosen voices', () => {
  it('is two, one of each, so people can hear whichever suits them', () => {
    expect(VOICE_GENDERS).toEqual(['FEMALE', 'MALE'])
    expect(Object.keys(VOICE_PROFILES)).toHaveLength(2)
  })

  it('records the settings that were approved by ear, not API defaults', () => {
    for (const gender of VOICE_GENDERS) {
      const profile = VOICE_PROFILES[gender]
      expect(profile.voiceId.length).toBeGreaterThan(0)
      expect(profile.speed).toBeGreaterThan(0)
      expect(profile.note.length).toBeGreaterThan(0)
    }
  })

  it('keeps the two voices in separate folders and manifests, so they cannot mix', () => {
    expect(audioDirFor('FEMALE')).toBe('audio/zh-TW/female')
    expect(audioDirFor('MALE')).toBe('audio/zh-TW/male')
    expect(manifestPathFor('FEMALE')).not.toBe(manifestPathFor('MALE'))
  })

  it('uses a different voice id for each', () => {
    expect(VOICE_PROFILES.FEMALE.voiceId).not.toBe(VOICE_PROFILES.MALE.voiceId)
  })

  it('refuses an unknown profile rather than guessing one', () => {
    expect(profileFor('NEITHER')).toBeNull()
    expect(profileFor('FEMALE')?.voiceId).toBe(VOICE_PROFILES.FEMALE.voiceId)
  })
})
