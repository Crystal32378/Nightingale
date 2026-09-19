/**
 * Standalone voice generator — zero dependencies, plain Node 18+.
 *
 *   node scripts/voice.mjs --casting --voice=<id> [--voice=<id> ...]
 *   node scripts/voice.mjs --canonical --profile=FEMALE
 *   node scripts/voice.mjs --from-files --profile=FEMALE
 *
 * Why this exists: the sandboxes this project is developed in cannot reach the
 * speech API (the egress allowlist refuses the CONNECT). This runs on an
 * ordinary machine, needs no npm install, and reads the SAME derived lists as
 * the TypeScript generator — scripts/plan/*.json, exported from the string
 * table and the verified place registry.
 *
 * --from-files needs no API and no credits at all: it scans audio that was made
 * by hand in a web interface, and builds the manifest from what is on disk. The
 * text in that manifest still comes from the derived plan, so `npm test` checks
 * it against the renderer exactly as it would for generated audio.
 *
 * It hand-writes no sentence. The key comes from .env and is never printed.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
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

const readPlan = (name) => JSON.parse(readFileSync(join(ROOT, 'scripts', 'plan', `${name}.json`), 'utf8'))

function write(path, data) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, data)
}

const audioDirFor = (gender) => `audio/zh-TW/${gender.toLowerCase()}`
const manifestPathFor = (gender) => `src/voice/manifest.zh-TW.${gender.toLowerCase()}.json`

async function synthesise(text, profile, model) {
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
      voice_setting: { voice_id: profile.voiceId, speed: profile.speed, vol: profile.vol, pitch: profile.pitch },
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

function writeManifest(gender, profile, model, entries) {
  write(
    join(ROOT, manifestPathFor(gender)),
    `${JSON.stringify(
      {
        locale: 'zh-TW',
        profile: gender,
        voiceId: profile.voiceId,
        model,
        voiceSettings: { speed: profile.speed, pitch: profile.pitch, vol: profile.vol },
        generatedAt: new Date().toISOString().slice(0, 10),
        utterances: entries,
      },
      null,
      2,
    )}\n`,
  )
}

/** Build a manifest from audio that already exists on disk. No API, no credits. */
function fromFiles(gender, profile) {
  const utterances = readPlan('canonical')
  const dir = audioDirFor(gender)
  const entries = {}
  const missing = []

  for (const u of utterances) {
    const rel = `${dir}/${u.fileStem}.mp3`
    const abs = join(ROOT, 'public', rel)
    if (!existsSync(abs)) {
      missing.push(`${u.fileStem}.mp3   ${u.text}`)
      continue
    }
    const audio = readFileSync(abs)
    entries[u.id] = {
      text: u.text,
      file: rel,
      sha256: createHash('sha256').update(audio).digest('hex'),
      bytes: statSync(abs).size,
      durationMs: 0,
    }
    console.log(`  ✓ ${u.fileStem.padEnd(32)} ${u.text}`)
  }

  if (missing.length > 0) {
    console.log(`\n還缺 ${missing.length} 個檔案（放進 public/${dir}/）：\n`)
    for (const line of missing) console.log(`  ✗ ${line}`)
  }

  writeManifest(gender, profile, 'manual-web', entries)
  console.log(`\n寫好 ${manifestPathFor(gender)}（${Object.keys(entries).length}/${utterances.length} 句）`)
  console.log('接著跑 npm test —— 對照測試會逐字比對每一句\n')
}

async function main() {
  loadEnv()
  const argv = process.argv.slice(2)
  const get = (name) => argv.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.slice(name.length + 3))
  const profiles = readPlan('profiles')
  const model = get('model')[0] ?? DEFAULT_MODEL

  const gender = (get('profile')[0] ?? '').toUpperCase()
  const profile = profiles[gender]

  if (argv.includes('--from-files')) {
    if (!profile) throw new Error('--from-files 需要 --profile=FEMALE 或 --profile=MALE')
    console.log(`\n從檔案建立 ${gender} 的 manifest（不呼叫 API、不花點數）\n`)
    fromFiles(gender, profile)
    return
  }

  if (argv.includes('--casting')) {
    const voices = get('voice')
    if (voices.length === 0) throw new Error('casting 需要至少一個 --voice=<voice_id>')
    const lines = readPlan('casting')
    let usage = 0
    for (const voiceId of voices) {
      console.log(`\n${voiceId}`)
      for (const line of lines) {
        const { audio, usageCharacters } = await synthesise(line.text, { voiceId, speed: 1, pitch: 0, vol: 1 }, model)
        usage += usageCharacters
        write(join(ROOT, 'casting', voiceId, `${line.id}.mp3`), audio)
        console.log(`  ${line.text.padEnd(12)} ${line.shipping ? '' : '(non-shipping) '}→ casting/${voiceId}/${line.id}.mp3`)
      }
    }
    console.log(`\n用掉 ${usage} 個字\n`)
    return
  }

  if (!profile) throw new Error('canonical 需要 --profile=FEMALE 或 --profile=MALE')

  const utterances = readPlan('canonical')
  const dir = audioDirFor(gender)
  const entries = {}
  let usage = 0
  console.log(`\n${gender} · ${profile.voiceId} · speed ${profile.speed} pitch ${profile.pitch} vol ${profile.vol}\n`)

  for (const u of utterances) {
    const { audio, durationMs, usageCharacters } = await synthesise(u.text, profile, model)
    usage += usageCharacters
    const rel = `${dir}/${u.fileStem}.mp3`
    write(join(ROOT, 'public', rel), audio)
    entries[u.id] = {
      text: u.text,
      file: rel,
      sha256: createHash('sha256').update(audio).digest('hex'),
      bytes: audio.byteLength,
      durationMs,
    }
    console.log(`  ${u.id.padEnd(32)} ${u.text.padEnd(12)} ${(durationMs / 1000).toFixed(2)}s`)
  }

  writeManifest(gender, profile, model, entries)
  console.log(`\n寫好 ${manifestPathFor(gender)}，音檔在 public/${dir}/`)
  console.log(`用掉 ${usage} 個字\n`)
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
