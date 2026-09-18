/**
 * Speech is a playback device, not a writer. It receives the verified string
 * and says it. It may not rephrase, soften, or add a single character.
 */
export function speak(text: string): void {
  if (text.trim().length === 0) return
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-TW'
    utterance.rate = 0.95
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  } catch {
    // A silent phone is an acceptable outcome. A wrong sentence is not.
  }
}
