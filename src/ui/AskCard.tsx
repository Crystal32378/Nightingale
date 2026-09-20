import { useEffect } from 'react'
import { label } from '../render/renderer'
import { IconAgain, IconDone } from './icons'
import { NightingaleBird } from './NightingaleBird'
import { speak } from './speech'
import { raiseContext } from './volumeStore'
import { visualLines } from './visualText'
import { VolumeControl } from './VolumeControl'

/**
 * Ask-for-me.
 *
 * The card shows the verified utterance and the phone says the same string —
 * one string, from the verified registry, with no model anywhere in the path.
 * Nothing is recorded and no reply is transcribed or parsed; what the member of
 * staff says goes to the person, not to us.
 *
 * The bird stays in the room: the small companion sits above the question,
 * lamp breathing, so the person holding the phone out is not holding it out
 * alone. The volume shown here is the PUBLIC level — this is the one moment a
 * stranger across a counter has to hear it.
 */
export function AskCard({ text, onClose }: { text: string; onClose: () => void }) {
  useEffect(() => {
    speak(text, 'ask.utterance')
  }, [text])

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
    <div className="ask-card" role="dialog" aria-label={text}>
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
