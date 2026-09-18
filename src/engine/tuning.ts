/**
 * Every tunable number in the product, in one file.
 *
 * ALL OF THESE ARE PROVISIONAL. They were chosen to make the Phase 1 loop
 * demonstrable, not from watching anyone walk down a real corridor. Nothing
 * outside this file should hard-code a duration or a threshold, so corridor
 * testing can move them in one place.
 */

/** Confidence halves every this many ms since the last observation. */
export const CONFIDENCE_HALF_LIFE_MS = 120_000

/** confidence >= this is FRESH. */
export const BAND_FRESH_MIN = 0.5

/** confidence >= this is DECAYING; below it, UNKNOWN. */
export const BAND_DECAYING_MIN = 0.2

/** A directional instruction is never valid longer than this. */
export const TURN_TTL_MS = 45_000

/** How long after an observation the person still counts as at that checkpoint. */
export const AT_CHECKPOINT_WINDOW_MS = 20_000

/** Degrees below which the way is "straight ahead" and no turn is emitted. */
export const TURN_DEADZONE_DEG = 25

/** Degrees at or above which left and right are not reliably distinguishable. */
export const TURN_AMBIGUOUS_DEG = 160

/**
 * Phase 3 reference only, not used by this code: the firmware must re-arm the
 * bird to QUIET this long after a cue if no new cue arrives, and immediately on
 * disconnect. That duplication of `turnExpiresAt` is deliberate — a bird that
 * keeps pointing left after the phone dies would walk someone into the wrong
 * corridor and never stop.
 */
export const BIRD_CUE_TTL_MS = 8_000
