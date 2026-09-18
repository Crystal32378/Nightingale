# String inventory — zh-TW

Every word Nightingale can show or say. Nothing is generated at runtime; there
is no model anywhere in this path.

`screen` and `speech` are always the same string, so this table is also the
recording script for voice work and the review sheet for TTS. If a synthesised
voice says anything other than exactly what is in the right-hand column, that is
a defect.

`{place}` is interpolated only from the verified place registry
(`src/registry/types.ts`). An unverified place never reaches a screen — the
runtime validator swaps the whole line for `fallback.safe`.

| key | zh-TW | when | voice note |
| --- | --- | --- | --- |
| `guidance.go` | `往前走。` | at a checkpoint, the way is straight ahead | 平穩，不催。 |
| `guidance.turn.left` | `左轉。` | at a checkpoint, inside the turn TTL | 兩個字，不拉長。 |
| `guidance.turn.right` | `右轉。` | at a checkpoint, inside the turn TTL | 兩個字，不拉長。 |
| `guidance.uncertain` | `我不確定。我陪你問。` | confidence band is UNKNOWN, or the person asked for help | 承認，然後留下。不要有歉意的語氣。 |
| `guidance.arrived` | `{place}，到了。` | the leg destination was observed | 收尾，不慶祝。 |
| `guidance.wait` | *(empty)* | posture is RESTING | 休息時什麼都不說。這是刻意的。 |
| `guidance.none` | *(empty)* | the visit has not started | — |
| `ask.utterance` | `請問，{place}？` | ask-for-me, from a long press or the button | 音量足夠讓旁邊的人聽一次就懂。 |
| `checkpoint.next` | `下一個：{place}` | screen label for the single next checkpoint | 畫面用，不朗讀。 |
| `fallback.safe` | `我不確定。我陪你問。` | the validator refused an output | 與 `guidance.uncertain` 同字。 |

## Register rules these strings are held to

Build-time lint, `src/lint/register.ts`, with REJECT and ALLOW fixtures in
`src/lint/register.test.ts`:

- **no-blame** — a person may not be the subject of an error predicate.
  `你走反了` is rejected; `方向反了`, `你的左手邊`, `你面前偏左` are allowed.
- **one-job** — one guidance string carries one instruction.
- **no-performance** — no `喔/唷/呢/啦/囉/耶`, no `！`, no emoji, no tripled
  characters, and no soothing phrase mixed into an instruction
  (`沒關係`, `別擔心`, `放心`, `不用怕`).

Preferred register, for anyone adding a string later:

| prefer | not |
| --- | --- |
| `停一下，方向反了。` | `等等，你走反了。` |
| `對，這個方向。` | `對，就是這個方向。` |
| `我不確定。我陪你問。` | 表演式的溫柔 |

## Taigi

Out of v0 scope. When it returns it will be a separately written, separately
human-verified table — never a translation of this one.
