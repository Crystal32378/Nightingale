# Nightingale Motion Study — Director's Brief（v2：sprite-first）

狀態：**探索用規格**。產出經人看過、簽核、鎖定後才進產品——同 voice manifest 哲學。

---

## 決策記錄（v1 → v2）

- **角色走像素風。** 像素小胖鳥是數位版的正式角色；實體鳥是未來的獨立工作流，
  identity 對齊屆時再處理，現在不構成約束（`NightingaleBird.tsx` 註解裡
  「exactly as on the physical bird」一說隨之放寬，實作時更新）。
- **Identity 定位**：「機器鳥，會講話，很聰明」。像素風傳達 smart companion
  device 而非真動物——真鳥開口說話會怪，像素鳥說話很自然。
- **H3 不再是必要儀器。** 本 study 的自變數是「注意是事件還是狀態」，需要
  精確控制時長；H3 的隨機性在 controlled experiment 裡是噪音，sprite 是儀器。
  保留選項：若未來想 A/B「寫實 vs 像素」這個媒介變數本身，再開 H3 輪。
- v1 的實驗設計（三級、兩階段、盲審、決策規則）**全部保留，一字未改**——
  假設與媒介無關，變的只有儀器和成本。

---

## 研究假設

我們**不知道**陪伴感的臨界點在哪。假設：焦慮中的使用者需要的不只是 ambient
生命訊號，還要一點「牠注意到我」的 contingency；但過了某個點，「被注意」會
翻轉成「被注視」或「表演」。本 study 的目的是**找出那個點**，不是預設它。

反向風險也要測：「牠注意到我」在醫院情境可能讀成被監看。注意：這隻鳥的大黑眼
是強力的注視 affordance，L2 的讀數會偏暖——審片時要知道。

---

## 實驗設計

**自變數：acknowledgment 強度**，三級（定義見下）。其餘全部鎖死（guardrails）。

**Phase 1 — 篩選**：只做 **Idle 與 Listen**，各 3 級，共 6 組 sprite 變體。
（sprite 的邊際成本極低，不需要 H3 時代的「每組 3 變體」；要變體就改影格。）

**Phase 2 — 泛化**：用 Phase 1 選出的強度帶套到 Think / Guide / Success。
**各 state 可以用不同的級**——Listen 很可能合法地比 Success 暖。

**盲審**：變體以中性代號（A/B/C…）命名，審者不知道等級。手機上、手臂長度看。
每支答兩題：「牠有在陪我嗎」0–2；「牠有在表演／讓我有壓迫感嗎」0–2。
另記錄：多遠開始看不出動作（幅度資料，非淘汰條件）。

**決策規則（事先寫死）**：採用「陪伴 ≥ 1 且 表演/壓迫 = 0（全體審者）」中
最暖的一級；平手取較安靜的（least-motion 原則）。

---

## Hard guardrails

- 不 panic、不 alarm；像素語法下即：無大位移、無連續快速影格
- identity 鎖定：同一剪影、同一 palette、同一 canvas；新顏色或新輪廓 =
  重新設計，不在本 study 範圍
- 每個變體單一動作
- **lamp 永遠是獨立圖層，不烤進 sprite**（沿用現行規則，改像素化樣式）
- 身體不承載導航 / 安全資訊（翻譯與驗收階段把關）

---

## Acknowledgment 三級（像素語法）

關鍵洞察：**像素媒介裡，「眼神接觸」就是瞳孔／高光向觀者移 1–2px。**
L0→L2 的成本幾乎是零，迭代以分鐘計——這正是選像素路線的研究優勢。

- **L0 Quiet**：自體。呼吸 1px 起伏、眨眼影格、偶爾站姿微調。
  眼睛從不朝向觀者。
- **L1 Responsive**：事件式注意。一次「察覺」：頭部 cluster 向觀者／聲源
  移 1–2px（瞳孔同向），hold < 1s，回原位。Acknowledge, then return。
- **L2 Warm**：短暫狀態。頭＋瞳孔朝向觀者、身體傾 1px、hold 1.2–1.5s、
  呼吸慢半拍，然後視線移開、回到 L0。Glance not gaze：**影格序列必須
  包含「移開」**，沒有移開的版本直接不合格。

---

## Phase 1 sprite 規格

Canvas 建議 64×64 或 96×96；顯示時 `image-rendering: pixelated`，2–3x。
基準圖：現有像素小胖鳥（圓身、小腳、胸前葉子、大黑眼）。

### Idle

- **L0**：4–6 幀循環。base / breath（胸＋1px）/ base / blink（閉眼 1 幀）。
  呼吸週期 5–6s，±20% jitter；眨眼間隔 3–7s 隨機。
- **L1**：L0 開頭插一段 notice 序列——head ＋1px 向觀者、瞳孔 ＋1px、
  hold ~0.8s、回 base；之後同 L0。
- **L2**：gaze 序列——head 向觀者、瞳孔向觀者、body 傾 ＋1px、hold
  1.2–1.5s、呼吸慢半拍、look away、settle 回 L0。

### Listen（聲源在左）

- **L0**：head 左傾 1–2px 後定住；眨眼頻率減半。注意力的表現是「更靜」。
- **L1**：進場 notice（head turn 左＋瞳孔左，< 1s）→ 完全靜定。
- **L2**：turn 左 ＋ lean ＋1px ＋ hold，中段一次慢眨眼（「理解」），再 settle。

---

## Phase 2（Phase 1 結果出來後展開）

- **Think**：沿用 Idle 入選級，整體節奏放慢；「處理中」主要由 lamp 節奏承載。
- **Guide**：方向手勢不變（轉向＋落定＋停住）；暖度只影響轉向前有沒有半拍
  察覺。導航資訊仍只走 mirror＋箭頭＋句子。
- **Success**：值得試到 L2——「我們到了」的共享一眼可能是全產品最暖的合法
  時刻：不承載資訊，且發生在任務完成後。

---

## 實作對接

- Sprite sheet 一列一個 state-level；CSS `animation: steps()` 播放；
  切 state = 換列。檔案幾 KB，天然離線。
- `birdPresentation.ts` 回傳 `{ row, fps, mode: 'loop' | 'once' }` 等
  motion token，維持純函數、可測試，與 lampState 同級。
- LEFT cue 繼續 `scaleX(-1)` mirror；lamp 維持 DOM overlay。
- 每一幀如同每一句音檔：人看過、簽核、鎖定，收進 repo（`src/assets/`）。

## 審查與驗收

盲審流程不變。「對面等候室」「第五十次」「遮眼」三測試仍是**產品驗收門檻**，
在 CSS 實作完成後執行，不作為研究階段淘汰條件。
