/**
 * Casting lines, for choosing a voice. Two are NOT product strings — they exist
 * only to hear a voice handle that register, and are marked so they can never
 * be mistaken for something shippable.
 */
export const CASTING_LINES: Array<{ id: string; text: string; listenFor: string; shipping: boolean }> = [
  { id: 'cast.right', text: '往右手邊走。', listenFor: '方向、短指令', shipping: true },
  { id: 'cast.left', text: '往左手邊走。', listenFor: '與上一句尾音必須一致', shipping: true },
  { id: 'cast.go', text: '往前走。', listenFor: '最短句，不催', shipping: true },
  { id: 'cast.uncertain', text: '我不確定。我陪你問。', listenFor: '承認之後留下，不帶歉意', shipping: true },
  { id: 'cast.ask', text: '請問，神經外科？', listenFor: '對第三人說，清楚但不表演', shipping: true },
  { id: 'cast.arrived-clinic', text: '神經外科，到了。', listenFor: '專有名詞 + 收尾，不慶祝', shipping: true },
  { id: 'cast.arrived-pharmacy', text: '藥局，到了。', listenFor: '不同字數，句型是否穩定', shipping: true },
  { id: 'cast.rest', text: '好，我們先休息。', listenFor: '語氣測試（產品裡休息是不出聲的）', shipping: false },
]
