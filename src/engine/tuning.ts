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

/**
 * NAVIGATION concept. How long a left/right instruction stays true.
 *
 * After this, the system may no longer say which way to turn — the person has
 * had time to walk past the corner it referred to. This governs guidance, not
 * hardware.
 */
export const TURN_GUIDANCE_TTL_MS = 45_000

/** How long after an observation the person still counts as at that checkpoint. */
export const AT_CHECKPOINT_WINDOW_MS = 20_000

/** Degrees below which the way is "straight ahead" and no turn is emitted. */
export const TURN_DEADZONE_DEG = 25

/** Degrees at or above which left and right are not reliably distinguishable. */
export const TURN_AMBIGUOUS_DEG = 160

/**
 * HARDWARE SAFETY concept, and a different thing entirely from the constant
 * above. Phase 3 reference only; this code never uses it.
 *
 * It is the firmware's dead-man switch: if no new cue arrives within this long,
 * or the link drops, the bird returns itself to QUIET — motors off, lamp off —
 * without being told to. It exists because the phone can lock, be throttled in
 * a background tab, or die outright, and a bird left buzzing on one side would
 * walk someone into the wrong corridor and never stop.
 *
 * Why the two are NOT the same constant, and must never be merged:
 *
 *   TURN_GUIDANCE_TTL_MS      how long the instruction is still TRUE
 *                             (navigation; measured in a person's walking pace)
 *   HAPTIC_FAILSAFE_TIMEOUT_MS  how long until the hardware stops on its own
 *                             (safety; measured in how fast a link can fail)
 *
 * The second is much shorter on purpose, and lives in firmware precisely so it
 * keeps working when the software that owns the first has stopped running.
 */
export const HAPTIC_FAILSAFE_TIMEOUT_MS = 8_000
