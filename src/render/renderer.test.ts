import { describe, expect, it } from 'vitest'
import type { Instruction } from '../engine/types'
import { ZH_TW } from '../strings/zh-TW'
import { renderAsk, renderGuidance, renderNextCheckpoint } from './renderer'
import { validate } from './validator'

const now = 1_700_000_000_000

function instruction(partial: Partial<Instruction>): Instruction {
  return {
    intent: 'GO',
    turn: null,
    turnExpiresAt: null,
    destinationId: null,
    disclosedSteps: 1,
    ...partial,
  }
}

describe('verified registry interpolation', () => {
  it('builds the ask utterance from the registry, deterministically', () => {
    const rendered = renderAsk('NEUROSURGERY', now)
    expect(rendered.screen).toBe('請問，神經外科？')
    expect(rendered.fallbackUsed).toBe(false)
  })

  it('gives screen and speech the same string, always', () => {
    const rendered = renderAsk('NEUROSURGERY', now)
    expect(rendered.speech).toBe(rendered.screen)
  })

  it('is deterministic — the same call gives the same characters', () => {
    expect(renderAsk('NEUROSURGERY', now).screen).toBe(renderAsk('NEUROSURGERY', now + 5000).screen)
  })

  it('names the destination on arrival', () => {
    const rendered = renderGuidance(instruction({ intent: 'ARRIVED', destinationId: 'PHARMACY' }), now)
    expect(rendered.screen).toBe('藥局，到了。')
  })

  it('labels the next checkpoint from the registry', () => {
    expect(renderNextCheckpoint('REGISTRATION', now)?.screen).toBe('下一個：掛號櫃台')
    expect(renderNextCheckpoint(null, now)).toBeNull()
  })
})

describe('validator falls back instead of improvising', () => {
  it('refuses a destination that is not in the registry', () => {
    const rendered = renderAsk('CARDIOLOGY', now)
    expect(rendered.fallbackUsed).toBe(true)
    expect(rendered.screen).toBe(ZH_TW['fallback.safe'])
    expect(rendered.failures).toContain('UNVERIFIED_PLACE')
  })

  it('refuses a registry entry that exists but is not verified', () => {
    const rendered = renderAsk('UNVERIFIED_WARD', now)
    expect(rendered.fallbackUsed).toBe(true)
    expect(rendered.failures).toContain('UNVERIFIED_PLACE')
  })

  it('refuses a direction whose TTL has expired', () => {
    const expired = instruction({ intent: 'TURN', turn: 'LEFT', turnExpiresAt: now - 1 })
    const rendered = renderGuidance(expired, now)
    expect(rendered.fallbackUsed).toBe(true)
    expect(rendered.failures).toContain('EXPIRED_TURN_DIRECTION')
    expect(rendered.screen).not.toContain('左')
  })

  it('allows a direction inside its TTL', () => {
    const live = instruction({ intent: 'TURN', turn: 'LEFT', turnExpiresAt: now + 10_000 })
    expect(renderGuidance(live, now).screen).toBe('左轉。')
  })

  it('refuses any distance, floor or count the engine did not supply', () => {
    expect(validate({ key: 'guidance.go' }, '往前走三十公尺。', { instruction: null, now }).failures).toContain(
      'UNSOURCED_NUMBER',
    )
    expect(validate({ key: 'guidance.go' }, '上 3 樓。', { instruction: null, now }).failures).toContain(
      'UNSOURCED_NUMBER',
    )
  })

  it('refuses an unresolved placeholder rather than showing braces to a person', () => {
    expect(validate({ key: 'ask.utterance' }, '請問，{place}？', { instruction: null, now }).failures).toContain(
      'UNRESOLVED_PLACEHOLDER',
    )
  })

  it('says nothing at all while resting', () => {
    expect(renderGuidance(instruction({ intent: 'WAIT' }), now).screen).toBe('')
  })

  it('admits uncertainty in one approved sentence', () => {
    expect(renderGuidance(instruction({ intent: 'ASK_DIRECTION' }), now).screen).toBe('我不確定。我陪你問。')
  })
})
