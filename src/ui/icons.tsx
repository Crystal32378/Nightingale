/**
 * Icons and the Nightingale mark.
 *
 * Every icon is a single stroke-based gesture, drawn to be read at a glance
 * by someone who may not be wearing their reading glasses: one shape, one
 * meaning, nothing thinner than 2px at 24px size. Icons REINFORCE the words
 * they sit beside — they never replace them. The words are the verified
 * strings and they stay exactly as recorded.
 *
 * The mark: one plump body, one tail, one beak, and the lamp on the chest.
 * The lamp is the brand signature — it is the only non-ink shape, here and
 * on the physical bird.
 */

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

interface IconProps {
  className?: string
}

/** 幫我問 — a speech bubble. The phone speaks for you. */
export function IconAsk({ className = 'icon' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

/** 休息 — pause. Two bars, the oldest "wait a moment" there is. */
export function IconRest({ className = 'icon' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" {...stroke} strokeWidth={2.4}>
      <path d="M9 5v14M15 5v14" />
    </svg>
  )
}

/** 繼續 / 開始 — play. Walking again. */
export function IconResume({ className = 'icon' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M8 5.5 L18.5 12 L8 18.5 Z" />
    </svg>
  )
}

/** 再說一遍 — a circular arrow. "Once more", the world over. */
export function IconAgain({ className = 'icon' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.4" />
      <path d="M3.5 3.9v4.5h4.5" />
    </svg>
  )
}

/** 好了 / 已抵達 — a check. Settled. */
export function IconDone({ className = 'icon' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" {...stroke} strokeWidth={2.4}>
      <path d="M4.5 12.5 L10 18 L19.5 6.5" />
    </svg>
  )
}

/** 目前位置 — you are here: a dot held in a ring. */
export function IconCurrent({ className = 'icon' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** 目的地 — a flag. Where the feet are going. */
export function IconDestination({ className = 'icon' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M6 21V4" />
      <path d="M6 4.5h11l-2.5 3.5L17 11.5H6" />
    </svg>
  )
}

/** 路線進行中 — a route: two points, one curving path between them. */
export function IconRoute({ className = 'icon' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <circle cx="5.5" cy="18.5" r="2.2" />
      <circle cx="18.5" cy="5.5" r="2.2" />
      <path d="M5.5 16.3C5.5 10 10 14 12 12c2-2 6.5-.5 6.5-4.3" />
    </svg>
  )
}

/** The Nightingale mark. */
export function LogoMark({ className = 'logo-mark' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M9 47 L25 36 L28.5 41.5 L14 52 Z" fill="currentColor" />
      <circle cx="35" cy="32" r="17.5" fill="currentColor" />
      <path d="M50.5 24.5 L63 29 L50.5 33.5 Z" fill="currentColor" />
      <circle cx="42.5" cy="26" r="2.3" fill="var(--paper)" />
      <path
        d="M25 36 C29 42 34 45 40 45.5"
        fill="none"
        stroke="var(--paper)"
        strokeOpacity="0.55"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="37" cy="40" r="3.8" fill="var(--glow)" />
    </svg>
  )
}
