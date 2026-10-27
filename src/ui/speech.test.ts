import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { PLACE_REGISTRY } from '../registry/types'
import { EN } from '../strings/en'
import { ZH_TW } from '../strings/zh-TW'
import recordings from './ask-recordings.en.json'
import maleRecordings from './ask-recordings.en.male.json'

// What a person hears at the counter must be what the card shows, in either
// voice. When the English copy or a place name changes, these fail until the
// recordings are made again (npx vite-node scripts/record-indoor-en.ts .kokoro female|male).
const onCard = [
  ...Object.values(PLACE_REGISTRY).map((p) => EN['ask.utterance'].replace('{place}', String(p.names.en))),
  EN['ask.generic'],
]

describe.each([
  ['female', recordings],
  ['male', maleRecordings],
])('English help-card recordings, %s voice', (_voice, recordings) => {
  it('exist for every sentence the card can show, and for nothing else', () => {
    expect(Object.keys(recordings).sort()).toEqual([...onCard].sort())
  })

  it.each(Object.entries(recordings))('%s is the recorded file', (_text, { file, sha256 }) => {
    const bytes = readFileSync('public/' + file)
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(sha256)
    // 16-bit mono PCM: what iOS Safari plays.
    expect(bytes.toString('ascii', 0, 4)).toBe('RIFF')
    expect(bytes.readUInt16LE(20)).toBe(1)
    expect(bytes.readUInt16LE(22)).toBe(1)
    expect(bytes.readUInt16LE(34)).toBe(16)
  })
})

// Choosing Male must change what is heard, not replay the female files.
it.each(onCard)('%s has a male recording of its own', (text) => {
  const female = recordings[text as keyof typeof recordings]
  const male = maleRecordings[text as keyof typeof maleRecordings]
  expect(male.file).not.toBe(female.file)
  expect(male.sha256).not.toBe(female.sha256)
  expect(male.voice).not.toBe(female.voice)
})

// The Chinese card speaks MiniMax recordings (src/voice/manifest.zh-TW.*.json);
// a sentence without one, like a clinic name, is said by the device voice.
const onCardZh = [
  ...Object.values(PLACE_REGISTRY).map((p) => ZH_TW['ask.utterance'].replace('{place}', p.names['zh-TW'])),
  ZH_TW['ask.generic'],
]

describe.each(['female', 'male'])('Chinese help-card recordings, %s voice', (voice) => {
  const manifest = JSON.parse(readFileSync(`src/voice/manifest.zh-TW.${voice}.json`, 'utf8'))
  const asks = Object.entries(manifest.utterances as Record<string, { text: string; file: string; sha256: string }>)
    .filter(([key]) => key.startsWith('ask.'))
    .map(([, utterance]) => utterance)

  it('exist for every sentence the card can show', () => {
    expect(asks.map((a) => a.text).sort()).toEqual([...onCardZh].sort())
  })

  it.each(asks.map((a) => [a.text, a] as const))('%s is the recorded file', (_text, { file, sha256 }) => {
    expect(file.startsWith(`audio/zh-TW/${voice}/`)).toBe(true)
    const bytes = readFileSync('public/' + file)
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(sha256)
    expect(bytes.toString('ascii', 0, 3)).toBe('ID3') // MP3
  })
})
