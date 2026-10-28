# Nightingale — Potential Impact & Costs

## Illustrative 2–3-hour visit: about NT$0.15 in model inference only

**An unmeasured scenario—not total service cost or evidence of real-patient validation.** This assumes ten model calls per visit, each with 1,000 uncached input and 200 billable output tokens, at the Nebius rates below. US$0.0048 per visit converts to NT$0.1536 using an **illustrative NT$32/US$1**, not a current exchange-rate claim. The waiting time itself does not imply continuous model use.

[English indoor demo](https://nightingale-indoor.web.app/?lang=en) · [Source code](https://github.com/Crystal32378/Nightingale)

Nightingale explores a simple hospital-wayfinding experience: one next step, bilingual help and explicit uncertainty instead of invented directions. Its intended benefit is easier navigation and communication—not a measured improvement in outcomes.

## A place to ask again—not a replacement for volunteers

**Nightingale is intended to complement, not replace, human volunteers and hospital staff.** The vision is an always-available place to ask again, without feeling embarrassed or worrying about burdening others with repeated questions. A future deployment would retain human support; the help card is designed to support a conversation with another person, not replace it.

This is a design intention, not a validated patient outcome or a guarantee of continuous availability. The current demo does not summon volunteers, connect users to staff or provide staffed real-world support.

## Potential impact and rollout

The current [synthetic venue](https://github.com/Crystal32378/Nightingale/blob/main/src/venue/mock.ts) is a one-department slice with supporting registration, cashier, pharmacy and exit steps. It is not a real hospital map. A proposed pilot would start with hospital-verified routes for one department, then expand department by department and campus by campus, with route ownership, accessibility checks and maintenance.

A pilot should measure whether people can follow the next step, recover from uncertainty and ask for help, alongside actual API usage and operating effort. **No clinical validation, hospital partnership or production readiness is claimed.**

## Historical scale baseline—not product adoption

Taipei City Hospital's **whole-network 2024 outpatient service volume was 3,320,207 visits**, excluding dialysis and offsite outpatient departments. This is reported in the [2026 operating plan, PDF pages 23 and 155](https://www-ws.gov.taipei/001/Upload/446/relfile/22012/9527498/61a9c268-3aed-4be6-9ed0-a55ac93f6dea.pdf).

`3,320,207 ÷ 366 ≈ 9,072 visits per calendar day.`

These are visits, not unique people or Nightingale users. The calculated average is not an observed daily distribution, single-campus count, concurrency estimate or forecast.

## Shared inference assumptions

For `nvidia/nemotron-3-super-120b-a12b`, the [Nebius catalogue](https://tokenfactory.nebius.com/api/public/models_info) lists **US$0.30 per million uncached input tokens** and **US$0.90 per million output tokens**, checked on **2026-10-28**.

Both scenarios below assume **ten model calls per visit**, each using **1,000 input tokens and 200 billable output tokens**, including any billable reasoning output. These quantities are unmeasured; rates are held constant and no discounts or credits are applied.

`Cost/call = (1,000 × US$0.30 + 200 × US$0.90) ÷ 1,000,000 = US$0.00048.`

`Cost/visit = 10 × US$0.00048 = US$0.0048.`

At an **illustrative—not current-market—exchange rate of NT$32/US$1**, that is **NT$0.1536, approximately NT$0.15 per visit for inference only**.

### Scenario A: hypothetical use across the historical annual volume

Assume **100% of the 3,320,207 visits use Nightingale**. This is a calculation input, not observed adoption or a deployment forecast.

`3,320,207 × 10 = 33,202,070 model calls/year.`

| Scope | Nemotron inference only, before credits |
| --- | ---: |
| Per visit | US$0.0048 |
| Annual total | US$15,936.99 |
| Monthly arithmetic average, annual ÷ 12 | US$1,328.08 |
| Calendar-day arithmetic average, annual ÷ 366 | US$43.54 |

The unrounded annual calculation is **US$15,936.9936**. Monthly/day values are arithmetic averages, not actual billing-period or peak-day forecasts.

### Scenario B: separate 10,000-visits-per-day planning case

Assume **10,000 product-using visits/day**, ten calls per visit and a 30-day month:

`10,000 × 10 × 30 = 3,000,000 calls/month.`

`3,000,000 × US$0.00048 = US$1,440/month in inference.`

This is approximately **US$1,500/month** as a rounded planning figure, **not a spending cap or total service cost**. It is separate from the historical annual baseline; neither usage level is measured product adoption.

## A 2–3-hour wait is not continuous inference

The [reviewed UI](https://github.com/Crystal32378/Nightingale/blob/main/src/ui/App.tsx) calls the model on destination submission; [guidance/confidence updates](https://github.com/Crystal32378/Nightingale/blob/main/src/ui/useNightingale.ts) run locally in the browser. Tavily lookup is user-triggered, and [cache expiry does not automatically refresh it](https://github.com/Crystal32378/Nightingale/blob/main/server/tavily.ts).

Waiting alone adds no model calls in this code. Ten calls during a 2–3-hour visit remain a hypothetical ten-call workload. The phone UI may remain active and asset/audio downloads may consume bandwidth; this does not establish zero-cost waiting or an always-on Cloud Run instance.

## What these figures exclude

**All cost figures above are inference-only**, excluding Google Cloud/Firebase, Tavily, networking, logging/storage, route surveying and verification, updates, integration, security, support, maintenance, hardware and taxes. Actual cloud billing mode, minimum instances, CPU/RAM, traffic and free-tier availability must be checked before estimating hosting.

The current architecture uses GCP hosting and Nebius cloud inference. Future local/private deployment may be evaluated for privacy, latency and total operating cost; it is not automatically cheaper. A defensible all-in estimate needs measured pilot adoption, calls/tokens/retries, extraction and hosting usage, plus route coverage and operational requirements.
