/**
 * Export the derived lists as JSON, so a standalone, dependency-free generator
 * can read them on a machine that can actually reach the speech API.
 *
 * The lists are still DERIVED here — nothing downstream hand-writes a sentence.
 * Also writes a download guide, for the path where audio is made by hand in a
 * web interface and dropped into the repo.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { canonicalUtterances } from '../src/voice/utterances'
import { audioDirFor, VOICE_GENDERS, VOICE_PROFILES } from '../src/voice/profiles'
import { CASTING_LINES } from './casting-lines'

mkdirSync('scripts/plan', { recursive: true })

const canonical = canonicalUtterances().map((u) => ({
  id: u.id,
  text: u.text,
  context: u.context,
  fileStem: u.fileStem,
}))
writeFileSync('scripts/plan/canonical.json', `${JSON.stringify(canonical, null, 2)}\n`)
writeFileSync('scripts/plan/casting.json', `${JSON.stringify(CASTING_LINES, null, 2)}\n`)
writeFileSync('scripts/plan/profiles.json', `${JSON.stringify(VOICE_PROFILES, null, 2)}\n`)

const guide = [
  '# 手動產生語音的對照表',
  '',
  '這份是給「在網頁介面生成、下載、放進專案」那條路用的。每一句生成之後，',
  '**照右邊的檔名存**，放進對應資料夾，然後跑：',
  '',
  '```bash',
  'node scripts/voice.mjs --from-files --profile=FEMALE',
  'node scripts/voice.mjs --from-files --profile=MALE',
  '```',
  '',
  '腳本會掃描資料夾、算 sha256、產生 manifest。跑完 `npm test`，',
  '對照測試會逐字比對每一句是不是 renderer 真正會說的話。',
  '',
  '兩個聲音用同一批文字，只是資料夾不同：',
  '',
  ...VOICE_GENDERS.map(
    (g) =>
      `- **${g}** — 音色 \`${VOICE_PROFILES[g].voiceId}\`，speed ${VOICE_PROFILES[g].speed}、volume ${VOICE_PROFILES[g].vol} → 存到 \`public/${audioDirFor(g)}/\``,
  ),
  '',
  '**pitch 跟著「講給誰聽」走**，所以每個聲音要分兩趟生成：',
  '',
  `- \`PRIVATE\`（陪著走的話，講給拿手機的人聽）→ **pitch ${VOICE_PROFILES.MALE.pitch.PRIVATE}**`,
  `- \`PUBLIC\`（幫忙問路的話，講給櫃台對面的陌生人聽）→ **pitch ${VOICE_PROFILES.MALE.pitch.PUBLIC}**`,
  '',
  '同一支聲音、同樣語速、同樣用字，只有面對誰的時候語氣不同。',
  '',
  `共 ${canonical.length} 句，每個聲音一套。`,
  '',
  '| # | 對象 | pitch | 要生成的文字 | 存成這個檔名 |',
  '| --- | --- | --- | --- | --- |',
  ...canonical.map(
    (u, i) =>
      `| ${i + 1} | ${u.context} | ${VOICE_PROFILES.MALE.pitch[u.context]} | \`${u.text}\` | \`${u.fileStem}.mp3\` |`,
  ),
  '',
  '檔名一個字都不能錯——manifest 是靠檔名對回句子的。',
  '',
]
writeFileSync('scripts/plan/download-guide.md', `${guide.join('\n')}\n`)

console.log(`\ncanonical — ${canonical.length} 句，${canonical.reduce((n, u) => n + u.text.length, 0)} 個字：\n`)
for (const u of canonical) console.log(`  ${u.id.padEnd(32)} ${u.text}`)
console.log(`\ncasting — ${CASTING_LINES.length} 句：\n`)
for (const c of CASTING_LINES) {
  console.log(`  ${c.id.padEnd(22)} ${c.text.padEnd(12)} ${c.shipping ? '' : '(non-shipping) '}${c.listenFor}`)
}
console.log('')
console.log(`canonical: ${canonical.length} → scripts/plan/canonical.json`)
console.log(`casting:   ${CASTING_LINES.length} → scripts/plan/casting.json`)
console.log(`profiles:  ${VOICE_GENDERS.length} → scripts/plan/profiles.json`)
console.log(`guide:         → scripts/plan/download-guide.md`)
