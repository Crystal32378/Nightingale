import { useEffect, useState } from 'react'
import type { Cue } from '../engine/types'
import { birdFacing, lampState } from './birdPresentation'
import canonicalBird from '../assets/nightingale-canonical.png'
import { motionFrame, type MotionInput, type MotionFrame, type MotionSprite } from './birdMotion'
import './birdMotion.css'

/**
 * The bird is the product. It is not a status icon.
 *
 * One canonical piece of artwork, one pose. A LEFT cue mirrors that same
 * artwork rather than swapping in a second drawing, so the character is
 * identical in both directions. See birdPresentation.ts for why the mirroring
 * reads as a gesture and not as a compass claim.
 *
 * The lamp is a presentation layer of its own and is never baked into the
 * artwork — it is the only part that ever changes by default, exactly as on
 * the physical bird. There is no alarm state and no red anywhere: while
 * someone is resting the bird is indistinguishable from idle, from across
 * a waiting room.
 *
 * Body motion (Phase 1): driven by the birdMotion.ts pure state machine.
 * Six motion studies — IDLE L0 / L1 / L2 and LISTEN L0 / L1 / L2.
 *
 * Sprite frames have not shipped in this branch: every sprite slot falls
 * back to the canonical artwork (BASE), so only the ambient breath is
 * visible. When the pixel artist ships the real frames (≥95% shared pixels,
 * transparent RGBA at native grid), point each slot at its own file.
 */

// Placeholder: all slots map to BASE until the sprite sheet ships.
// See docs/motion-treatment-phase1.md §1 for the frame spec.
const SPRITE_URLS: Record<MotionSprite, string> = {
  BASE: canonicalBird,
  INHALE: canonicalBird,
  EXHALE: canonicalBird,
  BLINK: canonicalBird,
  ATTEND_HEAD: canonicalBird,
  ATTEND_TILT: canonicalBird,
  GAZE_UP: canonicalBird,
  GAZE_AWAY: canonicalBird,
}

export function NightingaleBird({ cue, motionInput }: { cue: Cue; motionInput?: MotionInput }) {
  const facing = birdFacing(cue)
  const [motion, setMotion] = useState<MotionFrame>(() => resolveMotion(cue, motionInput))

  // Drive the state machine at render frequency. The state machine is
  // pure; calling it once per frame is cheap. Reads from motionInput so
  // the parent owns cue / listenActive / triggers / sequenceStartedAtMs.
  useEffect(() => {
    if (!motionInput) {
      setMotion(resolveMotion(cue, undefined))
      return
    }
    let raf = 0
    const tick = () => {
      setMotion(resolveMotion(cue, motionInput))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [cue, motionInput])

  // For IDLE_L0 ambient breath we let the CSS keyframe drive; JS does not
  // override. For every other motion frame (L1 / L2 / LISTEN), JS applies
  // the transform via inline style and data-paused kills the keyframe.
  const isAmbientBreath =
    motion.sprite === 'BASE' &&
    !motion.ambientBreathingPaused &&
    motion.transform.translateX === 0 &&
    motion.transform.translateY === 0 &&
    motion.transform.scale === 1 &&
    motion.transform.rotate === 0

  const style = isAmbientBreath
    ? undefined
    : {
        transform: `translate(${motion.transform.translateX}px, ${motion.transform.translateY}px) scale(${motion.transform.scale}) rotate(${motion.transform.rotate}deg)`,
      }

  return (
    <div className={`bird-stage cue-${cue.toLowerCase()}`}>
      <div className="bird" data-facing={facing.toLowerCase()} role="img" aria-label={cue.toLowerCase()}>
        <img
          className="bird-art"
          data-sprite={spriteAttr(motion.sprite)}
          data-paused={motion.ambientBreathingPaused ? 'true' : 'false'}
          src={SPRITE_URLS[motion.sprite]}
          alt=""
          draggable={false}
          style={style}
        />
        <span className={`bird-lamp lamp-${lampState(cue).toLowerCase()}`} aria-hidden="true" />
      </div>
      <span className="bird-ground" aria-hidden="true" />
    </div>
  )
}

function resolveMotion(cue: Cue, motionInput: MotionInput | undefined): MotionFrame {
  if (!motionInput) {
    return motionFrame({
      cue,
      listenActive: false,
      l1Triggered: false,
      l2Triggered: false,
      sequenceStartedAtMs: 0,
      now: Date.now(),
      reducedMotion: false,
    })
  }
  return motionFrame({ ...motionInput, cue })
}

function spriteAttr(sprite: MotionFrame['sprite']): string {
  return sprite.toLowerCase()
}