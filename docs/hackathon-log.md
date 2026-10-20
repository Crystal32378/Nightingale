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
