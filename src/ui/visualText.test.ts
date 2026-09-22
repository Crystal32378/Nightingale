import { describe, expect, it } from 'vitest'
import { ZH_TW } from '../strings/zh-TW'
import { visualLines } from './visualText'

/**
 * The screen is allowed to drop punctuation. It is allowed to drop NOTHING
 * else.
 *
 * Crystal's decision (2026-09-20): on screen the 。，？ do no work that space
 * and a line break do not already do. The string table keeps them because they
 * are the notation of the recorded voice — a comma is a pause in a file that
 * has already been recorded.
 *
 * So this file is the line, not the comment in visualText.ts: the written
 * sentence may lose notation on its way to the screen, and may not lose,
 * gain, or reorder a single character of the sentence itself. A sentence that
 * quietly lost its 左 or its floor number would be a wrong instruction in a
 * hospital, arriving through the one module allowed to touch the text.
 */

const NOTATION = new Set(['，', '。', '？', '！', '；', '：'])

/**
 * Whether `after` is `before` with only notation characters deleted:
 * every kept character in its original order, every dropped one notation.
 */
function onlyNotationRemoved(before: string, after: string): boolean {
  let i = 0
  for (const ch of before) {
    if (i < after.length && ch === after[i]) {
      i += 1
      continue
    }
    if (!NOTATION.has(ch)) return false
  }
  return i === after.length
}

/** Every sentence the product can say, with {place} standing in as a real name. */
const SENTENCES = Object.values(ZH_TW)
  .filter((text) => text.length > 0)
  .map((text) => text.replace('{place}', '神經外科'))

describe('the screen may drop notation and nothing else', () => {
  it('keeps every non-punctuation character of every string in the table', () => {
    for (const sentence of SENTENCES) {
      const joined = visualLines(sentence).join('')
      expect(onlyNotationRemoved(sentence, joined), sentence).toBe(true)
    }
  })

  it('never invents a character', () => {
    for (const sentence of SENTENCES) {
      for (const ch of visualLines(sentence).join('')) {
        expect(sentence.includes(ch), `${sentence} → ${ch}`).toBe(true)
      }
    }
  })

  it('keeps 左 and 右 — they are the instruction, not decoration', () => {
    expect(visualLines(ZH_TW['guidance.turn.left']).join('')).toContain('左')
    expect(visualLines(ZH_TW['guidance.turn.right']).join('')).toContain('右')
  })

  it('keeps digits in a verified place name', () => {
    expect(visualLines('三樓電梯口，左側電梯。')).toEqual(['三樓電梯口', '左側電梯'])
    expect(visualLines('2 號門。').join('')).toContain('2')
  })
})

describe('the line break falls where the breath already was', () => {
  it('splits 我不確定。我陪你問。 in that order — company first', () => {
    expect(visualLines(ZH_TW['guidance.uncertain'])).toEqual(['我不確定', '我陪你問'])
  })

  it('turns the comma of the ask into a line break', () => {
    expect(visualLines('請問，神經外科？')).toEqual(['請問', '神經外科'])
  })

  it('leaves a sentence with no punctuation as a single line', () => {
    expect(visualLines('目前位置')).toEqual(['目前位置'])
  })
})

describe('what comes back can be empty, and the screen has to expect that', () => {
  it('returns no lines for an empty string', () => {
    expect(visualLines('')).toEqual([])
  })

  it('returns no lines for punctuation alone', () => {
    // No string in the table looks like this today. If one ever does, the
    // caller must not render an empty panel — it must render nothing.
    expect(visualLines('。。')).toEqual([])
  })

  it('never returns a blank line', () => {
    for (const sentence of SENTENCES) {
      for (const line of visualLines(sentence)) {
        expect(line.trim().length).toBeGreaterThan(0)
      }
    }
  })
})

describe('the sentence itself is not touched', () => {
  it('leaves the string it was given unchanged, so speech and aria get the original', () => {
    const original = ZH_TW['guidance.uncertain']
    const copy = `${original}`
    visualLines(original)
    expect(original).toBe(copy)
    expect(original).toContain('。')
  })
})
