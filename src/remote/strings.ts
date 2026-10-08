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
  'l3.label.origin': '起點',
  'l3.label.destination': '目的地',
  'l3.input.placeholder': '跟我說你看到什麼',
  'l3.input.send': '傳送',
  'l3.button.help': '幫我問',
  'l3.reanchor.question': '你附近看得到什麼？跟我說就可以。',
  'l3.lookfor.prefix': '找找看：',
  'l3.arrived.headline': '醫院入口，到了。',
  'l3.arrived.handoff': '進門之後，服務台在左手邊。',
  'l3.notice.offline': '剛剛沒有連上。稍等一下，再說一次就可以。',
  'l3.ask.utterance': '請問，醫院的正門要怎麼走？',
  'l3.photo.button': '拍招牌',
  'l3.photo.small': '只拍招牌，避開人臉、車牌和病患資料。',
  'l3.photo.more': '照片怎麼處理',
  'l3.photo.privacy': 'Nightingale 不保存原始照片；照片會傳送給 Google Vertex AI 辨識，系統只保留結構化的路線判斷。',
  'l3.photo.remind': '只拍招牌就好，別拍到人臉、車牌和病患資料。照片會交給 Google 辨識，我們不保存原始照片。',
  'l3.photo.go': '好，拍照',
  'l3.photo.reading': '我看一下這張照片。',
  'l3.photo.stillWorking': '快好了。',
  'l3.photo.unreadable': '這張照片我打不開。用文字跟我說也可以。',
  'l3.photo.limit': '照片先休息一下。用文字跟我說也可以。',
  'l3.crossed.button': '過完了',
  'l3.confirmation.yes': '是，這些都符合',
  'l3.confirmation.cancel': '不是／不確定',
  'l3.confirmation.expired': '剛剛的確認已失效。請再輸入目前看到的路牌。',
  'l3.step.full': '全文',
  'l3.voice.label': '聲音',
  'l3.voice.female': '女聲',
  'l3.voice.male': '男聲',
  'l3.voice.quiet': '靜音',
  'l3.voice.repeat': '我在哪',
  'l3.voice.bike': '注意單車',
  'l3.voice.water': '沿路補水',
} as const

export type Last300mStringKey = keyof typeof LAST300M_ZH
