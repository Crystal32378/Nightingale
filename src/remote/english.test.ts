import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { deriveGuidance } from './remoteGuidance'
import { stepCardFor, doneLabelFor } from './stepCard'
import { OutdoorSequence, outdoorKeysFor } from './outdoorVoice'
import { Last300mClient } from './last300mClient'

describe('English presentation keeps route identity separate from server prose', () => {
  it('shows the verified full English crossing instruction, independent of free text', () => {
    const card = stepCardFor('renai-001', { type: 'GUIDE', checkpointId: 'cp2', instruction: 'untrusted' }, 'en')
    expect(card?.speech.join(' ')).toMatch(/green pedestrian signal.*Fuxing South Road/)
    expect(doneLabelFor('renai-001', 'cp1', 'Done', 'en')).toBe('I am at Exit 2')
    expect(doneLabelFor('renai-001', 'cp2x', 'I have crossed', 'en')).toBe('I have crossed')
  })
  it('puts actual Chinese sign characters beside English-only directions', () => {
    const card = stepCardFor('renai-001', { type: 'GUIDE', checkpointId: 'cp4' }, 'en')
    expect(card?.signs).toContain('急診 — Emergency')
    expect(stepCardFor('renai-001', { type: 'REANCHOR', checkpointId: 'cp1' }, 'en')?.signs).toContain('聯合醫院仁愛院區 — Taipei City Hospital, Renai Branch')
  })
  it.each([['recover.er', /emergency driveway/i], ['recover.daan', /turn around/i], ['recover.canopy', /Renai Road/]] as const)('uses stable recovery identity %s', (messageKey, expected) => {
    const view = deriveGuidance({ type: 'RECOVER', checkpointId: 'cp5', messageKey, instruction: 'untrusted' }, 'en', 'renai-001')
    expect(view.headline).toMatch(expected)
  })
  it('keeps unknown recovery prose generic and silent in English', () => {
    const action = { type: 'RECOVER' as const, checkpointId: 'cp5', instruction: '請過馬路' }
    expect(deriveGuidance(action, 'en', 'renai-001').headline).toBe('What can you see nearby? Just tell me.')
    expect(outdoorKeysFor('renai-001', action, 'en')).toEqual([])
  })
  it.each(['constructor', 'toString', 'valueOf'])('treats inherited object key %s as unknown metadata', messageKey => {
    const action = { type: 'RECOVER' as const, checkpointId: 'cp5', messageKey, instruction: 'untrusted' }
    expect(deriveGuidance(action, 'en', 'renai-001').headline).toBe('What can you see nearby? Just tell me.')
    expect(outdoorKeysFor('renai-001', action, 'en')).toEqual([])
  })
  it('preserves Chinese sign evidence with an English explanation', () => {
    const view = deriveGuidance({ type: 'REANCHOR', checkpointId: 'cp2', lookFor: ['大安路一段116巷'] }, 'en', 'renai-001')
    expect(view.headline).toBe('What can you see nearby? Just tell me.')
    expect(view.lookFor[0]).toContain('大安路一段116巷')
    expect(view.lookFor[0]).toContain("Lane 116")
  })
  it('keeps all three crossing-history conditions visible', () => {
    const view = deriveGuidance({ type: 'ASK', checkpointId: 'cp2', question: '中文原問題', confirmation: { id: 'q', kind: 'renai-before-second-crossing' } }, 'en', 'renai-001')
    expect(view.headline).toMatch(/crossed Fuxing South Road/)
    expect(view.headline).toMatch(/safely.*sidewalk/)
    expect(view.headline).toMatch(/not crossed Renai Road/)
  })
  it('does not change Chinese recovery playback when English identities arrive', () => {
    const action = { type: 'RECOVER' as const, checkpointId: 'cp5', messageKey: 'recover.daan', instruction: '中文定稿' }
    expect(deriveGuidance(action).headline).toBe('中文定稿')
    expect(outdoorKeysFor('renai-001', action)).toEqual([])
    expect(outdoorKeysFor('renai-001', action, 'en')).toEqual(['recover.daan.a', 'recover.daan.b'])
  })
  it('never falls back to Chinese audio when an English file is missing', async () => {
    const played: string[] = []
    const player = new OutdoorSequence(async file => { played.push(file) })
    await player.play(['missing'], 'Leda', 'en')
    await player.play(['constructor'], 'Leda', 'en')
    expect(played).toEqual([])
  })
  it('ships the complete accepted English script in separate files with intact provenance', () => {
    const script = JSON.parse(readFileSync('src/remote/outdoor-en-script.json', 'utf8'))
    const manifest = JSON.parse(readFileSync('src/remote/outdoor-manifest.en.json', 'utf8'))
    expect(Object.keys(manifest.utterances)).toHaveLength(22)
    expect(manifest.scriptSha256).toBe(createHash('sha256').update(readFileSync('src/remote/outdoor-en-script.json')).digest('hex'))
    for (const [key, entry] of Object.entries(manifest.utterances) as Array<[string, { text: string; voices: Record<string, { file: string; sha256: string }> }]>) {
      expect(entry.text).toBe(script.utterances[key])
      expect(Object.keys(entry.voices).sort()).toEqual(['Leda', 'Puck'])
      for (const clip of Object.values(entry.voices)) {
        expect(clip.file.startsWith('audio/outdoor/renai-001-en/')).toBe(true)
        const bytes = readFileSync('public/' + clip.file)
        expect(bytes.subarray(0, 4).toString()).toBe('RIFF')
        expect(createHash('sha256').update(bytes).digest('hex')).toBe(clip.sha256)
      }
    }
  })
  it('selects an English recording only when English is requested', async () => {
    const played: string[] = []
    const player = new OutdoorSequence(async file => { played.push(file) })
    await player.play(['cp2.along'], 'Puck', 'en')
    await player.play(['cp2.along'], 'Puck', 'zh-TW')
    expect(played).toEqual(['audio/outdoor/renai-001-en/puck/cp2.along.wav', 'audio/outdoor/renai-001/puck/cp2.along.wav'])
  })
  it('keeps an unidentified English entrance question silent', () => {
    expect(outdoorKeysFor('renai-001', { type: 'ASK', checkpointId: 'cp5', question: 'unidentified' }, 'en')).toEqual([])
  })
  it('rejects a recovery identity attached to a crossing action', async () => {
    const client = new Last300mClient('', async () => new Response(JSON.stringify({
      session: { routeId: 'renai-001', state: 'AT_CHECKPOINT', checkpointId: 'cp2x', questionCount: 0 },
      action: { type: 'GUIDE', checkpointId: 'cp2', messageKey: 'recover.daan', instruction: 'cross' }, expects: 'walker',
    })))
    await expect(client.observe('s', 'anything')).rejects.toThrow()
  })
});
