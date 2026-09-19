import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { lintString } from '../lint/register'
import { canonicalUtterances } from './utterances'

/**
 * scripts/plan/*.json are the bridge to the standalone generator: the sandboxes
 * this project is developed in cannot reach the speech API, so the machine that
 * actually generates audio reads these files instead of running the TypeScript.
 *
 * That makes them a place where truth could quietly go stale. These tests are
 * the seam: if the string table changes and the plan is not re-exported, they
 * fail, and the audio never gets generated from an out-of-date list.
 */
const read = (name: string) =>
  JSON.parse(readFileSync(join(process.cwd(), 'scripts', 'plan', `${name}.json`), 'utf8'))

describe('the exported canonical plan matches what the code derives', () => {
  const plan = read('canonical') as Array<{ id: string; text: string; fileStem: string }>
  const derived = canonicalUtterances()

  it('has the same number of utterances', () => {
    expect(plan).toHaveLength(derived.length)
  })

  it('has the same id, text and filename for every one of them', () => {
    expect(plan).toEqual(derived.map((u) => ({ id: u.id, text: u.text, fileStem: u.fileStem })))
  })
})

describe('the casting plan', () => {
  const plan = read('casting') as Array<{ id: string; text: string; listenFor: string; shipping: boolean }>

  it('marks the lines that are not product strings', () => {
    const nonShipping = plan.filter((line) => !line.shipping)
    expect(nonShipping.length).toBeGreaterThan(0)
    for (const line of nonShipping) expect(line.text.length).toBeGreaterThan(0)
  })

  it('holds every casting line to the register lint, shipping or not', () => {
    for (const line of plan) expect(lintString(line.id, line.text)).toEqual([])
  })

  it('says what to listen for in each one', () => {
    for (const line of plan) expect(line.listenFor.length).toBeGreaterThan(0)
  })

  it('pairs the two direction lines, which must be heard together', () => {
    const ids = plan.map((line) => line.id)
    expect(ids).toContain('cast.right')
    expect(ids).toContain('cast.left')
  })
})
