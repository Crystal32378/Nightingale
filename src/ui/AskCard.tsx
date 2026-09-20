import { useCallback, useEffect, useRef } from 'react'
import { label } from '../render/renderer'
import { IconAgain, IconDone } from './icons'
import { NightingaleBird } from './NightingaleBird'
import { speak } from './speech'
import { raiseContext } from './volumeStore'
import { visualLines } from './visualText'
import { VolumeControl } from './VolumeControl'

/** Set while a card is open; App reads it after lifting inert, to bring focus home. */
export let wantFocusReturn = false

export function acknowledgeFocusReturn(): void {
  wantFocusReturn = false
}

const FOCUSABLE =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

/**
 * Ask-for-me.
 *
 * The card shows the verified utterance and the phone says the same string —
 * one string, from the verified registry, with no model anywhere in the path.
 * Nothing is recorded and no reply is transcribed or parsed; what the member of
 * staff says goes to the person, not to us.
 *
 * While this card is open, it is the whole world for the keyboard too. Focus
 * moves to the card itself on open — never onto 好了, which must never fire by
 * accident, and never onto 再說一遍, which raises the volume. Tab and
 * Shift+Tab loop inside the card, Escape closes it, and the background stays
 * inert for as long as the card is open. On close, focus goes home to the
 * 幫我問 button that opened it — a person always knows where they came back
 * to.
 */
export function AskCard({ text, onClose }: { text: string; onClose: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    speak(text, 'ask.utterance')
  }, [text])

  // Focus goes in on open. Coming home is a two-body problem: the background
  // is inert until the card unmounts, so the card cannot focus anything in
  // its own cleanup — it asks (wantFocusReturn) and App answers after the
  // inert flag lifts.
  useEffect(() => {
    wantFocusReturn = true
    cardRef.current?.focus()
  }, [])

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const card = cardRef.current
      if (!card) return
      const focusable = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (event.shiftKey) {
        // Wrap around the front: from the card itself or the first control,
        // backwards lands on the last.
        if (active === card || active === first || !card.contains(active)) {
          event.preventDefault()
          last.focus()
        }
      } else if (active === last || !card.contains(active)) {
        event.preventDefault()
        first.focus()
      }
    },
    [onClose],
  )

  // The same string, broken where it is already punctuated. Not a second string.
  // The question mark is notation for the voice; on screen the upward arc of
  // the question is carried by the layout, not by a glyph.
  const lines = visualLines(text)

  const again = () => {
    // Asking to hear it again is evidence it was not heard: one step louder,
    // and it stays there (levelAfterRepeat in voice/level.ts).
    raiseContext('PUBLIC')
    speak(text, 'ask.utterance')
  }

  return (
    <div
      className="ask-card"
      role="dialog"
      aria-modal="true"
      aria-label={text}
      tabIndex={-1}
      ref={cardRef}
      onKeyDown={onKeyDown}
    >
      <div className="ask-bird">
        <NightingaleBird cue="ASK" />
      </div>
      {lines.map((line, index) => (
        <p key={index} className={`ask-line${index === lines.length - 1 && lines.length > 1 ? ' subject' : ''}`}>
          {line}
        </p>
      ))}
      <VolumeControl context="PUBLIC" />
      <div className="ask-actions">
        <button onClick={again}>
          <IconAgain />
          {label('label.again')}
        </button>
        <button className="primary" onClick={onClose}>
          <IconDone />
          {label('label.done')}
        </button>
      </div>
    </div>
  )
}
