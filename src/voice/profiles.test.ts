import { describe, expect, it } from 'vitest'
import { canonicalUtterances } from './utterances'
import { audioDirFor, manifestPathFor, pitchFor, profileFor, VOICE_GENDERS, VOICE_PROFILES } from './profiles'

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

describe('one speaker, two ways of addressing someone', () => {
  it('speaks to a stranger at a different pitch than to the person holding the phone', () => {
    for (const gender of VOICE_GENDERS) {
      const profile = VOICE_PROFILES[gender]
      expect(pitchFor(profile, 'PUBLIC')).not.toBe(pitchFor(profile, 'PRIVATE'))
    }
  })

  it('is still ONE bird — the voice, the speed and the words never change with the listener', () => {
    for (const gender of VOICE_GENDERS) {
      const profile = VOICE_PROFILES[gender]
      // everything that identifies the speaker is a single value, not a per-context one
      expect(typeof profile.voiceId).toBe('string')
      expect(typeof profile.speed).toBe('number')
      expect(typeof profile.vol).toBe('number')
    }
  })

  it('keeps the difference to one step, because two voices is not the goal', () => {
    for (const gender of VOICE_GENDERS) {
      const profile = VOICE_PROFILES[gender]
      expect(Math.abs(pitchFor(profile, 'PUBLIC') - pitchFor(profile, 'PRIVATE'))).toBeLessThanOrEqual(1)
    }
  })

  it('gives the ask utterance the PUBLIC pitch and every guidance line the PRIVATE one', () => {
    const profile = VOICE_PROFILES.MALE
    for (const u of canonicalUtterances()) {
      const expected = u.key === 'ask.utterance' ? 'PUBLIC' : 'PRIVATE'
      expect(u.context).toBe(expected)
      expect(pitchFor(profile, u.context)).toBe(profile.pitch[expected])
    }
  })

  it('splits the set the way the product actually splits — help asked for, versus the way told', () => {
    const utterances = canonicalUtterances()
    const publicOnes = utterances.filter((u) => u.context === 'PUBLIC')
    const privateOnes = utterances.filter((u) => u.context === 'PRIVATE')
    expect(publicOnes.length).toBeGreaterThan(0)
    expect(privateOnes.length).toBeGreaterThan(0)
    expect(publicOnes.length + privateOnes.length).toBe(utterances.length)
    for (const u of publicOnes) expect(u.text.startsWith('請問')).toBe(true)
  })
})
