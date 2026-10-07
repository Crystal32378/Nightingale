# 室外固定語音接線 — 2026-10-07

本機版本已接入 Leda／Puck，尚未部署。22 句固定文稿、每句兩個音檔，共 44 檔；其中 11 句使用 2026-10-07 的自然國語版，另 11 句沿用 2026-09-27 原音。自然國語版移除 `with a natural Taiwanese accent,`。Crystal 已試聽通過全部 22 段新錄音；最後只修正了 Puck 的 `photo.wait`，該句另外加上 `Use a natural adult male voice.`，也已獲 Crystal 確認。各句實際提示詞與雜湊保留在 manifest，驗收紀錄為 `docs/qa/outdoor-voice-2026-10-07/accepted-audio.json`。照片評測及 Git 保存這一輪不再更動音檔。

## 播放規則

- 只從 `renai-001 + action.type + action.checkpointId` 選預錄句，伺服器文字不拿來比對或朗讀。
- 按開始、確認一個點、或按「我在哪」時播放。背景不定時插話。
- `GUIDE:cp2` 只播過復興南路。走路者按「過完了」得到 `GUIDE:cp2x`，才依序播 `cp2.after`、`cp2.along`。
- 兩個過街步驟等走路者按鈕；途中不顯示重播、照片或單車／補水提示。
- 換步驟、靜音、切換聲音、開啟幫我問、或離開頁面，都取消上一段及尚未播放的下一句。幫我問開著時，較晚回來的導航回覆也保持安靜。
- 缺 key、缺檔、音訊下載失敗或瀏覽器無法播放，保留文字並保持安靜，不退回即時 TTS。
- `RECOVER:cp5` 同時代表急診／大安路／綠頂長廊三種回復，現有協定不能唯一選片，保持文字顯示。相關原音仍保留在 manifest 中。
- `cp1.board`、`cp5.lobby` 的原音也保留，未在沒有明確動作身分的時機自動播放。

原有「幫我問」卡片的裝置語音維持原流程；這不是導航音檔的替代機制。拍照入口仍受 `?photo=1` 控制。

## 來源與重跑

固定文稿：`docs/tts-outdoor-script.md`（由後端同名文件複製）。音檔：`public/audio/outdoor/renai-001/`。清單：`src/remote/outdoor-manifest.json`，包含共同文字、各聲音檔案、SHA-256、長度與生成／沿用來源。

生成沿用 [Google Gemini TTS 的 Vertex AI 接口](https://cloud.google.com/text-to-speech/docs/gemini-tts#use-vertex-ai-api)。後端 `scripts/record-outdoor.py` 僅處理標「新錄」的固定句；前端 `scripts/import-outdoor-recordings.py` 驗證所有來源後複製檔案，保留原檔。429 時停止，稍後重跑會跳過已驗證的檔案；不用提高額度。

自然國語版來源：`Desktop/Opus Chamber/Nightingale 室外語音 Leda+Puck 2026-10-07/自然國語版/`。`recordings.json` 分別保留風格核定、個別片段試聽狀態、提示詞與 SHA-256。三段 Puck 初始補錄出現滿刻度取樣，已用相同設定重錄並保留原 take；匯入程式現在會在複製前擋下這類新錄音。整批試聽頁為同資料夾內的 `試聽.html`。

```bash
npm test
npm run build
```

瀏覽器檢查使用本機後端的固定詞彙判讀，不呼叫 Gemini。先在後端啟動：

```bash
GOOGLE_CLOUD_PROJECT= SESSION_STORE=memory PORT=8787 npm start
```

在前端啟動：

```bash
VITE_LAST300M_API=http://127.0.0.1:8787 npm run dev -- --host 127.0.0.1 --port 5178 --strictPort
```

`scripts/check-outdoor-browser.cjs` 需要 Playwright；可以用 `PLAYWRIGHT_MODULE` 指定現有安裝路徑、`CHROME_PATH` 指定 Chrome。頁面預設為 `http://127.0.0.1:5178`，可用 `NIGHTINGALE_QA_URL` 覆寫。

## 本次驗證

- 267 項測試與 production build 通過；包含 44 個實體 WAV 的 SHA-256、格式、共同文稿與 register lint。
- 22 段新錄音都是 mono、24 kHz、16-bit PCM；訊號非空且峰值未截波。這不驗證發音或聽感。
- Chrome 390 × 844 真實頁面＋本機路線 API：音檔 HTTP 200、Web Audio 實際啟動、轉彎後才直走、過街途中不插話、切換 Puck、靜音取消下一句、拍照提醒載入，以及幫我問抑制延遲導航語音。
- 畫面沒有橫向溢出，瀏覽器無 page errors。截圖與播放紀錄在 `docs/qa/outdoor-voice-2026-10-07/`。
- 自然國語版更換後：重新驗證 6 項室外語音測試、production build、Chrome 真實播放、22 段試聽頁載入。44 個前端檔案中恰好更換 22 個新錄音，其餘 22 個沿用音檔的 SHA-256 不變；兩個已通過小樣的 SHA-256 也不變。
- Crystal 的整批錄音試聽已完成；這不等同於 iPhone Safari、戶外噪音或導航整趟驗收。這些實地條件仍待部署測試版本後確認。
