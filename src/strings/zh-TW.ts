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
  'guidance.turn.left': '左轉。',
  'guidance.turn.right': '右轉。',
  'guidance.uncertain': '我不確定。我陪你問。',
  'guidance.arrived': '{place}，到了。',
  'guidance.wait': '',
  'guidance.none': '',
  'ask.utterance': '請問，{place}？',
  'checkpoint.next': '下一個：{place}',
  'fallback.safe': '我不確定。我陪你問。',
}
