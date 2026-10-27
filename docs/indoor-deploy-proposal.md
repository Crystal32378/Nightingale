# Indoor demo deployment — proposal

**Status: proposal for review. Nothing here has been deployed.** The platform,
who operates it, the budget and the limits below need the repository owner's
agreement before any of it is done. Local setup is in [indoor-setup.md](indoor-setup.md).

## Goal

A public indoor demo that stays up until **2026-12-15** (end of judging),
with the Nemotron key kept on a server and the outdoor deployment untouched.
The current README demo URL is a Hosting **preview channel that expires on
2026-11-07**, so it cannot be the indoor judging URL.

## Proposed shape

```text
phone ──> Firebase Hosting, new indoor site (live channel)
            ├─ /               the same Vite build (indoor flow is the default page)
            ├─ /api/**         unchanged: outdoor Cloud Run service "nightingale"
            └─ /indoor-api/**  new Cloud Run service, e.g. "nightingale-indoor"
                                  └─ NEBIUS_API_KEY from Secret Manager
```

| Part | Proposal | Why |
| --- | --- | --- |
| Frontend | A second Hosting site in project `nightingale-walk-with-me`, deployed to its **live** channel | Its own URL and release history; outdoor releases are not affected |
| Proxy | Cloud Run service from this repo's `server/`, region `asia-east1` | Same region as the existing `/api/**` rewrite; Hosting only serves static files |
| Route | Rewrite `/indoor-api/**` to that service, on the indoor site only | Keeps away from `/api/**` (outdoor) |
| Key | `NEBIUS_API_KEY` in Secret Manager, exposed to the service as an environment variable | Never in the build, the repo or a `VITE_` variable |

**Alternative:** add only the `/indoor-api/**` rewrite to the existing site and
promote it to its live channel. Fewer moving parts, but indoor and outdoor
would share one site and one release history. The separate site is proposed
because it leaves the outdoor deployment as it is.

Cloud Run needs a billing account on the Firebase project (Blaze). The
project already serves `/api/**` from Cloud Run, so this is not a new
requirement, but the cost owner still needs to agree.

## Must be done before the URL is public

**Status (2026-10-27):** items 1, 2, 3, 4 and 6 are in the proxy (see
[local setup](indoor-setup.md)): `RATE_LIMIT_PER_MINUTE` (default 10),
`DAILY_LIMIT` (default 400, `0` is the kill switch), HTTP 429 shown as
uncertain with help, and `npm start` from a bundle. The daily count is the soft,
in-memory one described in item 2. Item 5 is still open: Token Factory's billing
documentation describes no spending cap (past the credit it charges the card),
so the daily limit is what keeps the bill below the credit. The client address
used for item 1 must still be checked on the deployed service.

The original list:

The proxy has **no authentication**. A rewrite makes it
reachable through Hosting, and the Cloud Run URL itself is also reachable, so
the limits have to live in the proxy:

1. **Per-client rate limit** (for example a few requests per minute per IP).
   The client IP behind Hosting must be checked on the deployed service.
2. **Daily model-call cap** across all users. An in-memory counter is only a
   soft cap: every restart or new revision starts it at zero, and old and new
   instances can briefly run side by side, so it does not bound a day's total
   even with `--max-instances=1`. The hard stop on spending is the money on
   the Token Factory account (item 5) and the kill switch (item 3). A true
   daily cap needs the counter in shared storage such as Firestore (question 4).
3. **Kill switch**: an environment variable that stops model calls without a
   code change.
4. **Limit reached → uncertain, not Mock.** Today the client treats any
   unexpected status, including 429, as "proxy unusable" and falls back to
   Mock. A limit answer should show `我不確定。我陪你問。` with help, like a
   refused sentence (400/413) does now.
5. Budget alert on the Google Cloud project, and a spending limit or alert on
   the Token Factory account (whether it offers a hard spending limit is not
   yet checked; if not, keep only a small prepaid balance on it).
6. A production start command for the proxy. `npm run server` uses
   `vite-node` (a dev dependency); the container entry point is to be decided
   and tested in P5.

Until 1–4 exist, the indoor URL should not be shared publicly.

## Deploy steps (P5, after the PRs are merged and this proposal is agreed)

Commands are from the Firebase and Cloud Run documentation; names are
examples.

1. Create the site and a deploy target:
   `firebase hosting:sites:create SITE_ID`, then
   `firebase target:apply hosting indoor SITE_ID`.
2. Store the key: create a Secret Manager secret (e.g. `nebius-api-key`) and
   grant the service's identity `roles/secretmanager.secretAccessor`.
3. Deploy the proxy from source with `HOST=0.0.0.0`, the limits and the secret:
   `gcloud run deploy nightingale-indoor --source . --region asia-east1 --update-secrets=NEBIUS_API_KEY=nebius-api-key:latest --update-env-vars=HOST=0.0.0.0,DAILY_LIMIT=400,RATE_LIMIT_PER_MINUTE=10 --max-instances=1 ...`
   The Node.js buildpack runs the `gcp-build` script (bundles `server/`) instead
   of `build`, then starts with `npm start`. A Tavily key goes in the same way
   (`TAVILY_API_KEY`) if the clinic lookup is on. To stop model calls later:
   `gcloud run services update nightingale-indoor --region asia-east1 --update-env-vars=DAILY_LIMIT=0`.
4. Add the indoor site to `firebase.json` with the `/indoor-api/**` rewrite
   (`"run": { "serviceId": "nightingale-indoor", "region": "asia-east1" }`),
   build with `npm run build:hosting`, and deploy only that site:
   `firebase deploy --only hosting:indoor`.
5. On the deployed URL, rerun the three scenarios from the
   [scenario report](qa/indoor-scenarios-2026-10-23/README.md) on a physical
   phone, plus a limit-reached check.

**`firebase.json` and the outdoor deploy script change.** Turning `hosting`
into a list of sites means the existing `deploy:hosting` script
(`firebase deploy --only hosting`) would deploy **every** site. It would need
`--only hosting:<outdoor target>`. This touches outdoor configuration and is
for the owner to approve.

## Roll back and stop

| Need | Action |
| --- | --- |
| Bad frontend release | Firebase console → Hosting → the indoor site's release history → Roll back (creates a new release serving the earlier version) |
| Bad proxy revision | `gcloud run services update-traffic nightingale-indoor --to-revisions PREVIOUS_REVISION=100` |
| Stop model spending now | Set `DAILY_LIMIT=0` on the service (step 3): every request answers uncertain with help and no call is made. Or revoke the key in Token Factory. Every request then answers uncertain and the screen offers help; this behaviour is verified in the [scenario report](qa/indoor-scenarios-2026-10-23/README.md) (invalid key → uncertain) |
| Take the indoor demo down | Disable the indoor site, or remove the rewrite and redeploy the site |

## Questions for the owner

1. Separate indoor site (proposed) or rewrite on the existing site?
2. May `firebase.json`, `.firebaserc` and `deploy:hosting` change as described?
3. Who deploys and operates it until 12/15: the owner, or the contributor
   with which IAM roles (Hosting, Cloud Run, Secret Manager)?
4. Daily model-call cap and rate limit values; who receives budget alerts.
   Is a soft in-memory cap enough for the demo, with the Token Factory balance
   as the hard stop, or should the cap be a true daily one kept in Firestore?
5. The Token Factory key stays on the contributor's account (decided
   2026-10-19); is that still right for the public demo?

Sources: Firebase [multiple sites](https://firebase.google.com/docs/hosting/multisites),
[Hosting with Cloud Run](https://firebase.google.com/docs/hosting/cloud-run),
[managing releases](https://firebase.google.com/docs/hosting/manage-hosting-resources);
Cloud Run [secrets](https://docs.cloud.google.com/run/docs/configuring/services/secrets),
[rollbacks](https://docs.cloud.google.com/run/docs/rollouts-rollbacks-traffic-migration).
Read 2026-10-24.
