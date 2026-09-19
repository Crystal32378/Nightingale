/**
 * Export the derived utterance lists as JSON, so a standalone, dependency-free
 * generator can read them on a machine that can actually reach MiniMax.
 *
 * The lists are still DERIVED here — nothing downstream hand-writes a sentence.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { canonicalUtterances } from '../src/voice/utterances'
import { CASTING_LINES } from './casting-lines'

mkdirSync('scripts/plan', { recursive: true })

const canonical = canonicalUtterances().map((u) => ({ id: u.id, text: u.text, fileStem: u.fileStem }))
writeFileSync('scripts/plan/canonical.json', `${JSON.stringify(canonical, null, 2)}\n`)
writeFileSync('scripts/plan/casting.json', `${JSON.stringify(CASTING_LINES, null, 2)}\n`)

console.log(`canonical: ${canonical.length} utterances → scripts/plan/canonical.json`)
console.log(`casting:   ${CASTING_LINES.length} lines     → scripts/plan/casting.json`)
