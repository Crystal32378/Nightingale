/**
 * Last-300m page strings. Hand written, zh-TW, same register discipline as
 * the main table (no-blame / one-job / no-performance) — enforced by
 * remoteGuidance.test.ts through the same lintStringTable the registry uses.
 * Kept local to the last-300m flow on purpose: the indoor registry, its
 * spoken keys and its recordings are not loosened by this page.
 */
export const LAST300M_ZH = {
  'l3.start.promise': '牠知道就帶你。牠不知道，就陪你問。',
  'l3.start.button': '開始',
  'l3.label.next': '下一個地點',
  'l3.label.current': '目前位置',
  'l3.label.destination': '目的地',
  'l3.input.placeholder': '跟我說你看到什麼',
  'l3.input.send': '傳送',
  'l3.button.help': '幫我問',
  'l3.reanchor.question': '你附近看得到什麼？跟我說就可以。',
  'l3.lookfor.prefix': '找找看：',
  'l3.arrived.headline': '醫院入口，到了。',
  'l3.arrived.handoff': '進門之後，服務台可以帶你到下一站。',
  'l3.notice.offline': '剛剛沒有連上。稍等一下，再說一次就可以。',
  'l3.help.utterance': '我不太確定現在的位置。',
} as const

export type Last300mStringKey = keyof typeof LAST300M_ZH
