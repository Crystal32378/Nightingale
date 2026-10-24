# Run the indoor destination demo locally

This guide covers the indoor React UI and the Hono destination proxy in this
repository. Open `/` for the indoor flow. The outdoor `?flow=last300m` flow has
separate backend settings; they are not needed here.

The steps below use the Traditional Chinese screen. It asks where the person wants to go,
shows the interpreter mode, and requires confirmation before starting navigation.
See the [scenario report](qa/indoor-scenarios-2026-10-23/README.md) for screenshots,
test sentences and failure behavior.

## 1. Install dependencies

Run commands from the repository root, where `package.json` is located.
The verified environment is **Windows, Node v26.12.1 and npm 11.20.0**.
The repository does not pin a Node version; other runtime combinations were not
validated in this setup check.

Windows PowerShell:

```powershell
node --version
npm.cmd --version
npm.cmd ci
```

`npm ci` installs from the committed
`package-lock.json`. Include development dependencies: the current local server
command uses `vite-node`, and the UI uses Vite.

Use `npm.cmd` in PowerShell if `npm.ps1` is blocked by execution policy. On
macOS/Linux, use `npm` with the same arguments instead of `npm.cmd`.

On Windows, preserve LF line endings: fixed audio/script tests compare file
hashes. For a **new clone**, this repository can be checked out with:

```powershell
git clone -c core.autocrlf=input https://github.com/Crystal32378/Nightingale.git
```

For PR review, check out the revision being reviewed before installation. Do not
overwrite an existing working directory or discard local edits to change line endings.

## 2. Start with Mock (no API key required)

Start the frontend without starting the proxy:

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Open **http://127.0.0.1:5173/**. Enter `我要去藥局` (I want to go to the pharmacy)
and press `找路` (Find route). Expect `模擬` (Mock) and `要去藥局？` (Go to the pharmacy?).
Press `對` (Yes) to start the pharmacy leg. `不是` (No) returns to editing.
The prototype has no real positioning yet, so the route waits at its first
checkpoint. Open `dev panel` at the bottom of the screen: `simulate checkpoint`
or `simulate arrival` moves the route on, and `reset visit` returns to the input.

With no proxy listening, Vite reports an expected connection failure/HTTP 500;
the frontend handles it by using its local Mock. No Nebius request is made.
Mock only matches place names; `領藥` alone is not one. Use `我要去藥局`
when verifying Mock.

## 3. Configure and start the proxy

Create `.env` from the existing [.env.example](../.env.example) **only if it does not exist**:

```powershell
if (-not (Test-Path -LiteralPath .env)) {
  Copy-Item -LiteralPath .env.example -Destination .env
}
```

On macOS/Linux:

```sh
[ -f .env ] || cp .env.example .env
```

Edit `.env` locally. The indoor proxy uses these variables:

| Variable | Purpose | Default / empty value |
| --- | --- | --- |
| `NEBIUS_API_KEY` | Server-only Nebius Token Factory credential | Missing or whitespace-only value selects Mock |
| `HOST` | Address on which the proxy listens | `127.0.0.1`; keep this for local use |
| `PORT` | Proxy listening port | `8787`; keep this to match the Vite forwarding target |

`MINIMAX_API_KEY` and `MINIMAX_GROUP_ID` in the example file belong to separate
audio tooling. Leave them empty unless you are doing that work.
The model and endpoint are currently constants in
[nemotron.ts](../src/destination/nemotron.ts), not environment-variable settings:

- Model: `nvidia/nemotron-3-super-120b-a12b`
- Endpoint: `https://api.tokenfactory.nebius.com/v1/chat/completions`

Keep real credentials in `.env` or the server process environment. `.env` is
gitignored. Never put a key in `.env.example`, a screenshot, a PR, or a variable
whose name starts with `VITE_` (those variables can enter the browser bundle).

In a **second terminal at the same repository root**, start the proxy:

```powershell
npm.cmd run server
```

Expected startup message:

```text
indoor proxy on http://127.0.0.1:8787 (mock)
```

or, when a nonblank key is present:

```text
indoor proxy on http://127.0.0.1:8787 (nemotron)
```

The startup mode only indicates which interpreter was selected. It does **not**
prove that the credential works or that the account has available credit.

### Switching modes

| Desired mode | Action |
| --- | --- |
| Frontend Mock | Stop the proxy; keep the frontend running |
| Proxy Mock | Set `NEBIUS_API_KEY=` in `.env`, clear any inherited value of that variable, then restart the proxy |
| Nemotron | Set the real key in `.env`, clear any stale inherited override, then restart the proxy |

`npm run server` starts the proxy through `vite-node`, which also reads
`.env.local`, `.env.development` and `.env.development.local` from the repository
root; a value in any of these takes precedence over `.env`. Keep the key in `.env` only.
Existing process environment variables take precedence over all of these files. To let the
file supply the value, clear a temporary override in the **proxy terminal** before
starting it:

```powershell
Remove-Item Env:NEBIUS_API_KEY -ErrorAction SilentlyContinue
npm.cmd run server
```

On macOS/Linux, use `unset NEBIUS_API_KEY` followed by `npm run server`.
Clearing an override does not force Mock if `.env` still contains a real key.

The mode is chosen once at proxy startup. After editing `.env`, press Ctrl+C in
the proxy terminal and restart it. A browser refresh alone does not reload the key.
The mode badge appears after submitting a sentence; it is not shown before an answer.

For a real-provider check, submit `我要去領藥` (I want to pick up medicine).
A successful call displays `Nemotron` and asks to confirm the pharmacy. This
consumes Token Factory usage. Use synthetic destination requests, not personal
or medical information. The input text is sent to Nebius for classification.
The displayed retention notice assumes the account's Zero Data Retention setting
used in this project's [recorded setup](hackathon-log.md); verify that setting
when using a different account.

## 4. Understand results and failures

| Condition | Expected behavior |
| --- | --- |
| No key, working proxy | Proxy returns `mode: mock`; UI displays `模擬` |
| Proxy absent/unreachable, response unusable, or client timeout (10 seconds) | Frontend uses Mock and displays `模擬` |
| Model cannot classify the request | Proxy returns `mode: nemotron`, `destination.kind: uncertain` |
| Upstream failure, invalid key, or model timeout (8 seconds) | Working proxy returns HTTP 200 with Nemotron `uncertain`; no Mock reclassification |
| Invalid text (HTTP 400) or body over 4 KB (HTTP 413), with a valid mode in the response | Client displays `uncertain` in that mode instead of guessing with Mock |

`uncertain` displays `我不確定。我陪你問。` (I'm not sure. I'll help you ask.).
`幫我問` (Help me ask) opens a generic help card without starting a visit.
Closing it preserves the input and restores focus. A recognized destination
still needs `對` before navigation starts.

The request is `POST /indoor-api/destination` with JSON `{ "text": "..." }`.
Text must be a nonblank string of at most 200 JavaScript string code units;
the endpoint also enforces a 4 KB body limit. Opening the endpoint in the address
bar sends GET and is not a health check.

## 5. Open the UI on a phone over the local network

Stop the frontend, then start it with LAN access:

```powershell
npm.cmd run dev -- --host 0.0.0.0 --port 5173 --strictPort
```

Connect the phone to the same trusted network and open the computer's LAN URL
printed by Vite, for example `http://192.168.0.6:5173/` (use your computer's actual
address). The phone's `localhost` refers to the phone, not the computer.
If the page cannot load, check the network and the existing firewall permissions
for Node; do not disable the firewall.

**LAN requests to `/indoor-api/**` are deliberately rejected with HTTP 404.**
The phone UI therefore uses Mock, even if the computer's proxy has a real key.
This applies to Vite dev and the configured preview proxy. Keep the Hono proxy
bound to `127.0.0.1`; opening it on all interfaces bypasses its local-only boundary.

Do not expose a key-bearing dev server through a public tunnel or port-forward:
forwarded requests can appear to come from loopback. Real-model phone acceptance
belongs to the later protected deployment. The current proxy has no authentication
or rate limiter; `npm run build` alone does not deploy a proxy or add those controls.

## 6. Troubleshooting and checks

| Symptom | Check |
| --- | --- |
| UI shows Mock on this computer | Use `127.0.0.1`, check proxy startup mode, `.env` location, and port 8787 |
| UI shows Mock on a phone | Expected for LAN access; see section 5 |
| Startup says Nemotron but every request is uncertain | Check account/key/credit and connectivity locally; startup does not validate the key |
| Changing `.env` has no effect | Restart the proxy, clear stale process overrides, and check for `.env.local` or `.env.development*` |
| Port 5173 is busy | Stop the server you started or choose another frontend port and open that URL; `--strictPort` prevents a silent port change |
| Port 8787 is busy | Stop your previous proxy; changing `PORT` alone does not change Vite's fixed target |
| `vite-node` cannot be found | Run `npm ci` with development dependencies from the repository root |
| Windows script/hash test fails after a fresh checkout | Check LF/CRLF conversion before changing application code or recorded manifests |

Reviewer checks, from the repository root:

```powershell
npm.cmd test -- --maxWorkers=2 --minWorkers=1
npm.cmd run typecheck
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.node.json
npm.cmd run build
```

`typecheck` covers the app/server configuration; the separate command also checks
the Node tooling configuration. Two test workers match the known stable run
configuration on the development machine. Press Ctrl+C in both server terminals
when finished.

## Verification for this guide — 2026-10-23

- Clean installation from copies of the committed package manifest and lockfile
  succeeded in an empty temporary directory: `npm ci --offline --no-audit --no-fund`,
  **199 packages**. The first sandboxed attempt could not access npm's cache;
  rerunning with that access succeeded. No repository dependency or lockfile changed.
- `npm run server` started in Mock mode; direct and Vite-forwarded POSTs returned
  Mock `PHARMACY`. LAN-address HTTP checks returned UI 200 and API 404.
- Startup with the existing configured key selected Nemotron. A blank-input request
  exercised the HTTP 400 rejection before inference, without a model call.
  Machine-readable results: [setup checks](qa/indoor-setup-2026-10-23.json).
- Follow-up on 2026-10-24, same revision:
  - Browser walkthrough of section 2 with no proxy: Mock `要去藥局？`, `不是`
    keeps the input, `對` starts the pharmacy leg.
  - Mode selection: a key in `.env`, `.env.local` or the process environment
    selects Nemotron; a missing, empty or whitespace-only key selects Mock; an
    empty process variable overrides a real key in `.env`.
  - One real call through the browser at `127.0.0.1`: `我要去領藥` showed
    `Nemotron` and `要去藥局？`.
  - `vite preview`: loopback API forwarded; LAN UI 200, LAN API 404.
  - A physical phone on the same Wi-Fi opened the LAN URL and showed `模擬`
    while the proxy was in Nemotron mode.
  - 497/497 tests, both typechecks and build passed.
- macOS/Linux commands were not run.

Public deployment is not set up yet; see the [deployment proposal](indoor-deploy-proposal.md).
