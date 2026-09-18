import type { Cue } from '../engine/types'

const CUE_LABEL: Record<Cue, string> = {
  QUIET: 'quiet',
  READY: 'ready',
  LEFT: 'left',
  RIGHT: 'right',
  ASK: 'asking',
  ARRIVED: 'arrived',
}

/**
 * The bird on screen shows exactly what the physical bird would do — nothing
 * more. There is no alarm state and no red: when someone is resting, the bird
 * looks identical to idle, from the outside and from across a waiting room.
 */
export function NightingaleBird({ cue }: { cue: Cue }) {
  return (
    <>
      <svg className={`bird ${cue.toLowerCase()}`} viewBox="0 0 120 120" role="img" aria-label={CUE_LABEL[cue]}>
        <ellipse className="body" cx="60" cy="68" rx="30" ry="34" />
        <circle className="body" cx="60" cy="36" r="20" />
        <path className="wing-left" d="M32 58 q-14 12 -4 30 q12 -6 16 -22 z" />
        <path className="wing-right" d="M88 58 q14 12 4 30 q-12 -6 -16 -22 z" />
        <path className="body" d="M55 38 l-12 5 l12 5 z" />
        <circle className="lamp" cx="60" cy="72" r="9" />
      </svg>
      <span className="cue-label">{CUE_LABEL[cue]}</span>
    </>
  )
}
