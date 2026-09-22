/**
 * Punctuation is the notation of the voice.
 *
 * The string table keeps every 。，？ because the recorded voice reads them as
 * pauses — they are sheet music. But on screen their job is done by space and
 * line breaks: a trailing 。 adds nothing to 「往前走」 standing alone in a
 * panel, and the comma in 「請問，神經外科？」 has always been rendered as a
 * line break in the ask card.
 *
 * This module is the single place where the written sentence becomes signage.
 * The string itself is untouched: speech and aria-labels still receive every
 * character, exactly as recorded.
 */
export function visualLines(text: string): string[] {
  return text
    .split(/[，。]/)
    .map((line) => line.replace(/[？！；：]+$/, ''))
    .filter((line) => line.length > 0)
}
