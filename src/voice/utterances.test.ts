import { describe, expect, it } from 'vitest'
import { lintString } from '../lint/register'
import { renderAsk, renderGuidance } from '../render/renderer'
import { PLACE_REGISTRY } from '../registry/types'
import { ZH_TW } from '../strings/zh-TW'
import { checkManifest, isPlayable, type VoiceManifest } from './manifest'
import { canonicalUtterances, fileStemFor, SHARED_AUDIO, utteranceId } from './utterances'

const utterances = canonicalUtterances()
const now = 1_700_000_000_000

describe('the canonical utterance set is derived, not written by hand', () => {
  it('covers every verified place exactly twice, plus the four place-free lines', () => {
    const verifiedPlaces = Object.values(PLACE_REGISTRY).filter((p) => p.verified).length
    expect(utterances).toHaveLength(4 + verifiedPlaces * 2)
  })

  it('has unique ids', () => {
    const ids = utterances.map((u) => u.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('never includes a silent line — silence needs no recording', () => {
    for (const u of utterances) expect(u.text.trim().length).toBeGreaterThan(0)
    expect(utterances.map((u) => u.key)).not.toContain('guidance.wait')
  })

  it('gives every file a name a filesystem accepts', () => {
    for (const u of utterances) expect(u.fileStem).not.toContain('#')
    expect(fileStemFor('ask.utterance#NEUROSURGERY')).toBe('ask.utterance__NEUROSURGERY')
  })

  it('shares one recording between the two keys that are the same characters', () => {
    expect(ZH_TW['fallback.safe']).toBe(ZH_TW['guidance.uncertain'])
    expect(SHARED_AUDIO['fallback.safe']).toBe('guidance.uncertain')
    expect(utterances.map((u) => u.id)).not.toContain('fallback.safe')
  })
})

describe('every recordable line is exactly what the renderer says', () => {
  it('matches the renderer for a direction', () => {
    const live = renderGuidance(
      { intent: 'TURN', turn: 'RIGHT', turnExpiresAt: now + 1000, destinationId: null, disclosedSteps: 1 },
      now,
    )
    const utterance = utterances.find((u) => u.id === 'guidance.turn.right')
    expect(utterance?.text).toBe(live.screen)
  })

  it('matches the renderer for every ask utterance', () => {
    for (const u of utterances.filter((x) => x.key === 'ask.utterance')) {
      expect(u.text).toBe(renderAsk(u.placeId, now).screen)
    }
  })

  it('matches the renderer for every arrival', () => {
    for (const u of utterances.filter((x) => x.key === 'guidance.arrived')) {
      const rendered = renderGuidance(
        { intent: 'ARRIVED', turn: null, turnExpiresAt: null, destinationId: u.placeId, disclosedSteps: 1 },
        now,
      )
      expect(u.text).toBe(rendered.screen)
    }
  })

  it('passes the register lint, so a recording cannot carry wording the lint forbids', () => {
    for (const u of utterances) expect(lintString(u.id, u.text)).toEqual([])
  })
})

describe('the manifest is checked against the renderer, not trusted', () => {
  const good: VoiceManifest = {
    locale: 'zh-TW',
    profile: 'FEMALE',
    voiceId: 'test',
    model: 'test',
    voiceSettings: { speed: 1, pitch: { PRIVATE: 0, PUBLIC: 1 }, vol: 1 },
    generatedAt: '2026-09-19',
    utterances: Object.fromEntries(
      utterances.map((u) => [
        u.id,
        { text: u.text, file: `audio/zh-TW/${u.fileStem}.mp3`, sha256: 'x', bytes: 1, durationMs: 1 },
      ]),
    ),
  }

  it('passes when every line matches', () => {
    expect(checkManifest(good, utterances)).toEqual([])
  })

  it('catches a sentence that was edited without re-recording', () => {
    const stale: VoiceManifest = {
      ...good,
      utterances: {
        ...good.utterances,
        'guidance.turn.right': { ...good.utterances['guidance.turn.right'], text: '右轉。' },
      },
    }
    const problems = checkManifest(stale, utterances)
    expect(problems).toHaveLength(1)
    expect(problems[0].kind).toBe('TEXT_MISMATCH')
  })

  it('reports a missing recording without pretending it is fine', () => {
    const partial = { ...good, utterances: { ...good.utterances } }
    delete partial.utterances['ask.utterance#NEUROSURGERY']
    expect(checkManifest(partial, utterances)).toEqual([
      { kind: 'MISSING', id: 'ask.utterance#NEUROSURGERY', expected: '請問，神經外科？' },
    ])
  })

  it('reports a recording of something the product no longer says', () => {
    const orphaned: VoiceManifest = {
      ...good,
      utterances: {
        ...good.utterances,
        'guidance.arrived#GHOST_WARD': { text: '某某，到了。', file: 'x', sha256: 'x', bytes: 1, durationMs: 1 },
      },
    }
    expect(checkManifest(orphaned, utterances)).toContainEqual({ kind: 'ORPHAN', id: 'guidance.arrived#GHOST_WARD' })
  })

  it('refuses to play a file whose text does not match the verified string', () => {
    expect(isPlayable(good, 'guidance.turn.left', ZH_TW['guidance.turn.left'])).toBe(true)
    expect(isPlayable(good, 'guidance.turn.left', '左轉。')).toBe(false)
    expect(isPlayable(good, 'nope', '往前走。')).toBe(false)
  })
})

describe('utterance ids', () => {
  it('are the string key, plus the place when there is one', () => {
    expect(utteranceId('guidance.go', null)).toBe('guidance.go')
    expect(utteranceId('ask.utterance', 'PHARMACY')).toBe('ask.utterance#PHARMACY')
  })
})
