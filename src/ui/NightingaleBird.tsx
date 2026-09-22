import type { Cue } from '../engine/types'
import { birdFacing, lampState } from './birdPresentation'
import canonicalBird from '../assets/nightingale-canonical.png'

/**
 * The bird is the product. It is not a status icon.
 *
 * One canonical piece of artwork, one pose. A LEFT cue mirrors that same
 * artwork rather than swapping in a second drawing, so the character is
 * identical in both directions. See birdPresentation.ts for why the mirroring
 * reads as a gesture and not as a compass claim.
 *
 * The lamp is a presentation layer of its own and is never baked into the
 * artwork — it is the only part that ever changes, exactly as on the physical
 * bird. There is no alarm state and no red anywhere: while someone is resting
 * the bird is indistinguishable from idle, from across a waiting room.
 *
 * The same discipline holds for motion and expression (the ask-breath below):
 * on an ASK cue the bird must not look pleased with itself, and it must not
 * look sorry. Saying "I don't know" and staying is its strongest moment, so
 * the most it ever does is slow down and lean in — company, not performance.
 */
export function NightingaleBird({ cue }: { cue: Cue }) {
  const facing = birdFacing(cue)
  return (
    <div className={`bird-stage cue-${cue.toLowerCase()}`}>
      <div className="bird" data-facing={facing.toLowerCase()} role="img" aria-label={cue.toLowerCase()}>
        <img className="bird-art" src={canonicalBird} alt="" draggable={false} />
        <span className={`bird-lamp lamp-${lampState(cue).toLowerCase()}`} aria-hidden="true" />
      </div>
      <span className="bird-ground" aria-hidden="true" />
    </div>
  )
}
