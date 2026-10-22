# Hackathon 紀錄（Nebius Token Factory／Nemotron）

從第一次呼叫模型開始記錄。交件表單的 Nebius／NVIDIA 使用回饋題要靠這份回答。
**不記 API key，也不記使用者輸入的原文**（測試句除外）。

---

## 設定

| 項目 | 值 |
|---|---|
| Endpoint | `https://api.tokenfactory.nebius.com/v1/chat/completions`（OpenAI 相容格式） |
| 認證 | `Authorization: Bearer $NEBIUS_API_KEY`（只放伺服器端 `.env`） |
| 使用的模型 | `nvidia/nemotron-3-super-120b-a12b` |

---

## 2026-10-20：第一次呼叫

`GET /v1/models` 列出的 Nemotron 模型：

- `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`
- `nvidia/nemotron-3-super-120b-a12b`
- `nvidia/Nemotron-3-Ultra-550b-a55b`
- `nvidia/Nemotron-3.5-Super-VL`
- `nvidia/Nemotron-3_5-Lightning`

用目的地分類的 system prompt 試 Nano 和 Super，`temperature: 0`、`max_tokens: 512`：

| 輸入 | Nano 30B | Super 120B |
|---|---|---|
| 我要去領藥 | `PHARMACY`（2.8 秒） | `PHARMACY`（1.3 秒） |
| 繳費要去哪 | `CASHIER`（1.2 秒） | `CASHIER`（1.1 秒） |
| 今天天氣如何 | `UNCERTAIN`（2.5 秒） | `UNCERTAIN`（1.2 秒） |

觀察：

- 兩個模型預設都會先推理（reasoning），推理過程不在 `content` 裡；每次約 50–160 個 completion tokens。
- `content` 開頭會帶換行（例如 `"\n\nPHARMACY"`），`parseDestination` 會先 trim，不影響結果。
- 選 **Super 120B**：三句都對、速度比 Nano 穩定，也是 Nebius 自己範例用的模型。不比較其他模型（B5：比較不在四天範圍內）。
- 踩到的坑：在 Windows 的 Git Bash 用 `curl -d` 送中文會回 `400 There was an error parsing the body`，是終端機編碼問題；改用 Node `fetch` 就正常。
  同一天對本機代理再測：Git Bash 內建的 curl（`/ucrt64/bin/curl`）把指令裡的中文轉成亂碼，有時仍是合法 JSON，伺服器回 200 但辨識成 uncertain；Windows 內建的 `curl.exe`，或把 JSON 存成 UTF-8 檔案再用 `--data-binary @file` 送，都正常。瀏覽器的 `fetch` 一律送 UTF-8，使用者在畫面上輸入中文不受影響。

---

## 2026-10-20：`NemotronInterpreter` 實測

`src/destination/nemotron.ts` 的 system prompt 列出每個地點 ID 和常見說法，並要求「無法確定、提到不只一個地點、說不要去某個地方、或和找地點無關」時回 `UNCERTAIN`。回答一律經過 `parseDestination`；HTTP 錯誤、網路失敗、逾時（8 秒）都回 uncertain。

| 輸入 | 結果 | 時間 |
|---|---|---|
| 我要去領藥 | `PHARMACY` | 2.9 秒 |
| 繳費要去哪 | `CASHIER` | 1.7 秒 |
| 我要看神經外科 | `NEUROSURGERY` | 0.9 秒 |
| 不要去藥局 | uncertain | 2.0 秒 |
| 先去批價再去藥局 | uncertain | 1.2 秒 |
| 我不知道藥局在哪 | `PHARMACY` | 0.9 秒 |
| 今天天氣如何 | uncertain | 0.8 秒 |
| 電梯在哪 | `ELEVATOR_IN` | 1.4 秒 |

8 句都對。「我不知道藥局在哪」Nemotron 能看懂是要去藥局；Mock 也回藥局（「不知道」不在否定詞清單裡）。（2026-10-21 更正：原本寫「Mock 會因為否定詞回 uncertain」，沒有實際測過，是錯的。）

---

## 2026-10-20：多個地點的規則（選項 B）

原本提到兩個地點一律 uncertain。改成：**先後順序清楚就回第一個要去的地點**，順序不清楚或是在問要選哪一個就回 uncertain。
理由：`DEMO_VISIT` 走完批價本來就會接著去藥局；畫面也會先請使用者確認目的地（PR③），判斷錯了按「不是」就好。Mock 看不懂順序詞，兩個地點仍然 uncertain。

第一版 prompt 讓「我不知道藥局在哪」連續 3 次都變成 uncertain（模型把使用者的「不知道」當成「無法確定」）。把 UNCERTAIN 改寫成「**你**判斷不出使用者要去哪裡」並加一句例子後恢復正常。

| 輸入 | 結果 |
|---|---|
| 先去批價再去藥局 | `CASHIER` |
| 看完神經外科要去批價 | `CASHIER` |
| 領完藥要去出口 | `EXIT` |
| 我要去藥局，之後去出口 | `PHARMACY` |
| 藥局還是批價？ | uncertain |
| 藥局和批價在哪裡 | uncertain |
| 不要去藥局 | uncertain |
| 不要去藥局，我要去批價 | `CASHIER` |
| 我不知道藥局在哪 | `PHARMACY` |
| 我不知道批價在哪裡 | `CASHIER` |
| 我不知道要去哪 | uncertain |
| 今天天氣如何 | uncertain |
| 電梯在哪 | `ELEVATOR_IN` |

**延遲：** 這輪有兩句剛好 8 秒逾時、變成 uncertain（「我要去領藥」「我不知道要去哪」）。不設逾時重打 3 次：答案都對、推理只用 28–40 tokens、多半 0.7–1.6 秒，偶爾 3.9 秒。判斷是 Token Factory 服務端偶發的延遲，不是 prompt 造成的。逾時回 uncertain（我陪你問）是設計好的退路。

---

## 2026-10-21：PR② review 後的修改

Crystal 轉來的 review 意見，和 key、額度、辨識結果有關的部分：

- **額度可能被區網裡的其他裝置用掉**：代理原本監聽所有網路介面，Vite 的 `host: true`（給手機測試用）也會把區網的 `/indoor-api` 請求轉給代理，同網路的人不用知道 key 就能消耗額度。改成代理預設只聽 `127.0.0.1`（部署時用 `HOST` 覆寫），Vite dev／preview 只轉發本機的請求，其他裝置 404，畫面改用 Mock。
- **Mock 漏了常見的否定說法**：「我不能去藥局」「我不需要去藥局」「我不可以去藥局」原本都回藥局。補上不能、不需要、不可以、不會、不打算、沒有要、沒要。仍然用清單，不是看到「不」就 uncertain：「不知道藥局在哪」的人是要去藥局。
- **輸入無效被當成代理故障**：超過 200 字被代理拒絕後，前端原本會改用 Mock 猜目的地。現在代理拒絕時附上 `mode`，前端回 uncertain。
- **下一步要告知使用者**：「不記錄文字」不等於「文字不離開本機」。PR③ 的畫面要告知文字會傳到 Nebius；Token Factory 的資料保存政策要先查證，不自己宣稱。

---

## 2026-10-22：開啟 Zero Data Retention

Token Factory 預設會保存輸入和輸出，用在 Speculative Decoding 加速推論（存在芬蘭，保存多久文件沒寫）。這是醫院情境，使用者可能不小心打出個人資料，所以在帳號的 Settings 勾選 **Enable zero data retention**：處理完不保存。畫面上的告知因此可以寫「處理完不保存」；不寫「不會用來訓練」，因為官方兩份文件的說法不一致。

開啟後實測 6 句，結果都對，速度沒有變慢（1.0–2.0 秒）：

| 輸入 | 結果 |
|---|---|
| 我要去領藥 | `PHARMACY` |
| 繳費要去哪 | `CASHIER` |
| 先去批價再去藥局 | `CASHIER` |
| 我不能去藥局 | uncertain |
| 我不知道藥局在哪 | `PHARMACY` |
| 今天天氣如何 | uncertain |

來源：[Legal quick guide](https://docs.tokenfactory.nebius.com/legal/legal-quick-guide)
