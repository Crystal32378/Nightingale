import { describe, expect, it } from 'vitest'
import { EN } from '../strings/en'
import { ZH_TW } from '../strings/zh-TW'
import { formatIssues, lintString, lintStringTable, type RegisterRule } from './register'

/** Strings the register lint must reject, and why. */
const REJECT: Array<[string, RegisterRule]> = [
  ['你走反了', 'no-blame'],
  ['我們走偏了', 'no-blame'],
  ['你們走錯了', 'no-blame'],
  ['你迷路了', 'no-blame'],
  ['你弄錯了', 'no-blame'],
  ['往前走，然後左轉，再按電梯。', 'one-job'],
  ['先去掛號，再走到電梯。', 'one-job'],
  ['對！', 'no-performance'],
  ['好喔，往前走。', 'no-performance'],
  ['往前走囉', 'no-performance'],
  ['沒關係，往前走。', 'no-performance'],
  ['別擔心，左轉。', 'no-performance'],
  ['好好好', 'no-performance'],
  ['往前走 🙂', 'no-performance'],
]

/** Strings the register lint must allow. A lint that rejects these is worse than none. */
const ALLOW = [
  '你的左手邊',
  '你面前偏左',
  '方向反了',
  '我不確定',
  '我陪你問',
  '停一下，方向反了。',
  '對，這個方向。',
  '往前走。',
  '左轉。',
  '往左手邊走。',
  '往右手邊走。',
  '你的右手邊',
  '請問，神經外科？',
  '下一個：掛號櫃台',
  '神經外科，到了。',
]

describe('register lint — REJECT fixtures', () => {
  it.each(REJECT)('rejects %s under %s', (text, rule) => {
    const issues = lintString('fixture', text)
    expect(issues.length).toBeGreaterThan(0)
    expect(issues.map((i) => i.rule)).toContain(rule)
  })
})

describe('register lint — ALLOW fixtures', () => {
  it.each(ALLOW)('allows %s', (text) => {
    expect(lintString('fixture', text)).toEqual([])
  })
})

describe('register lint — the shipped string table', () => {
  it('passes its own lint', () => {
    const issues = lintStringTable(ZH_TW)
    expect(formatIssues(issues)).toBe('')
  })
})

/** The same three rules, in the English the indoor screen can now speak. */
const REJECT_EN: Array<[string, RegisterRule]> = [
  ['You went the wrong way.', 'no-blame'],
  ['We are lost.', 'no-blame'],
  ['You missed the turn.', 'no-blame'],
  ["You've gone the wrong way.", 'no-blame'],
  ['Go straight ahead, then turn left.', 'one-job'],
  ['Go to the cashier. Walk to the elevator.', 'one-job'],
  ['Great job.', 'no-performance'],
  ['Yes!', 'no-performance'],
  ["Don't worry, go straight ahead.", 'no-performance'],
  ['It is okay, go straight ahead.', 'no-performance'],
  ['Go straight ahead 🙂', 'no-performance'],
  ['Oops, wrong way.', 'no-performance'],
]

const ALLOW_EN = [
  'Go to your left.',
  'Wrong way. Stop here.',
  'You have arrived.',
  'I am not sure. I will help you ask.',
  'Excuse me, which way to Neurosurgery?',
  'Excuse me, can you help me find my way?',
  'Next: Registration counter',
  'Do not enter names, medical records or health conditions.',
]

describe('register lint — English fixtures', () => {
  it.each(REJECT_EN)('rejects %s under %s', (text, rule) => {
    expect(lintString('fixture', text).map((i) => i.rule)).toContain(rule)
  })

  it.each(ALLOW_EN)('allows %s', (text) => {
    expect(lintString('fixture', text)).toEqual([])
  })

  it('passes the shipped English table', () => {
    expect(formatIssues(lintStringTable(EN))).toBe('')
  })
})

describe('register lint — mechanics', () => {
  it('ignores empty strings, because silence is a valid output', () => {
    expect(lintString('guidance.wait', '')).toEqual([])
  })

  it('formats issues for a human to argue with', () => {
    const issues = lintString('fixture', '你走反了')
    expect(formatIssues(issues)).toContain('no-blame')
    expect(formatIssues(issues)).toContain('你走反了')
  })
})
