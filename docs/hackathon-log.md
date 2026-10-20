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

8 句都對。「我不知道藥局在哪」Mock 會因為否定詞回 uncertain，Nemotron 能看懂是要去藥局。

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
