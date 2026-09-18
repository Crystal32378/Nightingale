/**
 * The complete string-key inventory.
 *
 * Every word the product can say or show is in here. Nothing is generated.
 * This list is also the recording script for voice work and the review sheet
 * for TTS: screen and speech are always the same string, so what is listed here
 * is exactly what a person will hear.
 */
export const STRING_KEYS = [
  'guidance.go',
  'guidance.turn.left',
  'guidance.turn.right',
  'guidance.uncertain',
  'guidance.arrived',
  'guidance.wait',
  'guidance.none',
  'ask.utterance',
  'checkpoint.next',
  'fallback.safe',
] as const

export type StringKey = (typeof STRING_KEYS)[number]

export function isStringKey(value: string): value is StringKey {
  return (STRING_KEYS as readonly string[]).includes(value)
}

export interface StringParams {
  /** registry key, never a display string */
  placeId?: string
}

export interface StringRequest {
  key: StringKey
  params?: StringParams
}

/** Notes for voice casting / recording. Not shown to anyone using the product. */
export const STRING_NOTES: Record<StringKey, string> = {
  'guidance.go': '在 checkpoint，方向就是正前方時說一次。平穩，不催。',
  'guidance.turn.left': '只有在 turn TTL 內才會出現。兩個字，不拉長。',
  'guidance.turn.right': '只有在 turn TTL 內才會出現。兩個字，不拉長。',
  'guidance.uncertain': '系統不知道時的唯一一句。承認，然後留下。不要有歉意的語氣。',
  'guidance.arrived': '到站。收尾，不慶祝。',
  'guidance.wait': '空字串。休息時什麼都不說，這是刻意的。',
  'guidance.none': '空字串。行程尚未開始。',
  'ask.utterance': '幫使用者問路的那一句。清楚、音量足夠讓旁邊的人聽見一次就懂。',
  'checkpoint.next': '下一個 checkpoint 的標籤，畫面用。',
  'fallback.safe': 'validator 擋下輸出時的靜態退路。與 guidance.uncertain 同字。',
}
