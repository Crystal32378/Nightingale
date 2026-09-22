# 接手筆記 — 2026-09-22

給下一個 session 的。讀完這份就能接著做，不用重新推導。

Crystal 不是工程背景，**回覆請用中文**；程式碼、檔名、型別、指令維持英文。

---

## 現在在哪裡

- 最後確認：**2026-09-22**
- 工作區乾淨（`git status --porcelain` 無輸出）
- **UI 分支已合併進本機 `main`**（PR #1，`ui/nightingale-companion`，福 Final PASS 於 `5f24dce`）。
  合併後的 `main` 與 `5f24dce` 內容完全相同。
- **本機 `main` 還沒 push** —— `origin/main` 停在 `19926d3`。
  push 之後 GitHub 上的 PR #1 會自動顯示為已合併。push 要 Crystal 或福在自己的終端機跑。
- `npm test` → **202 passed**（16 files），`npx tsc --noEmit` 乾淨

這份筆記不再自己抄 `HEAD` 的編號 —— 抄了就會過期，而且過期的方式很安靜。
下面那行指令才是真的。

以上是寫這份筆記當下實際查過的狀態，不是沿用前一輪的說法。
**還是自己再查一次** —— 這份筆記本身也會過時：

```bash
git fetch origin && git rev-parse HEAD origin/main && git status --porcelain
```

### 關於 push

我（在掛載資料夾的那個 Linux VM 裡）推不上去 —— 那個 shell 讀不到 Mac
鑰匙圈的 GitHub 憑證，會直接回
`fatal: could not read Username for 'https://github.com'`。
所以 push 這一步要請 Crystal 或福在她自己的終端機跑。這次已經跑完了。

授權規則（沿用）：不 rebase、不 force push、不改 commit history、不改作者。
作者 email 用 `223268516+Crystal32378@users.noreply.github.com`。

---

## 已經做完：20 句 × 2 個聲音（2026-09-19）

40 個檔都在 `public/audio/zh-TW/male|female/`，兩份 manifest 都產好了，
`npm test` 175 passed。每一句生成時都從 MiniMax 的 `audio/details` 回應
逐句核對過 `voice_info.uniq_id` / `speed` / `pitch` / `volume` / `model`，
不是看畫面認的。

對照表在 **`scripts/plan/download-guide.md`**（每一句要存成哪個檔名）。
清單是**推導出來的**，不是手寫的 —— 改了字串表就要重跑
`npx tsx scripts/export-voice-plan.ts`，否則 `src/voice/plan.test.ts` 會擋下來。

重錄任何一句之後都要再跑一次：

```bash
node scripts/voice.mjs --from-files --profile=MALE
node scripts/voice.mjs --from-files --profile=FEMALE
npm test
```

`--from-files` 不呼叫 API、不花點數：它掃 `public/audio/zh-TW/<gender>/`，
算 sha256，產生 manifest。測試會拿 manifest 裡的 `text` 逐字比對
renderer 真正會輸出的字 —— 這是防止「改了句子沒重錄」的那道閘。

輔助腳本：`scripts/claim-download.sh <female|male> <fileStem> <since-epoch>`
把 `~/Downloads` 裡最新的 MiniMax 下載搬成正確檔名，並印出長度。

### 兩趟生成，pitch 不同

| 對象 | 句數 | pitch | 哪些句子 |
| --- | --- | --- | --- |
| `PRIVATE` | 12 | **0** | `guidance.*` — 講給拿手機的人聽 |
| `PUBLIC` | 8 | **1** | `ask.utterance*` — 講給櫃台對面的陌生人聽 |

其餘完全相同：`Chinese_calm_streamer_nv1`（MALE，speed 0.9）／
`Chinese_crisp_podcaster_nv1`（FEMALE，speed 1），兩者 volume 2，
模型 `speech-2.8-hd`。

---

## MiniMax 網頁介面：踩過的坑

在 Claude 內建瀏覽器（`mcp__remote-devices__Claude_Browser__*`）操作
`https://www.minimax.io/audio/text-to-speech`。Crystal 已登入，約 **7,958 點**。

1. **輸入框是 Slate 編輯器**（`.tts-slate-editable`）。
   用 `form_input`、`execCommand('insertText')`、或直接改 DOM **都沒用** ——
   畫面上看得到字，但字數計數器一直是 0，按 Generate 完全沒反應，
   而且 `execCommand` 會把 Slate 自己的 DOM 結構洗掉。
   **必須用 `computer` 的 `type` 動作模擬真實鍵盤。** 清空用 `cmd+a` 再直接打字
   覆蓋（`Backspace` 在這個編輯器上不可靠）。
2. **右側三個 spinbutton**（Speed／Pitch／Volume）是一般 input，
   `form_input` 可以直接設，而且**重新整理後會保留**。
   要先點 `Settings` 分頁它們才會出現在 accessibility tree 裡。
3. **點數 = 字元數**，一句短句約 14 點。40 句估計 500 點上下。
4. **音檔是沒有登入保護的 CDN 連結**（`cdn.hailuoai.video/.../*.mp3`），
   可以從播放器的 `<audio>` 元素或攔 fetch 拿到，不必按 20 次下載鍵。
5. 頁面自己開的登入彈窗（popup tab）**不能操作、不能導航、不能關**，
   而且它開著的時候主分頁也動不了。要請使用者自己關。
   `tabs_context` 的列表可能是舊的 —— 關掉最後一個一般分頁會連帶收掉整個 pane，
   再用 `preview_start` 開新的就好（登入狀態會留著）。
6. `Control_Chrome__execute_javascript` / `get_page_content` 一直回
   「Google Chrome is not running」（`list_tabs` 卻能用）。**這條路放棄了，別再試。**

---

## 已經定案的決定

- **pitch 跟著「講給誰聽」走。** 理由與風險全寫在 `src/voice/profiles.ts` 的檔頭
  和 `b3f98cc` 的 commit message。同一支聲音、同樣語速、同樣用字，
  只有面對誰的時候語氣不同。測試守住這條線（差距不得超過一階）。
  **2026-09-19：Crystal 把「往前走。」和「請問，神經外科？」連著聽過了 ——
  還是同一隻鳥，PUBLIC 的 pitch 1 維持不動。** 這一關過了。
- **音量在播放端決定，不烤進檔案。** `src/voice/level.ts`：四階、
  `PRIVATE`/`PUBLIC` 兩組、超過原音量一定先壓縮再放大
  （左/右 靠子音分辨，爆掉的子音是這個產品唯一不能出的錯）。
- **registry 不再有 `verified: true` 這個勾。** 每一筆帶 `source`：
  `generic`（通用詞，例如「大門」，並寫明為什麼算通用）或 `web`（網址＋讀取日期
  ＋當時頁面上的原文）。`web` 來源的名字必須**逐字出現在引用的原文裡**，
  對不上就等同沒有來源，不准講。規則在 `src/registry/registry.test.ts`，
  不在任何人的記憶裡。理由：八筆可以記在腦子裡，四十筆不行。
- **等待期間以避免錯過為優先。** 講錯「還有時間」→ 人錯過看診；
  講錯「快到了」→ 人白走回來坐下。後果差一個量級，所以邊界一律往保守那邊倒。
  **但保守不等於改口說「快到了」** ——「快到了」本身就是一個關於現在的宣稱，
  會和下一條打架（這個矛盾是福複驗 `605d960` 時抓到的）。
  資訊不足時鳥說的是：**「我和你一起回去等。」**
  它不宣稱任何事實，只把人帶回不會錯過的位置，而且鳥沒有把人丟在那裡自己面對。
  這條要寫進候診功能的驗收。
- **即時資訊（叫號進度）不可以當成「現在」講。** 它幾十秒就過期，沒有任何模型
  能讓舊資料變新。**只有附來源與時間戳時，才描述當時的叫號進度**
  （「官網半分鐘前寫的是⋯⋯」）。否則不講數字、也不講推測，
  只說「我和你一起回去等。」或「我不確定。我陪你問。」。
  註：「還有一段時間，可以坐著。」也是推測，同樣不准在沒有時間戳時講。
- **陪伴先成立，方向才出現。** 這是句子的排序規則，不是單一句話的取捨。
  「我和你一起」（陪伴）在前，「回去等」（動作）在後。
  反過來的「我和你回去一起等」像先下達動作、再補上陪伴 —— 動作一樣，關係不一樣。
  這條規則本來就在，只是沒有被講出來：已經錄好的那句是
  「我不確定。**我陪你**問。」—— 陪伴在前，動詞在後。
  **以後新增任何一句都照這條排。** （Crystal 定的，2026-09-19。）
- **台語不用 TTS。** 見 `docs/voice-architecture.md` §7.5。
- **紅燈／30 公尺那張概念板不得出現在任何對外材料。**

## 還沒解決的

- **真正的驗收測試還沒做**：吵雜大廳、一位有點重聽的長輩，
  哪一版她第一次就聽懂。這個測試會推翻上面任何一個由耳朵做的決定。
- **registry 從 8 個科別擴到約 40 個。** 注意：科別名稱**就是真值本身**，
  沒有來源的名字不准進 registry。這件事不能外包。
- **validator 還不認得已驗證地名裡的數字和左右**（三樓電梯口、左側電梯）。
  方向已同意：讓 validator 吃 registry，已驗證的放行，沒來源的數字照擋。
- **音量按鈕已經有了，但錄好的音檔還沒被播放。** `VolumeControl.tsx`：四階、
  PRIVATE／PUBLIC 分開記、讀屏唸中文（字串在表裡）。**但播放端現在走的是瀏覽器內建的
  `speechSynthesis`** —— `public/audio/` 那 40 個檔還沒被任何東西用到，
  GainNode + Compressor 也還沒接。「爆掉的子音是唯一不能出的錯」這條線目前沒有被執行。
- **registry 的驗證規則有一個洞（2026-09-21 整理科別表時發現）。**
  `isVerifiedEntry` 檢查的是 `asWritten.includes(name)`：擋得住捏造的名字，
  **擋不住太籠統的名字**。一筆叫「內科」的 entry 引用「神經內科」當原文會通過；
  「外科」引用「神經外科」也會。而那是醫院裡兩個不同的地方。
  科別名稱可能需要完全相符。核心區的規則變更，Crystal 或福決定。
- **registry 只保證「名字是真的」，不保證「這家醫院有這個地方」。** 見下方 venue binding。

## 黑客松：Nebius x NVIDIA（2026-09-21 重新查證）

**截止：devpost 後台寫的是 2026-10-30 10:00 AM PDT ＝ 台北時間 10/31 01:00。**
之前這裡寫「10/30」、活動頁寫「10/31」，兩個都會害人 —— 前者少算一天，
後者會讓人以為是台北的 10/31 整天。以 devpost 後台為準，交件抓在台北 10/30 之內。

**賽道：Personal AI**（Crystal 決定，2026-09-21）。官方描述是
「private, always-on assistants」—— 不錄音、不上傳、模型不生成名字，
privacy 是這個賽道的語言，而這個產品本來就是這樣做的，不是為了報名才補。

**City Winner：已符合資格。** Crystal 出席了 2026-09-19 台北 Builders & Brews
（woomanpower，信義區）。交件時**必須勾選 Taipei**，否則這個資格作廢。
20 城各一名 $500，是整個賽事分母最小的獎。

規則（會決定架構，不是加分項）：

- 專案**必須跑在 Nebius Token Factory 或 Nebius AI Cloud 上**，而且**必須用至少一個
  NVIDIA 開源模型**（點名 Nemotron）。Google Cloud 出局。
- 必須有**公開 repo ＋ 開源授權**（Apache 2.0 / MIT / MPL 2.0）。本專案是 MIT，符合。
- 必須有 working demo URL、三分鐘以內的 demo 影片、README。

手上的資源：Token Factory $100、Nebius AI Cloud $100、Tavily 9000 credits、
MiniMax 約 7,600 點（40 個音檔只花了約 350）。
建議：Token Factory 跑 Nemotron 推論，AI Cloud 放 demo 網站，兩個規則都踩滿。

### 模型放在哪裡（已定方向，未實作）

**模型只做選擇題，不做問答題。** 介面是：一句話進去 → registry 裡的某個 id 出來，
或者回「不確定」。回傳不在 registry 裡的東西，validator 照擋，走
「我不確定。我陪你問。」。

- **Nemotron**（Token Factory）→ 封閉清單分類。交件版本用這個，符合規定。
- **Jev**（TypeSafe，Crystal 已開帳號；也在 Vercel AI Gateway 上，
  model id `typesafe-ai/jev`，$0.04/1M tokens，用 Vercel 金鑰即可）→
  是非題＋校準過的信心分數。**信心低於門檻就是「我不確定。我陪你問。」的開關。**
- 這一段要做成**可以換的插頭**，交件不押在還在早期的 Jev 上。
- **Tavily 的用途已定：runtime 查叫號進度。** 交件表單對 Tavily 那題的定義是
  「must make a **functional, runtime call** to the Tavily API」—— 離線抓科別建
  registry **不算**，照那樣答 Yes 是不誠實的。runtime 查叫號頁符合定義，
  而且對上 Best Use of Tavily（$3,000）。
  **界線：鳥報事實，不做推測。**
  **更正（2026-09-21）：** 這裡原本寫「現在叫到 32 號、你是 41 號，還有 9 個是算術」——**那是錯的。**
  真實頁面上「目前診號」14 分鐘內走了 **99 → 42 → 104**：過號的人回來會被插回去看。
  號碼不是排隊順序，算不出前面還有幾個人，更算不出要等多久。
  鳥能講的是**使用者自己號碼的狀態**（未報到／過號／報到）與頁面原文，附資料時間。
  不可以說「還有 N 個」，也不可以說「來得及去買東西」。決定權留在人手上。
  細節見下方「看診進度頁」。
- **Jev 是第二層，不是資格所在。** 交件版本的預設路徑必須只靠 Nemotron 就跑得動，
  評審拿到 repo 才測得起來；Jev 用 flag 控制，可以關掉。
  附帶好處：表單問「Nemotron 跟你用過的其他模型比起來如何」，有 Jev 才有真話可答。
- 數字（叫號進度）**要由程式抓，不能由模型讀** —— 模型會讀錯而且很有自信。
  一樣用 registry 那招：抽出來的字串必須逐字出現在原始頁面裡。

**三把金鑰（Nebius、Token Factory / Vercel、Tavily）只進 `.env`。
repo 是 public，金鑰進了 git 歷史就撿不回來。**

## 看診進度頁（2026-09-21 實地查證）

**公開、不需登入、純文字。** 樣本存在 `~/Desktop/Opus Chamber/nightingale-queue-2026-09-21/`。

網址：`https://webreg.tpech.gov.tw/RegOnline3_1_2.aspx?ar=F&dt=1150921&turn=2&dpt=AG00&dptnm=…&rm=32&dr=…`
參數：`ar` 院區（F＝仁愛）、`dt` 民國日期、`turn` 午別（1 上午／2 下午／3 夜間）、
`dpt` 科別代碼、`dptnm` 科別名、`rm` 診間、`dr` 醫師。
**全部印在病人的掛號單上** —— 可以由掛號單組出網址，不需逆向任何 API。
（官方 App 也有同樣的資料，但 App 的內部介面沒有公開契約，**不要去逆向它**。）

頁面自己的聲明：「此看診資訊僅提供參考 , 實際進度仍以現場看診狀況為準。」
底部有精確到秒的「資料時間」。鳥轉述時兩樣都要帶 —— 那是來源自己的要求。

**「目前診號」有三種形狀，解析器必須全部處理：**
1. 數字，正常往前（99）
2. 數字，但**倒退**（42，同時「已叫號」是 102）—— 過號的人回來了
3. **不是數字**：「未開診」

**狀態會流動：未報到 → 號碼被叫到 → 過號。** 樣本裡 94、96 在 11 分鐘內從未報到變成過號。
「未報到」是預警，「過號」是失敗，中間那段時間是鳥能幫上忙的窗口。
**候診功能的重心因此換位置**：從「還要等多久」（答不出來）換到
「你的號碼現在是什麼狀態」（答得出來，而且救得了人）。
句子由 Crystal 定、要過字串表 lint，方向是陪伴在前：
「你還沒報到。我陪你去。」「你的號過了。我陪你去說。」（**未定稿**）

**隱私：** 這一頁列出同一診**所有人**的號碼與狀態。鳥只查使用者自己的號碼，不顯示別人的。

**網路：** 開發用的 VM 和雲端環境**都被組織 egress 規則擋住** `webreg.tpech.gov.tw`，
只有 Crystal 的瀏覽器進得去。所以原始 HTML 還沒存到（只存了頁面文字）。
正式上線由 Tavily 的伺服器去抓，不受這個影響 ——
**但 Tavily（在國外）抓不抓得到台灣政府網站，還沒驗證。** 寫解析器之前先測這個。
抓不到，就退回「讓人告訴鳥自己的號碼和狀態」那條路（不連網、不會報錯）。

## 仁愛科別表（2026-09-21）

從 `RegOnline1_0.aspx`（仁愛院區，`ZCode=F`）逐字抓了 **64 筆**，整理成點頭用的表：
`~/Desktop/Opus Chamber/nightingale-registry-renai-2026-09-21/departments-review.md`
分三堆（**只是建議，決定是 Crystal 的**）：A 建議收 33 筆一般科別、
B 建議不收 9 種疫苗／計畫／自費特診、C 要判斷 19 筆子門診與青少年親善門診。

- **科別代碼不唯一**（`AH00` 同時是一般內科、感染科、M痘疫苗、COVID 門診）——
  registry 的 id 不能用醫院代碼。
- **有些名稱不適合唸**：「一般外科(直腸外、消化外)」「小兒科/健兒門診」。
  要決定唸的名字與寫的名字是否同一個字串。
- **音檔數量**：A 堆 33 × 2 句 × 2 聲音 ＝ 132 檔，交件前錄不完。
  registry 可以收全部點頭的，錄音只錄 demo 路線會走到的那幾科。

## venue binding（已想清楚，未實作；型別與測試是核心區）

**問題：** 現在 registry 只回答「這個名字是真的嗎」，不回答「這家醫院有這個地方嗎」
「它在哪裡」「現在還在嗎」。鳥可以很有自信地把人帶去一個這家醫院沒有的科，
而所有測試都會通過。

**切法：兩層。**
- 名字層：現有的 `PlaceEntry`，跟醫院無關，不動。
- 場域層：新的 `VenuePlace` ——
  `venueId`、`placeId`、`presence`（「這家有」的來源）、`location`（「在哪」的來源，**可以是 null**）。

**presence 和 location 必須是兩個獨立的來源**：presence 有線上來源（科別表那一頁），
location 目前沒有 —— 樓層可能只存在大廳牌子上。
診間號有來源（看診進度頁的「診間：32」），樓層沒有。
型別要能表達「我知道這裡有，但我不知道在哪」——
鳥說「仁愛有神經外科」，同時說「我不確定在幾樓。我陪你問。」

**等 Crystal 決定的三件：**
1. 接不接受第三種來源 `kind: 'onsite'`（現場照片＋拍攝日期＋牌子原文）。
   接受的話拍攝規則要跟型別一起定：**只拍指示牌，不拍人、不拍螢幕、不拍名單**
   —— public repo，不能洩漏別人的臉。
2. location 的保鮮期（90 天？還是每次實走驗收就重設？）。過期是**降級**，不是刪除。
3. `VenuePlace` 放 `src/registry/venue.ts`（建議，跟真值同一個禁區）還是 `src/venue/`。

## 下一棒（依序）

截止：**台北時間 2026-10-31 01:00**（devpost：10/30 10:00 PDT）。
10/12–10/15 功能凍結，10/16 起兩週是 presentation（Kimi）。

**等 Crystal（不擋其他事）**
- 科別表點頭（A／B／C 三堆）
- venue binding 三題
- 候診「未報到」「過號」兩句話的措辭

**9/22–9/23**
1. **測 Tavily 抓不抓得到 `webreg.tpech.gov.tw`**（金鑰進 `.env`）。
   這是候診功能的岔路口：抓得到走 Tavily，抓不到走「讓人告訴鳥」。
   在寫任何一行解析器之前做。

**9/23–9/24**
2. **開 `docs/hackathon-log.md`**，從第一次呼叫模型就開始記
   （用哪個 variant、為什麼、部署方式、哪些句子分類錯了）——
   交件表單有八題只有做過才答得出來，事後補不回來。
3. **平日門診時段補存看診進度頁的原始 HTML**（週末、晚上拍不到）。

**之後**
4. Nemotron 接線：封閉清單分類，fixture 評估 Nano 30B vs Super 120B 各跑一次。
5. Jev 插頭（flag 控制，關掉之後產品仍完整）。
6. `level.ts` 接 Web Audio（GainNode + Compressor），讓錄好的音檔真的被播放。
   **這段不是 Kimi 的活**。
7. 候診功能定案 → 才錄新句子（「我和你一起回去等。」等），現在錄語氣可能還會變。
8. deploy 到 Nebius AI Cloud；瀏覽器端不得有金鑰，需要一支很薄的 server proxy；
   repo 預設走 mock adapter，沒有金鑰 clone 下來也跑得起來。

## 交給 Kimi（Cline）的邊界

可以：`src/ui/styles.css` 的視覺打磨、黑客松簡報與 demo 腳本、獨立的 `mockup.html`。

不可以：`src/registry/`（真值）、`src/engine/`、`src/render/validator.ts`、
任何 `*.test.ts`。

給任務時請明確畫界線，否則兩邊同時改同一個 repo 會撞。

**2026-09-19 已發出：** `~/Desktop/Opus Chamber/BRIEFING-NIGHTINGALE-UI-長輩友善.md`
（規則部分經福複驗，附福擬的英文版可直接貼）。
分支 `ui/nightingale-companion`，從 `19926d3` 開，**不得合進 `main`**，
交付 prototype ＋ 桌機/390px 截圖 ＋ 無障礙說明 ＋ diff，停在分支等複驗。

**2026-09-22：** 第二份 briefing（`BRIEFING-NIGHTINGALE-A11Y-DIALOG.md`：問路頁焦點管理＋
讀屏中文）完成。福 Final PASS（`5f24dce`），Crystal 決定合併 —— **已合進 `main`**（PR #1）。
真人長輩測試仍是 PENDING；它判的是設計，不是程式碼，所以不擋合併。

視覺參考給了 Ato（heyato.ai，給長輩的無螢幕語音裝置）。
**只看視覺**：字體粗、對比強、暖色調、留白大、音量控制一眼看得出來是音量。
**底層不要參考** —— Ato 賭「什麼都能聊」，本專案賭「話很少但不會錯」，是相反的賭。
