import { motionFrame, type MotionFrame, type MotionInput } from './birdMotion'

/**
 * Drives the pure motion state machine at animation-frame frequency.
 *
 * The clock is owned HERE: every tick reads `now` from the driver's own
 * clock source, never from the caller's input snapshot. A MotionInput prop
 * is a snapshot — its `now` is frozen at render time, and reusing it every
 * frame freezes L1/L2 on their first frame (the regression this file
 * exists to prevent). Callers still own cue / triggers / sequenceStartedAtMs.
 */

export interface MotionDriverDeps {
  raf: (cb: (t: number) => void) => number
  caf: (id: number) => void
  clock: () => number
}

const browserDeps = (): MotionDriverDeps => ({
  raf: (cb) => requestAnimationFrame(cb),
  caf: (id) => cancelAnimationFrame(id),
  clock: () => Date.now(),
})

/** Returns a stop function. `getInput`'s `now` is ignored and re-read from the clock. */
export function startMotionDriver(
  getInput: () => MotionInput,
  onFrame: (frame: MotionFrame) => void,
  deps: MotionDriverDeps = browserDeps(),
): () => void {
  let id = 0
  let stopped = false
  const tick = () => {
    if (stopped) return
    onFrame(motionFrame({ ...getInput(), now: deps.clock() }))
    id = deps.raf(tick)
  }
  id = deps.raf(tick)
  return () => {
    stopped = true
    deps.caf(id)
  }
}
