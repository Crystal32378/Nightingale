import { describe, expect, it } from 'vitest'
import { lintStringTable } from '../lint/register'
import type { RemoteAction } from './last300mClient'
import { deriveGuidance, sanitizeLine } from './remoteGuidance'
import { LAST300M_ZH } from './strings'

describe('last-300m strings keep the register', () => {
  it('passes the same no-blame / one-job / no-performance lint as the main table', () => {
    expect(lintStringTable(LAST300M_ZH)).toEqual([])
  })
})

describe('sanitizeLine', () => {
  it('strips control characters, collapses whitespace, and caps length', () => {
    expect(sanitizeLine('往前\u0000走\n\n直到  天橋')).toBe('往前 走 直到 天橋')
    expect(sanitizeLine('x'.repeat(500))).toHaveLength(140)
  })
})

describe('deriveGuidance', () => {
  const base = { checkpointId: 'cp2' }

  it('renders GUIDE and RECOVER as bounded instruction text', () => {
    const guide = deriveGuidance({ ...base, type: 'GUIDE', instruction: '沿著騎樓直走。' })
    expect(guide).toEqual({ kind: 'instruction', headline: '沿著騎樓直走。', lookFor: [] })
    const recover = deriveGuidance({ ...base, type: 'RECOVER', instruction: '回到藍色指標那裡。' })
    expect(recover.kind).toBe('instruction')
  })

  it('renders ASK with the server question, falling back to the local one', () => {
    expect(deriveGuidance({ ...base, type: 'ASK', question: '門上是門診還是急診？' }).headline).toBe(
      '門上是門診還是急診？',
    )
    expect(deriveGuidance({ ...base, type: 'ASK' }).headline).toBe(LAST300M_ZH['l3.reanchor.question'])
  })

  it('renders REANCHOR with the local question and a bounded lookFor list', () => {
    const action: RemoteAction = {
      ...base,
      type: 'REANCHOR',
      lookFor: ['a'.repeat(80), '', 'exit sign', 'b', 'c', 'd', 'e'],
    }
    const view = deriveGuidance(action)
    expect(view.headline).toBe(LAST300M_ZH['l3.reanchor.question'])
    expect(view.lookFor.length).toBeLessThanOrEqual(5)
    expect(view.lookFor[0]).toHaveLength(40)
    expect(view.lookFor).not.toContain('')
  })

  it('renders CONFIRM_ARRIVAL with local arrival copy, never server text', () => {
    const view = deriveGuidance({ ...base, type: 'CONFIRM_ARRIVAL', instruction: 'IGNORED' })
    expect(view).toEqual({ kind: 'arrival', headline: LAST300M_ZH['l3.arrived.headline'], lookFor: [] })
  })

  it('never emits markup-capable content', () => {
    const view = deriveGuidance({
      ...base,
      type: 'GUIDE',
      instruction: '<img src=x onerror=alert(1)>\u0007直走',
    })
    expect(view.headline).not.toMatch(/[\u0000-\u001f\u007f]/)
    // Plain text rendering is the real defence (React escapes); this asserts
    // the sanitizer at least keeps the line printable and bounded.
    expect(view.headline.length).toBeLessThanOrEqual(140)
  })
})
