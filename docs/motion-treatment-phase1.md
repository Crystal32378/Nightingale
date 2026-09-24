# Nightingale — Phase 1 Director's Treatment
**作者：M3 (animation director)　｜　日期：2026-09-23　｜　對象：Pixel Nightingale × IDLE/LISTEN × L0/L1/L2**

> 給下一棒（無論是像素藝術家、CSS 工程師、還是另一個 model）的精準交付文件。
> 一切先講 production reality，再講 6 個 motion studies，最後講 handoff。
> 技術詞保留英文（keyframes, sprite, frames, steps(), cubic-bezier, jitter…）

---

## 0. 先講三件 production reality — 寫在 6 個 study 之前

### 0.1 鳥**就是** pixel art — 但要對齊 native grid

`src/assets/nightingale-canonical.png` 是 **900×900 RGBA 的 PNG，native pixel grid 大約是 64×64**。檔案本身是 pixel art：放大到 900×900 是因為檔案被拿來做大尺寸顯示，瀏覽器的 bilinear smoothing 把 pixel-step 邊緣糊成「看起來像 3D 渲染」的視覺（這是我第一輪誤判的原因 — 我看 read tool 渲染的 900×900，沒意識到那是放大平滑後的結果）。

驗證方式：把 PNG 縮到 64×64 native grid 看就是清楚的 pixel art — 邊緣是 step 形狀、翅膀是 blocky patches、爪是 pixel blocks、胸口 leaf 是 flat color 區塊。縮到 16px 時只有 53 個 unique colors（純3D 渲染在 16px 會有 100–500 個 AA artifacts 顏色）。

> 也就是說，brief §3「WHY PIXEL ART」的整套論點**全部成立** — bird 本來就是用 pixel-art 邏輯畫的，900×900 只是放大顯示的歷史包袱。

**實作路徑（單一路徑，不分 A/B）：**

| 步驟 | 做法 |
|---|---|
| 1. 鎖定 native grid | 確認 64×64 是合理的編輯 grid（如果想要稍多細節可以 80×80，但不要超過 96×96） |
| 2. 重新 export BASE | 把現有 PNG 降到 64×64（nearest neighbor）作為新 BASE sprite。或者直接從原始 PSD / AI source 重 export |
| 3. 在 64×64 grid 上畫 8 個新 frame | INHALE / BLINK / ATTEND_HEAD / ATTEND_TILT / GAZE_UP / GAZE_AWAY / SHOULDER_DROP。每個 frame 共享 ≥95% 像素 |
| 4. 維持 PNG 顯示尺寸 | production 仍可顯示為 280px / 152px / 128px，由 `image-rendering: pixelated` 確保 pixel-step 邊緣不被平滑掉 |

**關鍵 CSS 設定**（這是之前 production 漏掉的）：
```css
.bird-art {
  image-rendering: pixelated;       /* 不要做 bilinear */
  image-rendering: -moz-crisp-edges;
}
```
少了這一行，64×64 native sprite 在 280px 顯示會被瀏覽器糊回 smooth，pixel-art discipline 失效。

**1-pixel 在 64×64 native = 280/64 ≈ 4.4px 在 280px 顯示**：完全 readable。Brief 的整套 1-pixel/2-pixel 振幅討論直接成立，不需要修改。

### 0.2 LISTEN 不在 production 的 Cue 列舉裡

Production 的 `Cue` 型別是 `QUIET | READY | LEFT | RIGHT | ASK | ARRIVED`。**沒有 LISTEN。**

brief §7 說「Phase 1 only studies IDLE × L0/L1/L2 and LISTEN × L0/L1/L2」，把 LISTEN 跟 IDLE 並列。但 brief 沒講 LISTEN 跟 ASK 是什麼關係。

我的判讀（請確認）：
- **ASK = 立場**：「我不確定。我陪你問。」鳥在這裡是「我要請別人幫你」這個決定的穩定姿態。
- **LISTEN = 瞬間**：人在說話，或正在讀 AskCard 上的字。這段時間裡鳥是「我正在聽」。

也就是說 LISTEN 是 ASK 的 sub-state，或者是一個新的 transient cue，由語音輸入 / AskCard 顯示 / 別人正在回話 觸發。

**我的選擇：把 LISTEN 升成新 cue，與 ASK 平級。**
- ASK cue：lamp BREATHING、身體 ATTEND（一個 settle 後 hold），這是 brief §9 已經講的
- LISTEN cue：lamp STEADY（不再是 BREATHING — 因為鳥已經在做 ask 這件事了，不是不確定）、身體朝聲音方向微轉、HOLD 期間不動
- 兩者由 engine 的某個時序信號切換（例如：ASK 被觸發後 200ms 進入 LISTEN，AskCard 關閉後 800ms 退回到 ASK 或 READY）

### 0.3 Lamp 已經是獨立的 motion layer — 不要動它

`birdPresentation.ts` 的 `LampState: DIM | STEADY | BREATHING | BLINKING` 已經在跑。新加的身體 motion 必須**概念上正交於 lamp**。規則：

- 鳥可以 hold 不動，lamp 自己 BREATHING（ASK 期間）
- 鳥可以 settle，lamp 保持 STEADY（LISTEN 期間）
- 鳥可以呼吸，lamp 維持不變（IDLE L0）

**永遠不要把 lamp 變化寫成身體動畫的副產品。** 如果身體 inhale 把胸腔往上推 1px，lamp 位置必須視覺上仍然精準貼在 chest leaf 上（也就是 lamp 元素要相對身體再反向 transform 1px）。

---

## 1. Keyframe budget — 全 6 個 study 共用一套 frame library

不管選 Path A 或 Path B，所有 study 共用同一組 key pose。請把它想成一個 sprite sheet。

| Frame | 用途 | 身體哪裡動 | 與 BASE 像素重疊率 |
|---|---|---|---|
| **BASE** | 起點，所有研究的 default | — | 100% |
| **INHALE** | IDLE L0 呼吸 | 胸 +1px、肚 +1px 寬 | ~95% |
| **EXHALE** | IDLE L0 呼吸終點 | 等於 BASE | 100% |
| **BLINK** | IDLE L0 / LISTEN 偶爾 | 眼皮下蓋 2px（瞳孔暫時不可見） | ~97% |
| **ATTEND_HEAD** | IDLE L1、LISTEN L0/L1 | 頭 +1px 上抬 | ~96% |
| **ATTEND_TILT** | LISTEN L1 / L2 | 頭向右（朝人）傾 1px | ~96% |
| **GAZE_UP** | IDLE L1、IDLE L2、LISTEN L1 / L2 | 瞳孔 +1px 上 | ~98%（只動 1 個像素） |
| **GAZE_AWAY** | IDLE L2 結尾、LISTEN L2 結尾 | 瞳孔回到 BASE 或往下 1px | ~98% |
| **SHOULDER_DROP** | IDLE L2 / LISTEN L2 結尾釋放 | 兩邊翼緣 −1px（鳥微微「呼出」） | ~95% |

**9 個 frame。** 不是 24。不是 12。是 9。其中只有 INHALE / BLINK / ATTEND_TILT / SHOULDER_DROP 是真的「重畫」，其餘 5 個是 BASE 裡挪 1–2 個像素區塊。

identity lock 不會被打破：每個 frame 共享 ≥95% 像素。讀者不會認不出同一隻鳥。

---

## 2. Production strategy — 兩層疊加

我把 motion 切成兩個 layer，這樣既符合 pixel-art 紀律，又不會被 CSS smooth interpolation 吃掉 character：

### Layer A — CSS transform（ambient）
- BASE 影像是單張，套 CSS transform
- 用途：**呼吸、settle drift、head 微動**
- 工具：`translateY(±1px)`、`scale(0.995–1.005)`、`rotate(±0.4°)`、`cubic-bezier(0.22, 0.61, 0.36, 1)`
- 為什麼 ambient 走 CSS：呼吸是 continuous easing，sprite frame swap 在這裡反而會讓呼吸變成 step jump，破壞 organic 感

### Layer B — sprite swap（state change）
- L1/L2 的「看到你」瞬間用 2 個 sprite frame 切換（BASE ↔ ATTEND_HEAD 或 GAZE_UP）
- 工具：`steps(1)` 或 `steps(2)`，配合 `animation-timing-function: steps(1, end)`
- 為什麼 state 走 sprite：pixel-art 的 state change 應該讀成「pose」，不是「transition」。frame swap 讓 1-pixel 的注意力變化明確存在

### 為什麼這樣分

| 動作 | 適合的 layer | 理由 |
|---|---|---|
| 呼吸 | A（CSS） | continuous，easing |
| 偶爾眨眼 | A+B（CSS 延遲 + sprite 切 1 frame） | ambient loop 但偶爾有 frame event |
| 偶爾 settle / 重心微調 | A（CSS） | continuous |
| L1「噢你來了」一瞥 | B（sprite） | 要被讀成「pose」 |
| L2「看著你」hold | B（sprite） + hold CSS | 切到 GAZE_UP frame，hold 1.2s，再切回 |
| L2「看向別處」釋放 | B（sprite） | 切到 GAZE_AWAY frame，立刻回 BASE |

### 實驗設計（請走盲測）

每個 study 我們出兩個版本，盲測哪個對：

- **V1 — pure CSS**：ambient 跟 state 都用 CSS transform，不出 sprite。smooth，沒有 pixel-step。
- **V2 — CSS + sprite**：ambient 走 CSS，state change 走 frame swap。

我的 prior：V2 會贏。理由是 brief §11「pixel-step 1-2 像素 = intentional character motion」，CSS smooth 會把 1px translateY 變成你看不見的 easing。

---

## 3. 六個 Motion Studies

### 3.1 IDLE — L0 QUIET
**情緒意圖**：鳥在這裡，但不看你。它過它的日子。

**Key poses**：BASE → INHALE → EXHALE → BASE。
**環境細節**：BASE 上偶爾（jitter 過的間隔，不是固定）疊一個 BLINK frame，120ms。
**動的像素**：胸口 1px 上推（INHALE）；眼皮 2px 下蓋（BLINK）。
**幀數**：3 個 sprite frame（BASE / INHALE / BLINK），其餘用 CSS。
**時間**：呼吸 5.4s ± 0.6s/cycle（jitter），BLINK 每 3.5–7s 一次（不可預測）。
**loop / hold**：continuous loop，永遠不停。
**gaze**：BASE 方向（不動）。
**注意力回到自己**：鳥永遠沒有離開過自己。
**太弱的版本**：完全沒有 INHALE、只有靜止 BASE → 「這是一張圖」不是「一隻活著的鳥」。
**太 performative 的版本**：呼吸太明顯（±3px、1.5s cycle），或 BLINK 太頻繁（每 2 秒一次）→ 變成桌面寵物。

**為什麼 L0 是基石。如果 L0 不對，整棟樓都歪。**

---

### 3.2 IDLE — L1 RESPONSIVE
**情緒意圖**：噢，你在啊。沒什麼，回去。

**Key poses**：BASE → ATTEND_HEAD + GAZE_UP → BASE。
**結構**：4-step 序列：
1. **BASE** (200ms hold)
2. **ATTEND_HEAD + GAZE_UP** (frame swap, 250ms hold)
3. **return** (回到 BASE，200ms CSS ease)
4. **回到 ambient IDLE L0** (jittered delay 2–6s，再做一次)

**動的像素**：頭 +1px 上、瞳孔 +1px 上。
**幀數**：2 個 sprite frame（BASE / ATTEND_GAZE），中間用 CSS。
**loop / hold**：triggered event，不是 continuous loop。每次 L1 由某個 cue 觸發時跑一次。
**gaze**：從 BASE 方向微微向上、向人，250ms hold，然後放手。
**注意力回到自己**：250ms hold 後鳥自然回 BASE（CSS ease-out 250ms）。
**太弱的版本**：head / gaze 變化 < 1px 或 hold < 150ms → 使用者沒注意到，變成 L0。
**太 performative 的版本**：hold 超過 600ms、加上 wing 抖動或 beak 微開 → 變成打招呼的卡通。

**L1 的存在意義是「讓使用者偶爾察覺到一次」。** 不要讓它每天都跑。trigger 頻率上限：每個 session 4–8 次。

---

### 3.3 IDLE — L2 WARM
**情緒意圖**：我看見你了。你有你自己的空間。

**Key poses**：BASE → GAZE_UP → GAZE_HOLD → GAZE_AWAY → BASE。
**結構**：5-step 序列：
1. **BASE** (300ms hold)
2. **GAZE_UP** (sprite swap, 200ms)
3. **GAZE_HOLD** (hold 1.2s — CSS `transform: none`，純粹靠 sprite frame 撐住)
4. **GAZE_AWAY** (sprite swap, 150ms — 這是 brief 講的「LOOK AWAY frame 是關鍵」)
5. **回 BASE** (CSS ease-in 250ms，回到 L0 ambient)

**動的像素**：瞳孔 +1px 上（GAZE_UP、HOLD）、瞳孔回到中線或下 1px（GAZE_AWAY）。
**幀數**：3 個 sprite frame（BASE / GAZE_UP / GAZE_AWAY）。HOLD 是 GAZE_UP 撐住。
**loop / hold**：triggered event，不是 loop。
**gaze**：上 1px（朝人）→ 撐住 1.2s → 回到中線或下 1px（看向別處）。
**注意力回到自己**：GAZE_AWAY frame 是 release，不是回 BASE 那一步。是「鳥把視線交還給世界」的瞬間。沒有這 1 frame，warm 就變成 staring。
**太弱的版本**：hold < 800ms、或沒有 GAZE_AWAY → 變成 L1（沒 hold 住）。
**太 performative 的版本**：hold > 1.8s、或加上 wing lift / chest puff → 變成「拜託你看我」。

**L2 的核心：1.2s 是上限，不是下限。** 撐過 1.5s，使用者就會覺得被注視。1.0s 是邊界 — 比 1.0s 更短，使用者讀成「瞥一眼」不是「看著我」。

---

### 3.4 LISTEN — L0 QUIET
**情緒意圖**：我在這。我接住你說的話。

**Key poses**：BASE → ATTEND_TILT → ATTEND_HOLD。
**結構**：
1. **BASE** (200ms)
2. **ATTEND_TILT** (sprite swap, 250ms transition)
3. **HOLD** (CSS，鳥停止一切 ambient motion — 包括呼吸 — 直到 LISTEN 結束)

**動的像素**：頭向右（朝聲源/朝人）傾 1px。
**幀數**：2 個 sprite frame（BASE / ATTEND_TILT）。HOLD 期間全 CSS。
**時間**：transition 250ms，HOLD 持續到 LISTEN cue 結束（幾秒到幾十秒不等）。
**loop / hold**：triggered state，HOLD 為主，沒有 loop。
**gaze**：BASE 方向（沒動眼睛 — 鳥沒抬眼看你，但它整個身體朝你）。
**注意力回到自己**：LISTEN cue 結束後 → 回到 ATTEND_TILT 250ms → 回 BASE。
**太弱的版本**：tilt < 1px、或 ambient 呼吸持續跑 → 變成 IDLE L1。
**太 performative 的版本**：tilt > 2px、或加上 head bob → 「我很認真在聽」劇場感。

**LISTEN L0 的關鍵：HOLD 期間呼吸要停。** 不是「呼吸變淺」— 是「呼吸暫停」。真的動物在 listen 的時候就是這樣。

---

### 3.5 LISTEN — L1 RESPONSIVE
**情緒意圖**：你開始說話了，我知道。

**Key poses**：BASE → ATTEND_TILT + GAZE_UP → ATTEND_HOLD。
**結構**：
1. **BASE** (150ms)
2. **ATTEND_TILT + GAZE_UP** (sprite swap, 200ms)
3. **ATTEND_HOLD** (CSS hold，呼吸暫停，gaze 持續)

**動的像素**：頭右傾 1px + 瞳孔上 1px。
**幀數**：2 個 sprite frame（BASE / ATTEND_GAZE_TILT）。
**時間**：transition 200ms，HOLD 持續到 LISTEN cue 結束。
**loop / hold**：triggered state。
**gaze**：上 1px（朝人）+ 頭朝人。**眼睛和頭**同時朝人 — 這是 L1 跟 L0 的差別。
**注意力回到自己**：LISTEN 結束 → 回 BASE 250ms。
**太弱的版本**：只轉頭不抬眼、或只抬眼不轉頭 → 「不知道是看到還是聽到」。
**太 performative 的版本**：加上眨眼、加上胸口起伏、加上任何額外動作 → 鳥在演「我在聽」。

---

### 3.6 LISTEN — L2 WARM
**情緒意圖**：我在這裡，跟你一起。

**Key poses**：BASE → ATTEND_GAZE → GAZE_HOLD → GAZE_AWAY + ATTEND_HOLD → HOLD。
**結構**：
1. **BASE** (200ms)
2. **ATTEND_GAZE** (sprite swap, 300ms — 比 L1 慢，因為這次要看著你)
3. **GAZE_HOLD** (1.2s — 撐住，不要動)
4. **GAZE_AWAY** (sprite swap, 200ms — release frame)
5. **HOLD** (回 ATTEND_TILT 但 gaze 不再向上，持續 LISTEN 結束)

**動的像素**：頭右傾 1px + 瞳孔上 1px（HOLD 階段），瞳孔回到中線（GAZE_AWAY）。
**幀數**：3 個 sprite frame（BASE / ATTEND_GAZE / ATTEND_GAZE_AWAY）。
**時間**：transition 300ms + hold 1.2s + release 200ms + 持續。
**loop / hold**：triggered state，hold 為主。
**gaze**：上 1px → 撐 1.2s → 回到中線。**release 一定要存在** — 跟 IDLE L2 一樣的邏輯。
**注意力回到自己**：release 後鳥回到「接住你」的姿態（頭朝你但不看眼睛），持續到 LISTEN 結束。
**太弱的版本**：沒有 GAZE_AWAY、或 hold < 1.0s → 變成 L1。
**太 performative 的版本**：hold > 1.5s、或加上任何身體起伏 → 鳥在乞求情感回應（絕對禁止）。

**L2 結束後，鳥不應該回 BASE — 它應該留在 ATTEND_TILT。** 因為 LISTEN cue 還沒結束，使用者還在說話。鳥回 BASE 等於「我不再聽了」，這是錯的。

---

## 4. 跨 study 的固定規則

### 4.1 Gaze 的方向是固定的
- BASE 方向：中距離（不是看手機，不是看使用者，是看房間中央某個點）
- GAZE_UP：朝使用者方向 +1px
- GAZE_AWAY：回 BASE 或再往下 1px（不是「看別的地方」，是「把視線交還」）

### 4.2 呼吸在 L0 是 ambient，在 L1/L2 的 hold 期間是暫停的
真動物在專注的時候呼吸會停。pixel art 沒有 cycle 暫停，只有 cycle 跳過 — 我們用 animation-delay jitter 達成：把 ambient 呼吸的 animation-delay 在 hold 期間設成「hold 結束後再 -2s」（讓 cycle 從中段接回去，看起來像沒停過）。

### 4.3 Jitter table（不要用隨機數，要用種子表）
呼吸 5.4s ± 0.6s → 寫死一組 8 個值（5.0, 5.8, 5.4, 6.0, 5.2, 5.6, 5.4, 5.0）並循環。
眨眼 3.5–7s → 寫死一組 6 個值（3.5, 5.0, 6.5, 4.2, 7.0, 5.5）。
L1 觸發間隔 2–6s → 寫死一組 5 個值（2.5, 4.0, 6.0, 3.5, 5.0）。
**不可隨機**。測試要可重現。production 要 deterministic（README 也已經把這個定成原則）。

### 4.4 reduced-motion 必須支援
`@media (prefers-reduced-motion: reduce)` 已經有了。在那個 mode 裡：
- ambient 呼吸：不跑（鳥靜止在 BASE）
- 眨眼：不跑
- L1/L2 frame swap：保留（這是 state change，不是 motion），但 transition 時間縮短到 0ms

---

## 5. 回答 brief §19 後面那 6 個問題

### 5.1 哪些 motion 應該保留 hard pixel cut
- L1 / L2 的 sprite frame swap：hard cut，0 transition
- GAZE_AWAY：hard cut（brief 講的關鍵 release frame，不能被 ease 吃掉）
- BLINK：hard cut（眨眼本來就是 frame，不是 transition）

### 5.2 哪些 transition 值得 in-between frame
- INHALE / EXHALE：CSS easing（不要 in-between frame，呼吸是 ambient）
- ATTEND_HEAD 的進入：CSS 250ms ease-out（從 BASE 進到 ATTEND 不需要中段 frame）
- L2 的 HOLD 結束回到 BASE：CSS ease-in 250ms

**真正不需要中段 frame 的就是 ambient。所有 state change 都要 hard cut 或極短 CSS。**

### 5.3 要不要測試不同 frame 數
要。測 3 種 sprite frame 集合：
- **F1（minimal）**：只有 BASE（9 → 1 個 sprite frame，所有 attention 用 CSS）
- **F2（medium）**：BASE + ATTEND_HEAD + GAZE_UP + GAZE_AWAY（4 個 sprite frame）
- **F3（full）**：上面那 9 個 frame 全做

盲測。prior：F2 會贏。F1 太弱、F3 太多。

### 5.4 brief 的 L0/L1/L2 實驗設計有什麼 flaw
**一個明顯的 flaw**：brief §6 講 L2 是「glance, not gaze」+ 1.0–1.5s hold，但 §3.6 LISTEN L2 也是 1.0–1.5s hold。

這兩者的 hold **時長一樣**，差別只在 IDLE 是 base-facing、LISTEN 是 tilted-facing。**那強度差別從哪來？** 我建議把 LISTEN L2 的 hold 縮短到 0.8–1.0s，讓 LISTEN L2 比 IDLE L2 **短**，因為 listening 比 watching 更需要「把注意力交還」 — 鳥盯著你看太久，會被讀成「我在等你說完」而不是「我在聽你說」。

**另一個 flaw**：L0/L1/L2 是三個獨立 trigger，但 brief 沒講 trigger 邏輯。我的建議：
- L0 = no trigger，是 ambient default
- L1 = 隨機 jitter 觸發，或「使用者按了某個按鈕」之類的低頻事件觸發
- L2 = 「使用者主動互動」觸發（可能是解鎖、長按、讀 AskCard）

不要讓 L1 和 L2 同一個 trigger — 那就分不出強度差。

### 5.5 鳥的設計有什麼 animation opportunity / risk

**Opportunity**：眼睛比例大，瞳孔 +1px 的位移**非常顯著**。我們的 GAZE_UP 跟 GAZE_AWAY 用 +1px 就有戲。

**Risk**：頭佔比相對小。頭 +1px 上抬在 64×64 native 大概是 3% 尺寸 — readable，但接近上限。**不要做頭 +2px**，會被讀成「抬頭」而不是「微微動」。

**另一個 risk**：眼睛 highlight（亮點）跟瞳孔是同一個 pixel group。GAZE_UP 把瞳孔上 1px，**highlight 要跟著上**，否則 highlight 會留在原位，看起來像「眼珠轉但亮點沒轉」 — 這是 uncanny。

**Chest leaf 是 lamp 的歸屬。** 任何 INHALE 把胸腔上推 1px，leaf/lamp 必須反向 transform −1px 才能保持視覺位置。

### 5.6 給下一棒（像素藝術家 / CSS 工程師 / 下一個 model）的 production instructions

1. **先決定路徑 A 或 B**（§0.1）。我推薦 A。
3. 如果 A：重畫 BASE 在 48×48 或 64×64 native grid，**保留同色、同比例、同 chest leaf 位置**。
4. 從 BASE 出發畫 8 個 frame（INHALE / EXHALE / BLINK / ATTEND_HEAD / ATTEND_TILT / GAZE_UP / GAZE_AWAY / SHOULDER_DROP）。每個 frame 共享 ≥95% 像素。**不要重新設計鳥**。**不要新增裝飾**。
5. CSS 部分：
   - `.bird-base { transition: transform 250ms cubic-bezier(0.22, 0.61, 0.36, 1); }`
   - `.bird-breathing { animation: ng-breath 5.4s ease-in-out infinite; animation-delay: var(--breath-jitter); }`
   - `.bird-attend { animation: ng-attend 250ms steps(1, end) both; }` （frame swap）
6. 觸發條件（state machine）：
   - IDLE / QUIET cue → L0（永遠跑）
   - IDLE / cue 改變（不是 QUIET） → 取消 L0，進 L1/L2 序列
   - LISTEN cue 觸發 → 進 L0/L1/L2 LISTEN 序列
   - 每個序列結束 → 回到 L0 ambient
7. Jitter table 寫死，**不可隨機**。
8. `prefers-reduced-motion: reduce` 保留 sprite swap，取消 ambient animation。
9. Lamp 永遠獨立。Lamp 變化不寫在 body animation 裡。
10. **透明背景**：所有 sprite frame 必須是 RGBA 透明背景（無白底、無 matte、無 halo）。原始 PNG 已經是 transparent，sprite 重畫時要保留這個。
11. **測試**：先在 desktop 確認 6 個 study 的 timing，再上 phone 確認在 ~280px 顯示尺寸下 1-pixel 是否讀得到。**Fifty-times test**：每個序列看 50 次還想看嗎？

---

## 6. Handoff 順序（建議）

1. **你拍板路徑 A 或 B**（30 分鐘決策）。
2. 我把這個 treatment 跟你 brief §7 的範圍（IDLE + LISTEN × L0/L1/L2）對齊，**砍掉任何超出這 6 個 study 的東西**。
3. 像素藝術家接手：產出 9 個 sprite frame（如果 A）。
4. CSS 工程師接手：產出兩層 animation（CSS + sprite）。
5. 盲測 6 個 study × 3 個 sprite frame 集合 = 18 組版本，在 phone 上。
6. 選定後凍結，進 `birdPresentation.ts`。
7. **第二輪**才延伸到 THINK / GUIDE / ARRIVED。

---

## 7. 一句話總結

呼吸是 L0，瞥一眼是 L1，看一眼然後放手是 L2。**1-pixel 是單位、1.2 秒是上限、release frame 不能省。** 鳥不是變得可愛，是變得「在」。