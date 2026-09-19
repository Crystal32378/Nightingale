# 接手筆記 — 2026-09-19

給下一個 session 的。讀完這份就能接著做，不用重新推導。

Crystal 不是工程背景，**回覆請用中文**；程式碼、檔名、型別、指令維持英文。

---

## 現在在哪裡

- 最後確認：**2026-09-19 晚間**
- 工作區乾淨（`git status --porcelain` 無輸出）
- **本機 `main` 比 `origin/main` 多兩個 commit，還沒 push** ——
  `605d960`（registry 改用 `source`）以及這份筆記所在的這一個
- 遠端 `origin/main` 停在 `d834c4d`（「The bird has a voice」，40 個音檔）
- `npm test` → **191 passed**，`npx tsc --noEmit` 乾淨（福獨立複驗過）

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
- **台語不用 TTS。** 見 `docs/voice-architecture.md` §7.5。
- **紅燈／30 公尺那張概念板不得出現在任何對外材料。**

## 還沒解決的

- **真正的驗收測試還沒做**：吵雜大廳、一位有點重聽的長輩，
  哪一版她第一次就聽懂。這個測試會推翻上面任何一個由耳朵做的決定。
- **registry 從 8 個科別擴到約 40 個。** 注意：科別名稱**就是真值本身**，
  沒有來源的名字不准進 registry。這件事不能外包。
- **validator 還不認得已驗證地名裡的數字和左右**（三樓電梯口、左側電梯）。
  方向已同意：讓 validator 吃 registry，已驗證的放行，沒來源的數字照擋。
- **playback 的音量控制還沒接到 UI。** `level.ts` 是純邏輯，已有 16 個測試；
  還沒有按鈕，也還沒接 Web Audio 的 GainNode + Compressor。

## 交給 Kimi（Cline）的邊界

可以：`src/ui/styles.css` 的視覺打磨、黑客松簡報與 demo 腳本、獨立的 `mockup.html`。

不可以：`src/registry/`（真值）、`src/engine/`、`src/render/validator.ts`、
任何 `*.test.ts`。

給任務時請明確畫界線，否則兩邊同時改同一個 repo 會撞。
