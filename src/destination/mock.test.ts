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
