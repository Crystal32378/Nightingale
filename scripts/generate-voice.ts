/**
 * Generate Nightingale's canonical audio with MiniMax T2A.
 *
 *   npm run voice:plan                      # print what would be generated, call nothing
 *   npm run voice:casting -- --voice=<id>   # 8 casting lines, for choosing a voice
 *   npm run voice:canonical -- --voice=<id> # the full canonical set + manifest
 *
 * The canonical set is DERIVED from the string table and the verified place
 * registry — this script never contains a sentence of its own. If a line is
 * edited, the next run regenerates it and the manifest test stops failing.
 *
 * Credentials come from .env (MINIMAX_API_KEY), which is gitignored. Nothing
 * here writes a key anywhere.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { canonicalUtterances, fileStemFor } from '../src/voice/utterances'
import type { VoiceManifest, VoiceManifestEntry } from '../src/voice/manifest'

const API_URL = 'https://api.minimax.io/v1/t2a_v2'
const DEFAULT_MODEL = 'speech-2.6-hd'
const AUDIO_ROOT = join('public', 'audio', 'zh-TW')
const MANIFEST_PATH = join('src', 'voice', 'manifest.zh-TW.json')

/**
 * Casting lines. Two of these are NOT product strings — they exist only to hear
 * a voice handle that register, and they must never be shipped.
 */
const CASTING_LINES: Array<{ id: string; text: string; listenFor: string; shipping: boolean }> = [
  { id: 'cast.right', text: '往右手邊走。', listenFor: '方向、短指令', shipping: true },
  { id: 'cast.left', text: '往左手邊走。', listenFor: '與上一句尾音必須一致', shipping: true },
  { id: 'cast.go', text: '往前走。', listenFor: '最短句，不催', shipping: true },
  { id: 'cast.uncertain', text: '我不確定。我陪你問。', listenFor: '承認之後留下，不帶歉意', shipping: true },
  { id: 'cast.ask', text: '請問，神經外科？', listenFor: '對第三人說，清楚但不表演', shipping: true },
  { id: 'cast.arrived-clinic', text: '神經外科，到了。', listenFor: '專有名詞 + 收尾，不慶祝', shipping: true },
  { id: 'cast.arrived-pharmacy', text: '藥局，到了。', listenFor: '不同字數，句型是否穩定', shipping: true },
  { id: 'cast.rest', text: '好，我們先休息。', listenFor: '語氣測試（產品裡休息是不出聲的）', shipping: false },
]

interface Args {
  mode: 'plan' | 'casting' | 'canonical'
  voices: string[]
  model: string
  speed: number
}

function parseArgs(argv: string[]): Args {
  const get = (name: string) =>
    argv.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.slice(name.length + 3))
  const voices = get('voice')
  const mode = argv.includes('--dry-run') ? 'plan' : argv.includes('--casting') ? 'casting' : 'canonical'
  return {
    mode,
    voices,
    model: get('model')[0] ?? DEFAULT_MODEL,
    speed: Number(get('speed')[0] ?? '1.0'),
  }
}

function loadEnv(): void {
  if (!existsSync('.env')) return
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (process.env[key] === undefined) process.env[key] = value
  }
}

interface Synthesised {
  audio: Buffer
  durationMs: number
  usageCharacters: number
}

async function synthesise(text: string, voiceId: string, model: string, speed: number): Promise<Synthesised> {
  const apiKey = process.env.MINIMAX_API_KEY
  if (!apiKey) throw new Error('MINIMAX_API_KEY is not set — put it in .env (which is gitignored)')

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      text,
      stream: false,
      language_boost: 'Chinese',
      output_format: 'hex',
      voice_setting: { voice_id: voiceId, speed, vol: 1.0, pitch: 0 },
      audio_setting: { sample_rate: 32000, bitrate: 128000, format: 'mp3', channel: 1 },
    }),
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} ${await response.text()}`)

  const body = (await response.json()) as {
    data?: { audio?: string }
    extra_info?: { audio_length?: number; usage_characters?: number }
    base_resp?: { status_code?: number; status_msg?: string }
  }

  const status = body.base_resp?.status_code ?? -1
  if (status !== 0) throw new Error(`MiniMax status ${status}: ${body.base_resp?.status_msg ?? 'unknown'}`)
  if (!body.data?.audio) throw new Error('MiniMax returned no audio')

  return {
    audio: Buffer.from(body.data.audio, 'hex'),
    durationMs: body.extra_info?.audio_length ?? 0,
    usageCharacters: body.extra_info?.usage_characters ?? text.length,
  }
}

function write(path: string, data: Buffer | string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, data)
}

async function main(): Promise<void> {
  loadEnv()
  const args = parseArgs(process.argv.slice(2))
  const utterances = canonicalUtterances()

  if (args.mode === 'plan') {
    console.log(`\ncanonical set — ${utterances.length} utterances, nothing generated:\n`)
    for (const u of utterances) console.log(`  ${u.id.padEnd(34)} ${u.text}`)
    console.log(`\ncasting set — ${CASTING_LINES.length} lines:\n`)
    for (const c of CASTING_LINES) {
      console.log(`  ${c.id.padEnd(24)} ${c.text.padEnd(14)} ${c.shipping ? '' : '(non-shipping) '}${c.listenFor}`)
    }
    const characters = utterances.reduce((n, u) => n + u.text.length, 0)
    console.log(`\ncanonical characters: ${characters} · casting characters per voice: ${CASTING_LINES.reduce((n, c) => n + c.text.length, 0)}\n`)
    return
  }

  if (args.voices.length === 0) throw new Error('give at least one --voice=<voice_id>')

  let usage = 0

  if (args.mode === 'casting') {
    for (const voiceId of args.voices) {
      console.log(`\ncasting ${voiceId}`)
      for (const line of CASTING_LINES) {
        const { audio, usageCharacters } = await synthesise(line.text, voiceId, args.model, args.speed)
        usage += usageCharacters
        const path = join('casting', voiceId, `${line.id}.mp3`)
        write(path, audio)
        console.log(`  ${line.text.padEnd(14)} → ${path}`)
      }
    }
    console.log(`\nused ${usage} characters. casting/ is gitignored — listen, then pick one voice.\n`)
    return
  }

  const voiceId = args.voices[0]
  if (args.voices.length > 1) console.log('canonical mode uses one voice; using the first')

  const entries: Record<string, VoiceManifestEntry> = {}
  console.log(`\ngenerating ${utterances.length} canonical utterances with ${voiceId}\n`)

  for (const u of utterances) {
    const { audio, durationMs, usageCharacters } = await synthesise(u.text, voiceId, args.model, args.speed)
    usage += usageCharacters
    const file = join('audio', 'zh-TW', `${fileStemFor(u.id)}.mp3`)
    write(join('public', file), audio)
    entries[u.id] = {
      text: u.text,
      file: file.split(/[\\/]/).join('/'),
      sha256: createHash('sha256').update(audio).digest('hex'),
      bytes: audio.byteLength,
      durationMs,
    }
    console.log(`  ${u.id.padEnd(34)} ${u.text.padEnd(14)} ${(durationMs / 1000).toFixed(2)}s`)
  }

  const manifest: VoiceManifest = {
    locale: 'zh-TW',
    voiceId,
    model: args.model,
    generatedAt: new Date().toISOString().slice(0, 10),
    utterances: entries,
  }
  write(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`)

  console.log(`\nwrote ${MANIFEST_PATH}`)
  console.log(`audio under ${AUDIO_ROOT}/`)
  console.log(`used ${usage} characters\n`)
  console.log('now run: npm test   — the manifest test compares every text against the renderer\n')
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
