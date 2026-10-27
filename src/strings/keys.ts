/**
 * The complete string-key inventory.
 *
 * Every word the product can show or say is in here. Nothing is generated.
 * This list is also the recording script for voice work and the review sheet
 * for TTS: screen and speech are always the same string, so what is listed here
 * is exactly what a person will hear.
 *
 * `guidance.*` and `ask.*` are spoken. `label.*`, `place.*` and `checkpoint.*`
 * are screen chrome — still held to the same table and the same register lint,
 * so no proper noun and no phrasing can slip in through a component.
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
  'ask.generic',
  'checkpoint.next',
  'place.bare',
  'label.current',
  'label.destination',
  'label.ask',
  'label.rest',
  'label.resume',
  'label.start',
  'label.again',
  'label.done',
  'label.underway',
  'label.arrived',
  'label.volume.down',
  'label.volume.up',
  'label.volume.level',
  'label.where',
  'label.find',
  'label.mode.mock',
  'label.mode.nemotron',
  'label.privacy',
  'label.confirm',
  'label.yes',
  'label.no',
  'fallback.safe',
  'label.clinics',
  'label.clinics.note',
  'label.clinics.campus',
  'label.clinics.search',
  'label.clinics.loading',
  'label.clinics.none',
  'label.clinics.unavailable',
  'label.clinics.register',
  'label.clinics.source',
  'label.clinics.official',
  'label.voice',
  'label.voice.female',
  'label.voice.male',
] as const

export type StringKey = (typeof STRING_KEYS)[number]

export function isStringKey(value: string): value is StringKey {
  return (STRING_KEYS as readonly string[]).includes(value)
}

/**
 * The keys that are ever SPOKEN. Everything else is screen chrome and is never
 * sent to a voice.
 *
 * `fallback.safe` is deliberately absent: it is the same characters as
 * `guidance.uncertain`, so the two share one audio file rather than being
 * recorded twice and drifting apart.
 */
export const SPOKEN_KEYS = [
  'guidance.go',
  'guidance.turn.left',
  'guidance.turn.right',
  'guidance.uncertain',
  'guidance.arrived',
  'ask.utterance',
  'ask.generic',
] as const

export type SpokenKey = (typeof SPOKEN_KEYS)[number]

/** Spoken keys that interpolate a verified place, so they need one file per place. */
export const PLACE_BEARING_SPOKEN_KEYS = ['guidance.arrived', 'ask.utterance'] as const

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
  'guidance.turn.left': '只有在 turn TTL 內才會出現。',
  'guidance.turn.right': '只有在 turn TTL 內才會出現。',
  'guidance.uncertain': '系統不知道時的唯一一句。承認，然後留下。不要有歉意的語氣。',
  'guidance.arrived': '到站。收尾，不慶祝。',
  'guidance.wait': '空字串。休息時什麼都不說，這是刻意的。',
  'guidance.none': '空字串。行程尚未開始。',
  'ask.utterance': '幫使用者問路的那一句。清楚、音量足夠讓旁邊的人聽一次就懂。',
  'ask.generic': '尚未確認目的地時的求助句。不帶地點或使用者原文，音量足夠讓旁邊的人聽懂。',
  'checkpoint.next': '下一個 checkpoint 的標籤，畫面用，不朗讀。',
  'place.bare': '單獨一個已驗證地點名，畫面用，不朗讀。',
  'label.current': '畫面標籤，不朗讀。',
  'label.destination': '畫面標籤，不朗讀。',
  'label.ask': '按鈕文字，不朗讀。',
  'label.rest': '按鈕文字，不朗讀。',
  'label.resume': '按鈕文字，不朗讀。',
  'label.start': '示範行程入口，不朗讀。只在輸入空白、沒有查詢或辨識結果時顯示。',
  'label.again': '按鈕文字，不朗讀。',
  'label.done': '按鈕文字，不朗讀。',
  'label.underway': '狀態標籤，不朗讀。休息時不顯示任何狀態。',
  'label.arrived': '狀態標籤，不朗讀。',
  // The only strings in this table that exist BECAUSE they are read aloud —
  // by VoiceOver / TalkBack, and never drawn on screen. No recording: the
  // phone's own voice reads them, so there is no audio file and no manifest
  // entry. They are here rather than inline in a component because every word
  // this product can say belongs in this table, screen reader included.
  'label.volume.down': '讀屏用，不錄音，畫面不顯示。',
  'label.volume.up': '讀屏用，不錄音，畫面不顯示。',
  'label.volume.level': '讀屏用，不錄音，畫面不顯示。{n} 由程式代入目前級數。',
  // Typing where you want to go (indoor, before the visit starts). Screen
  // chrome only: what the person types goes to the destination interpreter,
  // never into a spoken or shown sentence.
  'label.where': '輸入框的標籤，不朗讀。只問想去哪裡，不引導輸入姓名、病歷、症狀。',
  'label.find': '送出按鈕文字，不朗讀。',
  'label.mode.mock': '標示這次是關鍵字比對（沒有 AI）判斷的，不朗讀。',
  'label.mode.nemotron': '標示這次是 Nemotron 判斷的，不朗讀。產品名照原文。',
  'label.privacy': '輸入框下方的告知，不朗讀。Nebius 帳號已開 Zero Data Retention 才能寫「處理完不保存」；不寫「不會用來訓練」或任何合規宣稱。',
  'label.confirm': '辨識出地點後先問一次，按「對」才開始引導，不朗讀。{place} 只來自已驗證地點。',
  'label.yes': '確認按鈕文字，不朗讀。',
  'label.no': '否認按鈕文字，不朗讀。按了回到輸入框重新說。',
  'fallback.safe': 'validator 擋下輸出時的靜態退路。與 guidance.uncertain 同字。',
  // Clinic lookup: the hospital's own registration pages, read through Tavily.
  // A lookup beside the walk, not part of it: it never names a floor or a
  // route, books nothing, and suggests no department for a symptom.
  'label.clinics': '查詢區塊的標題，不朗讀。',
  'label.clinics.note': '說明資料來源與範圍，不朗讀。不暗示院內位置；英文是本站翻譯。',
  'label.clinics.campus': '院區選單標籤，不朗讀。',
  'label.clinics.search': '科別搜尋框標籤，不朗讀。中英文都可以搜。',
  'label.clinics.loading': '等候醫院網站回應，不朗讀。',
  'label.clinics.none': '搜尋沒有結果，不朗讀。只說這個院區的清單沒有，不推測別處有沒有。',
  'label.clinics.unavailable': '醫院網站或 Tavily 無法使用，不朗讀。不顯示空清單，以免看起來像院區沒有門診。',
  'label.clinics.register': '每個科別旁的官方掛號頁連結，不朗讀。',
  'label.clinics.source': '資料來源網址前的標籤，不朗讀。',
  'label.clinics.official': '醫院官方網路掛號首頁連結，查不到時也一直在，不朗讀。',
  // Only the English help sentences are recorded in two voices; Chinese is the
  // device voice, which cannot be told which one to use. So the choice is only
  // shown in English, where it changes what is heard.
  'label.voice': '求助錄音的聲音選單標籤，中英文都顯示，不朗讀。',
  'label.voice.female': '選項文字，不朗讀。',
  'label.voice.male': '選項文字，不朗讀。',
}
