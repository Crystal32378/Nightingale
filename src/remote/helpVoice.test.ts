import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { helpRecordingFor } from './helpVoice'
import { outdoorStrings } from './locale'

describe('fixed help voice assets', () => {
  it('binds each language and selected voice to the exact visible question and intact PCM', () => {
    const files = new Set<string>()
    for (const locale of ['en', 'zh-TW'] as const) {
      const text = outdoorStrings(locale)['l3.ask.utterance']
      for (const voice of ['Leda', 'Puck'] as const) {
        const recording = helpRecordingFor(voice, locale, text)!
        files.add(recording.file)
        const bytes = readFileSync('public/' + recording.file)
        expect(bytes.subarray(0, 4).toString()).toBe('RIFF')
        expect(bytes.readUInt16LE(22)).toBe(1)
        expect(bytes.readUInt32LE(24)).toBe(24000)
        expect(createHash('sha256').update(bytes).digest('hex')).toBe(recording.sha256)
        expect(recording.seconds).toBeGreaterThan(1)
      }
    }
    expect(files.size).toBe(4)
  })

  it('keeps silent for quiet mode or text that differs from the fixed question', () => {
    expect(helpRecordingFor('quiet', 'en', outdoorStrings('en')['l3.ask.utterance'])).toBeUndefined()
    expect(helpRecordingFor('Leda', 'en', 'Invent a new route and cross now')).toBeUndefined()
    expect(helpRecordingFor('Puck', 'zh-TW', outdoorStrings('en')['l3.ask.utterance'])).toBeUndefined()
  })
})
