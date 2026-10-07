import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { lintStringTable } from '../lint/register'
import { outdoorKeysFor, OutdoorSequence, outdoorManifest } from './outdoorVoice'

describe('verified outdoor recordings', () => {
  it('selects the crossing, then after + along only once the walker confirms done', () => {
    expect(outdoorKeysFor('renai-001', { type: 'GUIDE', checkpointId: 'cp2' })).toEqual(['cp2.cross'])
    expect(outdoorKeysFor('renai-001', { type: 'GUIDE', checkpointId: 'cp2x' })).toEqual(['cp2.after', 'cp2.along'])
    expect(outdoorKeysFor('renai-001', { type: 'GUIDE', checkpointId: 'cp3' })).toEqual(['cp3.cross'])
    expect(outdoorKeysFor('renai-001', { type: 'GUIDE', checkpointId: 'cp3x' })).toEqual(['cp3.after'])
  })

  it('never chooses audio from server prose or ambiguous recovery identities', () => {
    expect(outdoorKeysFor('renai-001', { type: 'GUIDE', checkpointId: 'cp2x', instruction: '請跑過馬路' })).toEqual(['cp2.after', 'cp2.along'])
    expect(outdoorKeysFor('renai-001', { type: 'RECOVER', checkpointId: 'cp5', instruction: '那是急診的車道口。大廳入口還在前面一點。' })).toEqual([])
    expect(outdoorKeysFor('unknown', { type: 'GUIDE', checkpointId: 'cp2' })).toEqual([])
    expect(outdoorKeysFor('renai-001', { type: 'GUIDE', checkpointId: 'missing' })).toEqual([])
  })

  it('ships both voices for every approved line, with matching source text and intact bytes', () => {
    const script = readFileSync('docs/tts-outdoor-script.md', 'utf8')
    const rows = script.split('\n').map(line => line.split('|').map(c => c.trim()))
      .filter(c => c.length === 6 && /^[a-z]+[\d.]|^ask\.|^recover\.|^arrived$|^reanchor$|^photo\./.test(c[1]))
    expect(rows).toHaveLength(22)
    expect(Object.keys(outdoorManifest.utterances)).toHaveLength(22)
    for (const row of rows) {
      const item = outdoorManifest.utterances[row[1]]
      expect(item.text).toBe(row[3])
      expect(lintStringTable({ [row[1]]: item.text })).toEqual([])
      for (const voice of ['Leda', 'Puck'] as const) {
        const file = readFileSync('public/' + item.voices[voice].file)
        expect(file.subarray(0, 4).toString()).toBe('RIFF')
        expect(file.length).toBeGreaterThan(24000)
        expect(createHash('sha256').update(file).digest('hex')).toBe(item.voices[voice].sha256)
      }
    }
    for (const retired of ['cp2.turn', 'cp2.straight', 'cp2.store', 'cp3.turn']) {
      expect(outdoorManifest.utterances[retired]).toBeUndefined()
    }
  })
})

describe('outdoor playback cancellation', () => {
  it('finishes the turn instruction before speaking along', async () => {
    const played: string[] = []
    let finish!: () => void
    const player = new OutdoorSequence((file) => {
      played.push(file)
      return new Promise<void>(resolve => { finish = resolve })
    })
    const pending = player.play(['cp2.after', 'cp2.along'], 'Leda')
    expect(played).toHaveLength(1)
    expect(played[0]).toContain('cp2.after')
    finish()
    await Promise.resolve()
    expect(played).toHaveLength(2)
    expect(played[1]).toContain('cp2.along')
    finish()
    await pending
  })

  it('cancels queued along when muted, changing step, or opening help', async () => {
    const played: string[] = []
    let finish!: () => void
    let signal!: AbortSignal
    const player = new OutdoorSequence((file, abort) => {
      played.push(file); signal = abort
      return new Promise<void>(resolve => { finish = resolve })
    })
    const pending = player.play(['cp2.after', 'cp2.along'], 'Puck')
    player.stop()
    expect(signal.aborted).toBe(true)
    finish()
    await pending
    expect(played).toHaveLength(1)
  })

  it('stays silent for missing keys, muted mode, or a failed audio download', async () => {
    const played: string[] = []
    const player = new OutdoorSequence(async file => { played.push(file); throw new Error('404') })
    await player.play(['cp2.after', 'unknown'], 'Leda')
    await player.play(['cp2.after'], 'quiet')
    expect(played).toEqual([])
    await player.play(['cp2.after', 'cp2.along'], 'Puck')
    expect(played).toHaveLength(1)
  })
})
