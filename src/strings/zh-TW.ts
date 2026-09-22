import type { StringKey } from './keys'

/**
 * zh-TW strings. Hand written, not translated, not generated.
 *
 * Voice principle: someone who has done this many times. Steady, unhurried,
 * and never sounding as though the person needing directions is slow.
 *
 * `{place}` is interpolated only from the verified place registry.
 *
 * Taigi is out of v0 scope. When it returns it will be a separately written and
 * separately human-verified table, never a translation of this one.
 */
export const ZH_TW: Record<StringKey, string> = {
  'guidance.go': '往前走。',
  'guidance.turn.left': '往左手邊走。',
  'guidance.turn.right': '往右手邊走。',
  'guidance.uncertain': '我不確定。我陪你問。',
  'guidance.arrived': '{place}，到了。',
  'guidance.wait': '',
  'guidance.none': '',
  'ask.utterance': '請問，{place}？',
  'checkpoint.next': '下一個：{place}',
  'place.bare': '{place}',
  'label.current': '目前位置',
  'label.destination': '目的地',
  'label.ask': '幫我問',
  'label.rest': '休息',
  'label.resume': '繼續',
  'label.start': '開始',
  'label.again': '再說一遍',
  'label.done': '好了',
  'label.underway': '路線進行中',
  'label.arrived': '已抵達',
  // Read aloud by VoiceOver and TalkBack, never drawn on screen: the control
  // itself is an icon and four bars. Someone who cannot see the bars still has
  // to know which button is louder and where the level stands, and they must
  // hear it in the language the rest of the product speaks.
  'label.volume.down': '降低音量',
  'label.volume.up': '提高音量',
  'label.volume.level': '音量第 {n} 級，共 4 級',
  'fallback.safe': '我不確定。我陪你問。',
}
