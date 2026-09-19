# 聲音架構評估（MiniMax Audio）

狀態：**架構已實作，音檔尚未產生**。推導清單、manifest、對照測試、生成腳本
都在 repo 裡，`npm test` 會驗；還沒有任何一個 mp3。
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

## 6.5 已經建好的部分（尚未生成任何音檔）

以下都已經進 repo，跑 `npm test` 會驗，**完全沒有花到點數**：

| 檔案 | 做什麼 |
| --- | --- |
| `src/voice/utterances.ts` | 從 string table + verified registry **推導**出 canonical 清單。腳本裡沒有任何一句手打的句子 |
| `src/voice/manifest.ts` | manifest 型別、`checkManifest`（對照 renderer）、`isPlayable`（播放前逐字比對） |
| `src/voice/utterances.test.ts` | 15 個測試：清單筆數、id 唯一、每句等於 renderer 輸出、每句通過 register lint、manifest 偵測改字／缺檔／孤兒 |
| `scripts/generate-voice.ts` | MiniMax T2A 批次生成。三種模式：`voice:plan`（只印、不呼叫）、`voice:casting`、`voice:canonical` |
| `.env.example` | key 的位置。`.env` 與 `casting/` 都已 gitignore |

實際清單（`npm run voice:plan` 的輸出）：**20 句、140 個中文字**。
casting 一個音色 8 句、56 個字；四個音色一起試也只有 224 個字。

`SPOKEN_KEYS` 決定哪些 key 會被唸；`label.*`、`checkpoint.next`、`place.bare`
是畫面用的，永遠不會送進聲音層。`fallback.safe` 與 `guidance.uncertain` 是同一
串字，所以共用同一個音檔，不會被錄兩次然後慢慢分岔。

---

## 7. 點數怎麼花最划算

建議順序，理由是**耳朵是 Crystal 的，不是我的**：

1. **選角階段（花很少）**：在 MiniMax 網頁介面上，用上面 8 句試 3–5 個音色。
   每個音色 8 句，5 個音色＝40 次生成。這一步不需要 API，也不需要我。
2. **選定音色後（一次花完）**：把 voice id 給我，我寫批次腳本一次生成 20 句
   canonical assets、算 checksum、產生 manifest、加上對照測試。
3. **之後**：只有新增 registry 地點時才需要再生成，每個地點 2 句。

要我跑第 2 步，我需要 MiniMax 的 API key（放 `.env`，加進 `.gitignore`，不會進
版控）。

### 目前的候選音色（Crystal 初選）

| voice id | 備註 |
| --- | --- |
| `Chinese_crisp_podcaster_nv1`（女） | 咬字清楚，注意是否偏「播報」 |
| `Chinese_patitent_teacher`（女） | 耐心、低喚起，最接近護理師的方向 |
| `Chinese_casual_guide_nv1`（男） | 口語、不正式，注意是否偏輕鬆 |
| `Chinese_calm_streamer_nv1`（男） | 平穩，注意是否偏「陪伴型」而非「執業型」 |

四個都在合理區間。判準仍然是第 6 節那張表，特別是：
`往左手邊走。` 與 `往右手邊走。` 兩句的尾音必須一致，以及 `我不確定。` 不可以帶
歉意。

---

## 7.5 台語：不採用 TTS（2026-09-19 決議）

Crystal 聽過 MiniMax 的台語音色，判定**不合格**——「語調非常生硬，像是不會講的
人硬要說台語」。這不是調參數能修的，是模型沒有那個語感。

所以 build brief 原本那條「台語不能是翻譯，必須人工撰寫、人工驗證」之外，再加
一條：

> **台語也不能是合成的。**

這對架構沒有損傷。manifest 不在乎音檔怎麼來的，它只比對 `text` 欄位是否逐字等於
renderer 的輸出；播放層讀檔案，不讀 API。所以台語走**真人錄音**，一行 code 都不
用改——`--from-files` 模式本來就是為這種情況準備的。

台語只有 20 句、140 個字，真人錄一小時內錄得完。

順帶一個值得記下的可能性：voice principle 寫的是「做過很多次、平穩、不急、不覺
得使用者笨」——那本來就是在描述一位資深護理師。如果找得到一位會講台語也會講華
語的人來錄，兩種語言的 Nightingale 會是同一個人，而不是兩個不同的存在。中文那邊
如果哪天覺得合成聲音差一點，同一條路也成立。

**點數不該花在台語上**，因為合成的結果不能用。

---

## 7.6 選定的聲音（2026-09-19）

| | voice id | speed | pitch | volume | 備註 |
| --- | --- | --- | --- | --- | --- |
| 女聲 | `Chinese_crisp_podcaster_nv1` | 1 | 1 | 2 | 咬字清楚，不拖 |
| 男聲 | `Chinese_calm_streamer_nv1` | 0.9 | 1 | 2 | 平穩，語速略慢 |

兩個都留，不是為了豐富——人對聲音的可聽度差異很大，在醫院裡那不是裝飾。同一批
文字、同樣的 register，只有說話的人不同。設定記在 `src/voice/profiles.ts`，manifest
也會記，這樣重新生成才會跟當初聽過並認可的聲音一樣。

**注意**：那些數字是從網頁介面讀來的，網頁與 API 的刻度和預設值不保證相同。第一
批生成出來必須跟網頁試聽比對過才算數；有差就改 `profiles.ts`，不要在呼叫端改。

---

## 8. 對外材料的兩個禁止項

早期的硬體概念圖上有兩件事與已鎖定的產品規則衝突。**那張圖不進任何對外材料**
（README、demo、投稿、簡報都不放）。這裡只記規則，不引原文，避免規則本身被截圖
誤讀成產品規格。

1. **走錯路不亮任何警示色。** 整份設計刻意沒有紅色狀態。在公開場合替一個人掛上
   「這個人有狀況」的可見標記，正是這個功能存在要避免的事。走錯路時鳥回到
   `QUIET`，畫面說 `停一下，方向反了。`（描述情況，不描述人），要不要求助由使用
   者自己決定。
2. **語音不講距離、樓層、或未經驗證的相對位置。** 「往前走幾公尺再右轉，某科在你
   左邊」這種句子在現在的架構下會被 validator 當場擋下：有 engine 沒提供的數字、
   一句塞多個 job、還有未驗證的位置宣稱。

以上兩點在 code 層面已經是硬性的：`src/render/validator.ts` 擋數字與未驗證地點，
`src/lint/register.ts` 擋一句多 job，整個 palette 裡沒有紅色。
