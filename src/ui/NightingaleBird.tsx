import type { Cue } from '../engine/types'

/**
 * The bird is the product. It is not a status icon.
 *
 * It shows exactly what the physical bird would do and nothing more. There is
 * no alarm state and no red anywhere: while someone is resting the bird is
 * indistinguishable from idle, from across a waiting room. A visible "this
 * person has a problem" marker would undo the only reason the feature exists.
 *
 * When there is a live direction the bird turns to face it. Mirroring is
 * presentation of the same cue — it invents nothing the engine did not say.
 */
export function NightingaleBird({ cue }: { cue: Cue }) {
  return (
    <div className={`bird-stage cue-${cue.toLowerCase()}`}>
      <svg className="bird" viewBox="0 0 240 210" role="img" aria-label={cue.toLowerCase()}>
        <defs>
          <linearGradient id="ng-belly" x1="0.15" y1="0" x2="0.35" y2="1">
            <stop offset="0%" stopColor="#FCF3E5" />
            <stop offset="100%" stopColor="#E8D5B9" />
          </linearGradient>
          <linearGradient id="ng-back" x1="0.1" y1="0" x2="0.85" y2="1">
            <stop offset="0%" stopColor="#B08A63" />
            <stop offset="100%" stopColor="#8C6A4B" />
          </linearGradient>
          <linearGradient id="ng-wing" x1="0.1" y1="0" x2="0.9" y2="1">
            <stop offset="0%" stopColor="#A98253" />
            <stop offset="100%" stopColor="#8A6742" />
          </linearGradient>
          <linearGradient id="ng-tail" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9E7A55" />
            <stop offset="100%" stopColor="#7D5C3E" />
          </linearGradient>
          <radialGradient id="ng-glow">
            <stop offset="0%" stopColor="var(--glow)" stopOpacity="0.5" />
            <stop offset="65%" stopColor="var(--glow)" stopOpacity="0.1" />
            <stop offset="100%" stopColor="var(--glow)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <ellipse className="shadow" cx="118" cy="199" rx="58" ry="7" />

        {/* tail — drawn first so its base disappears under the body */}
        <path
          d="M104 116 C 74 108, 40 114, 8 136 C 34 152, 72 158, 104 150 Z"
          fill="url(#ng-tail)"
        />

        {/* body */}
        <ellipse cx="114" cy="124" rx="62" ry="54" fill="url(#ng-belly)" />

        {/* back, over the body so the whole silhouette reads as one bird */}
        <path
          d="M56 126 C 56 94, 80 68, 112 60 C 128 56, 142 58, 152 65
             C 128 71, 106 88, 94 112 C 82 136, 77 158, 79 174
             C 65 162, 56 145, 56 126 Z"
          fill="url(#ng-back)"
        />

        {/* folded wing */}
        <path
          className="wing"
          d="M84 116 C 102 110, 120 122, 128 142 C 132 153, 128 163, 118 167
             C 102 162, 88 145, 83 129 C 81 123, 81 118, 84 116 Z"
          fill="url(#ng-wing)"
        />

        {/* head */}
        <circle cx="154" cy="74" r="38" fill="url(#ng-belly)" />
        {/* crown */}
        <path
          d="M120 62 C 126 40, 148 28, 170 33 C 183 37, 191 47, 191 61
             C 176 49, 148 47, 120 62 Z"
          fill="url(#ng-back)"
        />
        {/* a soft tuft, not a horn */}
        <path
          d="M146 34 C 141 25, 144 17, 153 13 C 152 21, 155 28, 161 32
             C 155 31, 150 32, 146 34 Z"
          fill="url(#ng-back)"
        />

        {/* beak */}
        <path d="M190 70 L 228 76 L 190 86 Z" fill="#4A4038" />

        {/* eye */}
        <circle cx="172" cy="66" r="6" fill="#2C2522" />
        <circle cx="174.2" cy="63.8" r="2" fill="#FFFFFF" fillOpacity="0.92" />

        {/* legs */}
        <path className="leg" d="M106 176 C 105 186, 105 191, 104 196 M95 197 L115 197" />
        <path className="leg" d="M134 174 C 133 185, 133 191, 132 196 M123 197 L143 197" />

        {/* the lamp — the only part that ever changes */}
        <circle className="halo" cx="150" cy="120" r="28" fill="url(#ng-glow)" />
        <circle className="lamp" cx="150" cy="120" r="9" />
      </svg>
    </div>
  )
}
