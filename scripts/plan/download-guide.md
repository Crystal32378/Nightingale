# 手動產生語音的對照表

這份是給「在網頁介面生成、下載、放進專案」那條路用的。每一句生成之後，
**照右邊的檔名存**，放進對應資料夾，然後跑：

```bash
node scripts/voice.mjs --from-files --profile=FEMALE
node scripts/voice.mjs --from-files --profile=MALE
```

腳本會掃描資料夾、算 sha256、產生 manifest。跑完 `npm test`，
對照測試會逐字比對每一句是不是 renderer 真正會說的話。

兩個聲音用同一批文字，只是資料夾不同：

- **FEMALE** — 音色 `Chinese_crisp_podcaster_nv1`，speed 1、pitch 1、volume 3 → 存到 `public/audio/zh-TW/female/`
- **MALE** — 音色 `Chinese_calm_streamer_nv1`，speed 0.9、pitch 1、volume 3 → 存到 `public/audio/zh-TW/male/`

共 20 句，每個聲音一套。

| # | 要生成的文字 | 存成這個檔名 |
| --- | --- | --- |
| 1 | `往前走。` | `guidance.go.mp3` |
| 2 | `往左手邊走。` | `guidance.turn.left.mp3` |
| 3 | `往右手邊走。` | `guidance.turn.right.mp3` |
| 4 | `我不確定。我陪你問。` | `guidance.uncertain.mp3` |
| 5 | `批價櫃台，到了。` | `guidance.arrived__CASHIER.mp3` |
| 6 | `電梯口，到了。` | `guidance.arrived__ELEVATOR_IN.mp3` |
| 7 | `電梯出口，到了。` | `guidance.arrived__ELEVATOR_OUT.mp3` |
| 8 | `大門，到了。` | `guidance.arrived__ENTRANCE.mp3` |
| 9 | `出口，到了。` | `guidance.arrived__EXIT.mp3` |
| 10 | `神經外科，到了。` | `guidance.arrived__NEUROSURGERY.mp3` |
| 11 | `藥局，到了。` | `guidance.arrived__PHARMACY.mp3` |
| 12 | `掛號櫃台，到了。` | `guidance.arrived__REGISTRATION.mp3` |
| 13 | `請問，批價櫃台？` | `ask.utterance__CASHIER.mp3` |
| 14 | `請問，電梯口？` | `ask.utterance__ELEVATOR_IN.mp3` |
| 15 | `請問，電梯出口？` | `ask.utterance__ELEVATOR_OUT.mp3` |
| 16 | `請問，大門？` | `ask.utterance__ENTRANCE.mp3` |
| 17 | `請問，出口？` | `ask.utterance__EXIT.mp3` |
| 18 | `請問，神經外科？` | `ask.utterance__NEUROSURGERY.mp3` |
| 19 | `請問，藥局？` | `ask.utterance__PHARMACY.mp3` |
| 20 | `請問，掛號櫃台？` | `ask.utterance__REGISTRATION.mp3` |

檔名一個字都不能錯——manifest 是靠檔名對回句子的。

