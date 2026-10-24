# Indoor English checks — 2026-10-24

Evidence for the English indoor screen (PR⑤). Open `/?lang=en`, or use the
language select below the volume control. The English copy is a first draft
for review; nothing here is a recorded voice.

## What is checked, and where

| Check | Where | Result |
| --- | --- | --- |
| Switching keeps the visit, the typed text and a pending or answered destination; stops speech in progress | `src/ui/App.test.tsx` — *switching language* | pass |
| The ask card speaks exactly the English line on screen, with an `en-US` voice | same | pass |
| English place names only for generic places; a web-sourced name is not handed out in English | `src/registry/registry.test.ts` | pass |
| Validator: English left/right needs a live turn; English number words, ordinals and floors are refused | `src/render/renderer.test.ts` | pass |
| Register lint: no-blame, one-job and no-performance in English; the shipped English table passes | `src/lint/register.test.ts` | pass |
| Mock: English place names as whole words, English negation (including `’`), "don't know where" still names the place | `src/destination/mock.test.ts` | pass |
| Full suite | `npm test -- --maxWorkers=2 --minWorkers=1` | 554/554, 36 files |
| Type checks and build | `npm run typecheck`, `tsc -p tsconfig.node.json`, `npm run build` | pass |

The Nemotron prompt was **not changed**. The Mock still names a place only
from its own name: `pharmacy` works, `medicine` alone does not, as `領藥`
alone does not in Chinese.

## Nemotron with English sentences

Seven fixed sentences through the local proxy (`npm run server`) with the
configured key: [results](nemotron-english.json), [script](nemotron-english.mjs).
**7/7** matched. Seven provider calls.

| Sentence | Expected | Got |
| --- | --- | --- |
| I need to pick up my medicine | PHARMACY | PHARMACY |
| Where do I pay my bill? | CASHIER | CASHIER |
| I don't want to go to the pharmacy | UNCERTAIN | UNCERTAIN |
| I don't know where the pharmacy is | PHARMACY | PHARMACY |
| First the cashier, then the pharmacy | CASHIER | CASHIER |
| What's the weather like today? | UNCERTAIN | UNCERTAIN |
| I have an appointment in neurosurgery | NEUROSURGERY | NEUROSURGERY |

An upstream failure would also come back as UNCERTAIN, so the two UNCERTAIN
rows alone do not prove the model answered; the five place answers in the same
run show the upstream was reachable.

## Screens

Desktop browser at 390×844, proxy off (Mock). Not a physical phone, and no
English voice was listened to.

| | |
| --- | --- |
| [01-en-confirm.png](01-en-confirm.png) | `I want to go to the pharmacy` → `Mock` `Go to Pharmacy?` |
| [02-en-walk.png](02-en-walk.png) | After `Yes`: next checkpoint, instruction and places in English; no horizontal scroll |
| [03-en-ask.png](03-en-ask.png) | `Help me ask` during the visit: `Excuse me, which way to Pharmacy?` |

In the same browser, `I don’t want the pharmacy` gave `I am not sure. I will
help you ask.`, and switching back to Chinese, `我要去藥局` still gave
`模擬` `要去藥局？` and started the pharmacy leg after `對`.

## For review

- English wording in `src/strings/en.ts` and the place names in
  `src/registry/types.ts`, in particular `Excuse me, which way to {place}?`
  (sign-style names, no article) and `Mock` for 模擬.
- Browser TTS quality varies by device; if no English voice is installed the
  text flow still works.
