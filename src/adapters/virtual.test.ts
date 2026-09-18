import { describe, expect, it, vi } from 'vitest'
import { renderAsk } from '../render/renderer'
import { VirtualBirdAdapter } from './virtual'

describe('VirtualBirdAdapter', () => {
  it('reports itself connected and starts quiet', () => {
    const bird = new VirtualBirdAdapter()
    expect(bird.connected).toBe(true)
    expect(bird.lastCue).toBe('QUIET')
  })

  it('holds the last cue it was sent', () => {
    const bird = new VirtualBirdAdapter()
    bird.send('LEFT')
    expect(bird.lastCue).toBe('LEFT')
    bird.send('QUIET')
    expect(bird.lastCue).toBe('QUIET')
    expect(bird.cues).toEqual(['LEFT', 'QUIET'])
  })

  it('delivers button events to every subscriber', () => {
    const bird = new VirtualBirdAdapter()
    const a = vi.fn()
    const b = vi.fn()
    bird.on(a)
    bird.on(b)
    bird.emit('SHORT_PRESS')
    expect(a).toHaveBeenCalledWith('SHORT_PRESS')
    expect(b).toHaveBeenCalledWith('SHORT_PRESS')
    expect(bird.lastEvent).toBe('SHORT_PRESS')
  })

  it('unsubscribes', () => {
    const bird = new VirtualBirdAdapter()
    const handler = vi.fn()
    const off = bird.on(handler)
    off()
    bird.emit('LONG_PRESS')
    expect(handler).not.toHaveBeenCalled()
  })

  it('notifies cue listeners so the screen shows what the hardware does', () => {
    const bird = new VirtualBirdAdapter()
    const seen: string[] = []
    bird.onCue((cue) => seen.push(cue))
    bird.send('ASK')
    bird.send('ARRIVED')
    expect(seen).toEqual(['ASK', 'ARRIVED'])
  })
})

describe('ask-for-me reaches the bird button, not only the screen', () => {
  it('opens the ask card from a long press, through the adapter', () => {
    const bird = new VirtualBirdAdapter()
    const askedFor: string[] = []

    // Exactly the wiring the UI uses: the flow is triggered from the adapter,
    // so a bird with one button and no screen can start it.
    bird.on((event) => {
      if (event === 'LONG_PRESS') askedFor.push(renderAsk('NEUROSURGERY', Date.now()).speech)
    })

    bird.emit('SHORT_PRESS')
    expect(askedFor).toEqual([])

    bird.emit('LONG_PRESS')
    expect(askedFor).toEqual(['請問，神經外科？'])
  })
})
