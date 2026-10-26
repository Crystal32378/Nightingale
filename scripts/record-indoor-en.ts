/**
 * Record the nine English help-card sentences with Kokoro-82M (Apache-2.0),
 * locally: no account, no key, no text leaves this machine.
 *
 * The sentences are derived from the string table and the place registry, never
 * typed here, so a recording can only exist for a sentence the screen shows.
 * kokoro-js is not a project dependency. Install it in a short folder: the
 * model is cached inside its node_modules, and onnxruntime on Windows cannot
 * open paths over 260 characters.
 *
 *   npm i --prefix .kokoro kokoro-js
 *   npx vite-node scripts/record-indoor-en.ts .kokoro
 */
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { EN } from '../src/strings/en'
import { PLACE_REGISTRY } from '../src/registry/types'

const VOICE = 'af_heart'
const OUT_DIR = 'public/audio/indoor/en'
const MANIFEST = 'src/ui/ask-recordings.en.json'

const kokoroDir = resolve(process.argv[2] ?? '')
const fromKokoro = createRequire(join(kokoroDir, 'package.json'))
const { KokoroTTS } = await import(pathToFileURL(fromKokoro.resolve('kokoro-js')).href)

const sentences: Array<[string, string]> = [
  ...Object.values(PLACE_REGISTRY).map((p): [string, string] => [p.id.toLowerCase(), EN['ask.utterance'].replace('{place}', String(p.names.en))]),
  ['generic', EN['ask.generic']],
]

/** 16-bit mono PCM, the same format as the outdoor recordings; iOS Safari plays it. */
function wav(samples: Float32Array, rate: number): Buffer {
  const data = Buffer.alloc(samples.length * 2)
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), i * 2))
  const head = Buffer.alloc(44)
  head.write('RIFF', 0); head.writeUInt32LE(36 + data.length, 4); head.write('WAVE', 8)
  head.write('fmt ', 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22)
  head.writeUInt32LE(rate, 24); head.writeUInt32LE(rate * 2, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34)
  head.write('data', 36); head.writeUInt32LE(data.length, 40)
  return Buffer.concat([head, data])
}

const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'cpu' })
mkdirSync(OUT_DIR, { recursive: true })
const manifest: Record<string, { file: string; sha256: string; voice: string }> = {}
for (const [stem, text] of sentences) {
  const audio = await tts.generate(text, { voice: VOICE })
  const peak = audio.audio.reduce((m: number, s: number) => Math.max(m, Math.abs(s)), 0)
  // Kokoro's float output can overshoot full scale; scale the whole clip down rather than clip it.
  const samples = peak > 0.95 ? audio.audio.map((s: number) => (s * 0.95) / peak) : audio.audio
  const bytes = wav(samples, audio.sampling_rate)
  const file = `audio/indoor/en/ask-${stem}.wav`
  writeFileSync(join('public', file), bytes)
  manifest[text] = { file, sha256: createHash('sha256').update(bytes).digest('hex'), voice: `Kokoro-82M ${VOICE}` }
  console.log(file, (audio.audio.length / audio.sampling_rate).toFixed(2) + 's', 'peak', peak.toFixed(2), text)
}
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n')
