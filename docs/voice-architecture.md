# 聲音架構評估（MiniMax Audio）

狀態：**評估，尚未實作**。這份文件不動 code，只回答「要怎麼接」。
Phase 2（Nemotron）仍未開始。

---

## 一句話結論

v0 用**預先生成的 canonical audio assets** 最乾淨，而且句數比想像中少很多——
把現有 registry 全部覆蓋只需要 **20 句**。runtime TTS 保留成一個 adapter，但
**不放進導航路徑**。

---

## 1. 為什麼 v0 應該用 pre-generated

Nightingale 的句子是**封閉集合**，這是整個產品刻意換來的性質。既然句子是有限
且已驗證的，就沒有理由在走廊裡即時生成。

- **一致性**：demo 影片每次錄都一樣，現場也一樣。runtime TTS 每次合成有微小差
  異，方向指令尤其不能有。
- **延遲**：轉彎指令有 TTL。網路來回 300–2000ms 會吃掉指令還有效的時間。
- **醫院網路**：地下室、電梯、金屬結構。離線可用是基本要求，不是加分項。
- **成本與點數**：20 個檔案生成一次，之後不再花點數。
- **可審**：每個檔案可以被人聽過、簽核、鎖定。runtime 生成的東西沒有人聽過就
  播出去了。

真正的風險不是「檔案多」，而是**組合爆炸**。這裡不會發生，因為只有
`ask.utterance` 和 `guidance.arrived` 帶 `{place}` 參數，而 place 來自
verified registry —— registry 有幾個地點，就有幾個檔案，沒有第三種可能。

### 句數實算

| 類型 | 句數 |
| --- | --- |
| `guidance.go` / `turn.left` / `turn.right` | 3 |
| `guidance.uncertain`（＝ `fallback.safe`，同字共用一個檔） | 1 |
| `guidance.arrived` × 8 個 registry 地點 | 8 |
| `ask.utterance` × 8 個 registry 地點 | 8 |
| `guidance.wait` / `guidance.none` | 0（空字串，靜音就是正確輸出） |
| **合計** | **20** |

Demo 路線只用到 4 個目的地，所以**最小可 demo 集合是 12 句**。
大Ｇ說的 15–25 句，工程上不只足夠，而是已經涵蓋全部。

---

## 2. Runtime TTS adapter 要不要留？

**要留，但放在核心導航路徑之外。**

建議一個 `VoiceAdapter` 介面，三個實作：

```ts
interface VoiceAdapter {
  speak(utterance: VerifiedUtterance): Promise<void>
  readonly kind: 'PREGENERATED' | 'DEVICE_TTS' | 'REMOTE_TTS'
}
```

| 實作 | 用在哪 | 是否在導航路徑 |
| --- | --- | --- |
| `PregeneratedVoiceAdapter` | 正式路徑，播 manifest 裡的檔案 | ✅ |
| `DeviceTtsVoiceAdapter` | 檔案缺失時的降級（現在的 `speechSynthesis`） | ✅（只當 fallback） |
| `MiniMaxRuntimeAdapter` | **離線** 批次生成新地點的音檔；dev panel 試聽 | ❌ |

關鍵限制寫進型別：`speak()` 只接受 `VerifiedUtterance`，也就是
**validator 已經放行的字串**。任何模型（包含未來的 Nemotron）都不可能把自由文
字直接送進聲音層——它連型別都對不上。

---

## 3. audio asset 掛在哪個 key？

**都不是 semantic key，也不是單純 string key。掛在 voice manifest 的
`utteranceId`。**

理由：

- `semantic key`（如 `RIGHT`）太粗：同一個語意在不同語言、不同語氣下不同。
- `string key`（如 `ask.utterance`）也太粗：它帶 `{place}` 參數，一個 key 對應
  8 個音檔。

所以 `utteranceId = stringKey + 參數`，例如：

```
guidance.turn.right                  → 往右手邊走。
ask.utterance#NEUROSURGERY           → 請問，神經外科？
guidance.arrived#PHARMACY            → 藥局，到了。
```

manifest 長這樣（`src/voice/manifest.zh-TW.json`）：

```json
{
  "locale": "zh-TW",
  "voiceId": "minimax:<選定的音色 id>",
  "utterances": {
    "guidance.turn.right": {
      "text": "往右手邊走。",
      "file": "audio/zh-TW/guidance.turn.right.mp3",
      "generatedAt": "2026-09-19",
      "reviewedBy": "Crystal"
    }
  }
}
```

`text` 欄位是整個設計的關鍵：**它是真相的對照點**，不是註解。

---

## 4. 怎麼保證畫面文字／語音／震動永遠不分岔

三者都從**同一個 `Instruction`** 出發，各自是純函數：

```
Instruction ──┬─→ renderer + validator ─→ verified text ─→ 畫面
              ├─→ utteranceId ─→ manifest ─→ 音檔
              └─→ deriveCue ─→ Cue ─→ 震動／燈
```

三道鎖：

1. **Build-time test**：對每一個可能的 instruction，
   `manifest[utteranceId].text === renderGuidance(instruction).screen`。
   任何一句改字而沒重錄，測試就紅。這是最重要的一個測試。
2. **Runtime 比對**：播放前做一次字串比對（很便宜）。不符就當作 miss，
   走 fallback，不播。
3. **Register lint 覆蓋 manifest**：manifest 裡的 `text` 也丟進
   `lintStringTable`，避免有人直接改 manifest 繞過字串表。

---

## 5. Fallback 階梯

由安全到不安全，**只准往下掉，不准橫跳**：

1. manifest 有檔案 **且** `text` 與 verified text 相符 → 播檔案
2. 否則 → 用裝置內建 TTS 唸**同一個 verified 字串**（不是新生成的字串）
3. 裝置 TTS 也不可用 → 只顯示文字，不出聲

**絕不做**：即時向 MiniMax 要一句沒人審過的話。靜音是合法輸出，猜錯不是。

順帶一提，這條階梯跟 validator 的 `fallback.safe` 是同一個哲學：
不確定的時候少說，而不是說得漂亮。

---

## 6. Voice casting：建議的測試句

大Ｇ列的 7 句方向正確。我建議調整成下面 8 句，理由寫在右邊。
其中兩句不在產品字串表裡，標記為 **non-shipping**，只用來聽語氣。

| # | 句子 | 測什麼 |
| --- | --- | --- |
| 1 | `往右手邊走。` | 方向、短指令 |
| 2 | `往左手邊走。` | **配對測**：兩句尾音必須一模一樣。若語氣有差，使用者會開始用語氣判斷方向，那比唸錯還危險 |
| 3 | `往前走。` | 最短句。聽「不催」 |
| 4 | `我不確定。我陪你問。` | **最難的一句**。兩句之間的停頓、以及「我不確定」不可以有歉意 |
| 5 | `請問，神經外科？` | 對第三人說的話。要有音量但不能表演；旁邊的人要聽一次就懂 |
| 6 | `神經外科，到了。` | 專有名詞 + 收尾。不慶祝 |
| 7 | `藥局，到了。` | 第二個專有名詞，字數不同。聽同一句型是否穩定 |
| 8 | `好，我們先休息。`（non-shipping） | 純語氣測試。產品裡休息是**不出聲**的，這句不會上線 |

大Ｇ原本的 `到這裡就好。` 也是 non-shipping：產品的收尾句是
`{place}，到了。`。想聽這種收尾語氣可以留著，但正式選角請用第 6、7 句。

### 怎麼聽（casting 判準）

- 句尾**下沉**，不上揚。上揚就是客服腔。
- 語速約每字 0.22–0.28 秒。再慢會像在哄人。
- 沒有 smile voice。聽得出在笑就不對。
- 「我不確定」不可以有歉意，也不可以有困惑。是陳述。
- 8 句之間音色穩定，不會某一句突然變年輕或變甜。
- 在 60dB 環境噪音（＝門診大廳）下，第 5 句要能被第三人聽懂。

判準一句話：**competent before cute。鳥可以可愛，聲音要讓人信任。**

---

## 7. 點數怎麼花最划算

建議順序，理由是**耳朵是 Crystal 的，不是我的**：

1. **選角階段（花很少）**：在 MiniMax 網頁介面上，用上面 8 句試 3–5 個音色。
   每個音色 8 句，5 個音色＝40 次生成。這一步不需要 API，也不需要我。
2. **選定音色後（一次花完）**：把 voice id 給我，我寫批次腳本一次生成 20 句
   canonical assets、算 checksum、產生 manifest、加上對照測試。
3. **之後**：只有新增 registry 地點時才需要再生成，每個地點 2 句。

要我跑第 2 步，我需要 MiniMax 的 API key（放 `.env`，加進 `.gitignore`，不會進
版控）。目前這個 session 沒有 MiniMax 的存取權，所以第 1 步請妳先做，或把 key
給我我來做。

---

## 8. 順便一個必須說的發現

硬體概念圖上有兩件事跟已鎖定的產品規則衝突，現在講比之後改便宜：

1. **「A soft red light helps you know it's not the right way」** —— 紅燈。
   整份設計刻意沒有任何紅色警示狀態。走錯路時亮紅燈，等於在公開場合替這個人掛
   上「這個人有狀況」的標記，而那正是這個功能存在的理由要避免的事。
   建議：走錯路時鳥**回到 QUIET**，畫面說 `停一下，方向反了。`（描述情況，不描
   述人），需要時再由使用者自己按「幫我問」。
2. **「Go straight for 30 metres, then turn right. Radiology is on your left.」**
   —— 這句話在現在的架構下會被 validator 當場擋下：有 engine 沒提供的距離
   （30 metres）、一句話塞了三個 job、而且「Radiology is on your left」是未經驗證
   的位置宣稱。

這兩點是行銷圖上的，不是 code 裡的。但如果要拿這張圖對外，建議先改掉，否則
demo 時會被問到「你們說不做紅燈，圖上為什麼有」。
