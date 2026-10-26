import { describe, expect, it } from 'vitest'
import { PLACE_REGISTRY, type PlaceRegistry } from '../registry/types'
import { MockInterpreter } from './mock'

/**
 * The mock is what runs with no API key — on a reviewer's laptop, in a demo
 * whose credit ran out. It must behave like the real thing at the boundary:
 * a place the person clearly named, or uncertain. It is allowed to be dumb
 * (it only spots words); it is not allowed to guess.
 */

const mock = new MockInterpreter()
const place = (placeId: string) => ({ kind: 'place', placeId })
const UNCERTAIN = { kind: 'uncertain' }

describe('MockInterpreter', () => {
  it('says it is the mock, so the screen can label it 模擬', () => {
    expect(mock.mode).toBe('mock')
  })

  it.each([
    ['我要去藥局', 'PHARMACY'],
    ['請問神經外科在哪裡', 'NEUROSURGERY'],
    ['我要去批價', 'CASHIER'],
    ['批價櫃台怎麼走', 'CASHIER'],
    ['我想去掛號', 'REGISTRATION'],
    ['電梯在哪', 'ELEVATOR_IN'],
    ['我要回大門', 'ENTRANCE'],
    ['出口在哪裡', 'EXIT'],
  ])('finds the place in %j', async (text, id) => {
    expect(await mock.interpret(text)).toEqual(place(id))
  })

  it('is uncertain when nothing it knows is named', async () => {
    expect(await mock.interpret('我頭好痛')).toEqual(UNCERTAIN)
    expect(await mock.interpret('')).toEqual(UNCERTAIN)
  })

  it('is uncertain when two places are named, rather than picking one', async () => {
    expect(await mock.interpret('先去批價再去藥局')).toEqual(UNCERTAIN)
  })

  it.each([
    '不要去藥局',
    '我不想去批價',
    '不用掛號了',
    '不去神經外科',
    '別去出口',
    '不必搭電梯',
    '不是要去大門',
    // Found in PR② review: these still walked people to the pharmacy.
    '我不能去藥局',
    '我不需要去藥局',
    '我不可以去藥局',
    '我沒有要去藥局',
    '我沒要去藥局',
    '我不會去批價',
    '我不打算去掛號',
  ])(
    'is uncertain when the place is negated: %j',
    async (text) => {
      // Spotting 藥局 in 不要去藥局 and walking the person there is the worst
      // answer. The mock cannot tell negation from naming, so any negation
      // word means it does not guess; 我陪你問 is the safe fallback.
      expect(await mock.interpret(text)).toEqual(UNCERTAIN)
    },
  )

  it.each([
    // Found in PR⑤ review: someone unsure whether to go was offered the place.
    '也許去藥局',
    '或許是批價',
    '說不定要去掛號',
    '我不確定要去藥局',
    '我不一定要去批價',
  ])('is uncertain when the person is unsure about the place: %j', async (text) => {
    expect(await mock.interpret(text)).toEqual(UNCERTAIN)
  })

  it.each([
    ['我不知道藥局在哪裡', 'PHARMACY'],
    ['不好意思，批價在哪', 'CASHIER'],
    // 可能 is left out of the list on purpose: here it doubts the floor, not the place.
    ['藥局可能在幾樓', 'PHARMACY'],
  ])('still finds the place when 不 is not negating it: %j', async (text, id) => {
    // Someone who does not know where the pharmacy is wants to go there; a
    // list of negation words (not every 不) keeps that a destination.
    expect(await mock.interpret(text)).toEqual(place(id))
  })

  it.each([
    ['I want to go to the pharmacy', 'PHARMACY'],
    ['Where is Neurosurgery?', 'NEUROSURGERY'],
    ['where do I find the cashier', 'CASHIER'],
    ['Registration counter, please', 'REGISTRATION'],
    ['Take me to the elevator', 'ELEVATOR_IN'],
    ['the main entrance', 'ENTRANCE'],
    ['How do I get to the EXIT', 'EXIT'],
  ])('finds the place in English: %j', async (text, id) => {
    // The same rule as in Chinese: the place's own name, nothing inferred.
    expect(await mock.interpret(text)).toEqual(place(id))
  })

  it('names nothing from a word that only contains a place name', async () => {
    expect(await mock.interpret('I am exiting slowly')).toEqual(UNCERTAIN)
    expect(await mock.interpret('I need my medicine')).toEqual(UNCERTAIN)
  })

  it.each([
    'I do not want to go to the pharmacy',
    "I don't want the pharmacy",
    'I don’t need the cashier',
    'not the exit',
    'Never mind the elevator',
    "I won't go to registration",
    "I can't go to the pharmacy",
    'No pharmacy',
    // Found in PR⑤ review: contractions missing from a list, and doubt.
    "I wouldn't go to the pharmacy",
    "I didn't mean the cashier",
    "I haven't got time for registration",
    'I couldn’t find the exit',
    "I'm not sure I need the pharmacy",
    'maybe the pharmacy',
    'Perhaps the cashier',
  ])('is uncertain when an English sentence negates the place: %j', async (text) => {
    expect(await mock.interpret(text)).toEqual(UNCERTAIN)
  })

  it.each([
    ["I don't know where the pharmacy is", 'PHARMACY'],
    ['I do not know where the cashier is', 'CASHIER'],
    ['I am not sure where Neurosurgery is', 'NEUROSURGERY'],
    ["I don't know how to get to the elevator", 'ELEVATOR_IN'],
  ])('still finds the place when not knowing where it is: %j', async (text, id) => {
    expect(await mock.interpret(text)).toEqual(place(id))
  })

  it('is uncertain for two places in English, and for the elevator exit', async () => {
    expect(await mock.interpret('cashier and then pharmacy')).toEqual(UNCERTAIN)
    expect(await mock.interpret('elevator exit')).toEqual(UNCERTAIN)
  })

  it('does not turn 電梯出口 into a destination', async () => {
    // ELEVATOR_OUT is never offered; the words inside it (電梯, 出口) point two
    // ways at once, so the mock must not settle on either.
    expect(await mock.interpret('電梯出口')).toEqual(UNCERTAIN)
  })

  it('goes through the same registry gate as a model answer', async () => {
    const unsourced: PlaceRegistry = {
      ...PLACE_REGISTRY,
      PHARMACY: { ...PLACE_REGISTRY.PHARMACY, source: null },
    }
    expect(await new MockInterpreter(unsourced).interpret('我要去藥局')).toEqual(UNCERTAIN)
  })
})
