import type { RemoteAction } from './last300mClient'
import { deriveGuidance } from './remoteGuidance'
import { LAST300M_ZH } from './strings'

/**
 * The ONLY component allowed to show server-authored words. It renders plain
 * text derived by remoteGuidance.ts (sanitized, bounded, action-typed) and
 * nothing else — no markup, no interpolation, no styling decisions based on
 * text content.
 */
export function RemoteGuidanceText({ action }: { action: RemoteAction }) {
  const view = deriveGuidance(action)
  return (
    <div className={`l3-guidance l3-guidance-${view.kind}`}>
      <p className="l3-headline">{view.headline}</p>
      {view.lookFor.length > 0 ? (
        <p className="l3-lookfor">
          {LAST300M_ZH['l3.lookfor.prefix']}
          {view.lookFor.join('、')}
        </p>
      ) : null}
    </div>
  )
}
