/**
 * Nightingale — presentation server.
 *
 * One tiny HTTP server for BOTH cloud tracks. Zero dependencies (node built-ins
 * only), so it runs unchanged on:
 *  - Google Cloud Run (AI Builder Cup track), and
 *  - Nebius Serverless Endpoints (Nebius x NVIDIA hackathon track).
 *
 * Routes:
 *  - GET  /health            -> { ok: true, tracks: [...] }
 *  - POST /api/present       -> { text, source, fallbackUsed, reason }
 *
 * Request body (JSON):
 *   { track, baseText, placeId, placeName, intent, cue, turnLive }
 *
 * Env:
 *   GEMINI_API_KEY   - required for track "google"
 *   NEBIUS_API_KEY   - required for track "nebius"
 *   PORT             - default 8080 (Cloud Run injects PORT)
 *
 * Safety: the server never sees the venue graph or the remaining route. It
 * paraphrases one disclosed string and guards the output. On ANY failure it
 * returns the deterministic base text with fallbackUsed: true.
 *
 * Run:  node server/present.mjs
 *       (repo builds it from server/present.ts? No — this file is plain JS with
 *       JSDoc types, runnable directly AND importable from TS via allowJs.)
 */
