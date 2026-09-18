import type { BirdEvent, Cue } from '../engine/types'
import type { BirdAdapter } from './bird'

/**
 * Phase 1 bird. Same interface the BLE adapter will implement, so nothing above
 * this layer has to change when the physical bird arrives.
 */
export class VirtualBirdAdapter implements BirdAdapter {
  private handlers = new Set<(event: BirdEvent) => void>()
  private cue: Cue = 'QUIET'
  private cueHistory: Cue[] = []
  private eventHistory: BirdEvent[] = []
  private cueListeners = new Set<(cue: Cue) => void>()

  readonly connected = true

  send(cue: Cue): void {
    this.cue = cue
    this.cueHistory.push(cue)
    for (const listener of this.cueListeners) listener(cue)
  }

  on(handler: (event: BirdEvent) => void): () => void {
    this.handlers.add(handler)
    return () => {
      this.handlers.delete(handler)
    }
  }

  /** Test / dev-panel affordance: pretend the button on the bird was pressed. */
  emit(event: BirdEvent): void {
    this.eventHistory.push(event)
    for (const handler of [...this.handlers]) handler(event)
  }

  /** UI subscription, so the on-screen bird shows exactly what the hardware would do. */
  onCue(listener: (cue: Cue) => void): () => void {
    this.cueListeners.add(listener)
    return () => {
      this.cueListeners.delete(listener)
    }
  }

  get lastCue(): Cue {
    return this.cue
  }

  get lastEvent(): BirdEvent | null {
    return this.eventHistory.length === 0 ? null : this.eventHistory[this.eventHistory.length - 1]
  }

  get cues(): readonly Cue[] {
    return this.cueHistory
  }
}
