import { useEffect } from 'react'
import { speak } from './speech'

/**
 * Ask-for-me.
 *
 * The card shows the verified utterance and the phone says the same string —
 * one string, from the verified registry, with no model anywhere in the path.
 * Nothing is recorded and no reply is transcribed or parsed; what the member of
 * staff says goes to the person, not to us.
 */
export function AskCard({ text, onClose }: { text: string; onClose: () => void }) {
  useEffect(() => {
    speak(text)
  }, [text])

  // The same string, broken where it is already punctuated. Not a second string.
  const lines = text.split('，')

  return (
    <div className="ask-card" role="dialog" aria-label={text}>
      {lines.map((line, index) => (
        <p key={index} className={`ask-line${index === lines.length - 1 && lines.length > 1 ? ' subject' : ''}`}>
          {line}
        </p>
      ))}
      <div className="ask-actions">
        <button onClick={() => speak(text)}>再說一次</button>
        <button className="primary" onClick={onClose}>
          好了
        </button>
      </div>
    </div>
  )
}
