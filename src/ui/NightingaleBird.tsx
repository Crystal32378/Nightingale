import type { Cue } from '../engine/types'
import { birdFacing, birdMotion, lampState } from './birdPresentation'
import pixelBird from '../assets/nightingale-pixel.png'

/**
 * The bird is the product. It is not a status icon.
 *
 * One canonical piece of artwork, one pose — the pixel nightingale (see
 * docs/motion-study-brief.md: a clever companion device, not a real animal).
 * A LEFT cue mirrors that same artwork rather than swapping in a second
 * drawing, so the character is identical in both directions. See
 * birdPresentation.ts for why the mirroring reads as a gesture and not as a
 * compass claim.
 *
 * The lamp is a presentation layer of its own and is never baked into the
 * artwork — it sits on the leaf mark on the chest and is the only part that
 * carries information. The body has ambient motion
 * (birdPresentation.birdMotion): alive, never performing, and silenced
 * entirely under prefers-reduced-motion. There is no alarm state and no red
 * anywhere: while someone is resting the bird is indistinguishable from
 * idle, from across a waiting room.
 */
export function NightingaleBird({ cue }: { cue: Cue }) {
  const facing = birdFacing(cue)
  const motion = birdMotion(cue)
  return (
    <div className={`bird-stage cue-${cue.toLowerCase()}`}>
      <div
        className={`bird motion-${motion.kind.toLowerCase()}`}
        data-facing={facing.toLowerCase()}
        role="img"
        aria-label={cue.toLowerCase()}
      >
        <img className="bird-art" src={pixelBird} alt="" draggable={false} />
        <span className={`bird-lamp lamp-${lampState(cue).toLowerCase()}`} aria-hidden="true" />
      </div>
      <span className="bird-ground" aria-hidden="true" />
    </div>
  )
}
