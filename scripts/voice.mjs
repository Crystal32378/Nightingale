/**
 * Standalone MiniMax generator — zero dependencies, plain Node 18+.
 *
 *   node scripts/voice.mjs --casting --voice=<id> [--voice=<id> ...]
 *   node scripts/voice.mjs --canonical --voice=<id>
 *
 * Why this exists: the sandboxes this project is developed in cannot reach
 * api.minimax.io (the egress allowlist refuses the CONNECT). This file runs on
 * a normal machine with normal internet, needs no npm install, and reads the
 * SAME derived lists as the TypeScript generator — scripts/plan/*.json, which
 * are exported from the string table and the verified place registry.
 *
 * It hand-writes no sentence. If a line changes, re-export the plan and the
 * manifest test will catch anything stale.
 *
 * The key comes from .env (gitignored) and is never printed.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const API_URL = 'https://api.minimax.io/v1/t2a_v2'
const DEFAULT_MODEL = 'speech-2.6-hd'

function loadEnv() {
  const path = join(ROOT, '.env')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (process.env[key] === undefined) process.env[key] = value
  }
}

function readPlan(name) {
  return JSON.parse(readFileSync(join(ROOT, 'scripts', 'plan', `${name}.json`), 'utf8'))
}

function write(path, data) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, data)
}

async function synthesise(text, voiceId, model, speed) {
  const apiKey = process.env.MINIMAX_API_KEY
  if (!apiKey) throw new Error('MINIMAX_API_KEY is not set — put it in .env')

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

  if (!response.ok) throw new Error(`HTTP ${response.status} ${(await response.text()).slice(0, 200)}`)

  const body = await response.json()
  const status = body?.base_resp?.status_code ?? -1
  if (status !== 0) throw new Error(`MiniMax status ${status}: ${body?.base_resp?.status_msg ?? 'unknown'}`)
  if (!body?.data?.audio) throw new Error('MiniMax returned no audio')

  return {
    audio: Buffer.from(body.data.audio, 'hex'),
    durationMs: body.extra_info?.audio_length ?? 0,
    usageCharacters: body.extra_info?.usage_characters ?? text.length,
  }
}

async function main() {
  loadEnv()
  const argv = process.argv.slice(2)
  const get = (name) => argv.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.slice(name.length + 3))
  const voices = get('voice')
  const model = get('model')[0] ?? DEFAULT_MODEL
  const speed = Number(get('speed')[0] ?? '1.0')
  const canonical = argv.includes('--canonical')

  if (voices.length === 0) {
    console.log('\n給至少一個音色：--voice=<voice_id>\n')
    process.exit(1)
  }

  let usage = 0

  if (!canonical) {
    const lines = readPlan('casting')
    for (const voiceId of voices) {
      console.log(`\n${voiceId}`)
      for (const line of lines) {
        const { audio, usageCharacters } = await synthesise(line.text, voiceId, model, speed)
        usage += usageCharacters
        const path = join(ROOT, 'casting', voiceId, `${line.id}.mp3`)
        write(path, audio)
        console.log(`  ${line.text.padEnd(12)} ${line.shipping ? '' : '(non-shipping) '}→ casting/${voiceId}/${line.id}.mp3`)
      }
    }
    console.log(`\n用掉 ${usage} 個字。檔案在 casting/ 底下，聽完選一個音色。\n`)
    return
  }

  const utterances = readPlan('canonical')
  const voiceId = voices[0]
  const entries = {}
  console.log(`\n用 ${voiceId} 生成 ${utterances.length} 句 canonical\n`)

  for (const u of utterances) {
    const { audio, durationMs, usageCharacters } = await synthesise(u.text, voiceId, model, speed)
    usage += usageCharacters
    const file = `audio/zh-TW/${u.fileStem}.mp3`
    write(join(ROOT, 'public', file), audio)
    entries[u.id] = {
      text: u.text,
      file,
      sha256: createHash('sha256').update(audio).digest('hex'),
      bytes: audio.byteLength,
      durationMs,
    }
    console.log(`  ${u.id.padEnd(32)} ${u.text.padEnd(12)} ${(durationMs / 1000).toFixed(2)}s`)
  }

  write(
    join(ROOT, 'src', 'voice', 'manifest.zh-TW.json'),
    `${JSON.stringify(
      { locale: 'zh-TW', voiceId, model, generatedAt: new Date().toISOString().slice(0, 10), utterances: entries },
      null,
      2,
    )}\n`,
  )

  console.log(`\n寫好 src/voice/manifest.zh-TW.json，音檔在 public/audio/zh-TW/`)
  console.log(`用掉 ${usage} 個字\n`)
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
