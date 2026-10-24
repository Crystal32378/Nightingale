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

The proxy has **no authentication and no rate limit** today. A rewrite makes it
reachable through Hosting, and the Cloud Run URL itself is also reachable, so
the limits have to live in the proxy:

1. **Per-client rate limit** (for example a few requests per minute per IP).
   The client IP behind Hosting must be checked on the deployed service.
2. **Daily model-call cap** across all users. With `--max-instances=1` an
   in-memory counter is a real global cap; a restart resets it, which is
   acceptable for a demo.
3. **Kill switch**: an environment variable that stops model calls without a
   code change.
4. **Limit reached → uncertain, not Mock.** Today the client treats any
   unexpected status, including 429, as "proxy unusable" and falls back to
   Mock. A limit answer should show `我不確定。我陪你問。` with help, like a
   refused sentence (400/413) does now.
5. Budget alert on the Google Cloud project, and a spending limit or alert on
   the Token Factory account.
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
3. Deploy the proxy with `HOST=0.0.0.0` and the secret:
   `gcloud run deploy nightingale-indoor --region asia-east1 --update-secrets=NEBIUS_API_KEY=nebius-api-key:latest --update-env-vars=HOST=0.0.0.0 --max-instances=1 ...`
   (source/container details per item 6 above).
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
| Stop model spending now | Revoke the key in Token Factory. Every request then answers uncertain and the screen offers help; this behaviour is verified in the [scenario report](qa/indoor-scenarios-2026-10-23/README.md) (invalid key → uncertain) |
| Take the indoor demo down | Disable the indoor site, or remove the rewrite and redeploy the site |

## Questions for the owner

1. Separate indoor site (proposed) or rewrite on the existing site?
2. May `firebase.json`, `.firebaserc` and `deploy:hosting` change as described?
3. Who deploys and operates it until 12/15: the owner, or the contributor
   with which IAM roles (Hosting, Cloud Run, Secret Manager)?
4. Daily model-call cap and rate limit values; who receives budget alerts.
5. The Token Factory key stays on the contributor's account (decided
   2026-10-19); is that still right for the public demo?

Sources: Firebase [multiple sites](https://firebase.google.com/docs/hosting/multisites),
[Hosting with Cloud Run](https://firebase.google.com/docs/hosting/cloud-run),
[managing releases](https://firebase.google.com/docs/hosting/manage-hosting-resources);
Cloud Run [secrets](https://docs.cloud.google.com/run/docs/configuring/services/secrets),
[rollbacks](https://docs.cloud.google.com/run/docs/rollouts-rollbacks-traffic-migration).
Read 2026-10-24.
