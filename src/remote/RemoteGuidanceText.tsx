import type { RemoteAction } from './last300mClient'
import { deriveGuidance } from './remoteGuidance'
import { outdoorStrings, type OutdoorLocale } from './locale'

/**
 * The ONLY component allowed to show server-authored words. It renders plain
 * text derived by remoteGuidance.ts (sanitized, bounded, action-typed) and
 * nothing else — no markup, no interpolation, no styling decisions based on
 * text content.
 */
export function RemoteGuidanceText({ action, locale = 'zh-TW', routeId }: { action: RemoteAction; locale?: OutdoorLocale; routeId?: string }) {
  const view = deriveGuidance(action, locale, routeId)
  return (
    <div className={`l3-guidance l3-guidance-${view.kind}`}>
      <p className="l3-headline">{view.headline}</p>
      {view.lookFor.length > 0 ? (
        <p className="l3-lookfor">
          {outdoorStrings(locale)['l3.lookfor.prefix']}
          {view.lookFor.join(locale === 'en' ? ' / ' : '、')}
        </p>
      ) : null}
    </div>
  )
}
