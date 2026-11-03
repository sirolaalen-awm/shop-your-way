# H1 build status — 3 November 2026

**Working local prototype; acceptance PARTIAL / external integrations BLOCKED by missing credentials.** Not registered or submitted to Devpost. No real Channel3 request, real Sandbox capture, paid model call, live financial action, CORE/Sentinel/Book change or new chat was performed.

## Executed

| Check | Actual result |
|---|---|
| Install | Locked dependencies installed. npm audit at install: 0 reported vulnerabilities (point-in-time result). |
| TypeScript | PASS |
| Unit/contract checks | **15/15 PASS**. Model, catalog and PayPal responses are injected for these checks. |
| Production build | PASS, Next.js 16.4.5. An intermediate Windows permission error was resolved by rebuilding in the same authorized host context as the test server; no application logic failure was hidden. |
| Browser | **4/4 PASS**: explicit sample selection, variant correction and invalidated confirmation, hybrid route, pause/resume, reload persistence; mobile 390px viewport fits; cross-origin mutation and unconfirmed price-tampering request rejected; a stale tab cannot confirm another cart revision. |
| Real local AI | **3 conversational turns**, installed `qwen3:4b` via Ollama, no paid inference. Final bounded smoke checks **7/7 PASS** for $100 shoe budget, budget and original intent retention, hybrid route, increased verification weight, different TV exploration weight, unchanged requirements. Approx. 14.2s, 10.4s, 15.4s on this CPU-only host. See `evidence/local-model-smoke.json`. |
| Actual browser + AI | PASS: two turns through the production app API and real local model; $100 budget persisted, hybrid correction reached the actual route control, two assistant messages saved. `evidence/browser-model.json`; local screenshot `evidence/browser-model.png`. No external API or payment call. |
| Public repository | https://github.com/sirolaalen-awm/shop-your-way — source publication tracked separately from creating the repository. Final verify the source/README/LICENSE at that URL. |

Real AI smoke used the **actual unconfigured-catalog adapter**, not a live catalog and not a claimed product match. It contains no payment call. These three turns do not establish broad natural-language reliability or population-level personalization benefit. Hosted OpenAI adapter is implemented but was not called.

## Important development findings retained

The initial local native-tool approach skipped intent updates, emitted an incomplete answer and sometimes repeated tool requests. Earlier schema-constrained full-state extraction rewrote an unchanged requirement and missed the requested hybrid route; it also copied assistance defaults. Those intermediate failed states are retained in `evidence/local-model-before-*.json` as negative controls; they are not acceptance passes. Early incomplete native-tool attempts were interrupted and did not produce a completed smoke artifact.

Corrections: bounded structured local tool protocol; schema-validated sparse intent patches preserve unchanged values; explicit shopper route/pace phrases override model guesses; search cannot repeat within a turn; reasoning-marked/incomplete outputs are excluded from shopper-facing text. This is **AI plus normal application controls**, not proof that model-only inference solved these failures. Some generated wording remains generic and can suggest opening samples without actually opening them. Sample display always requires the shopper's explicit button. Arbitrary phrasing still requires evaluation before public production use.

## Remaining acceptance blockers

1. **Channel3 live search — NOT EXECUTED.** Obtain authorized API credentials, configure locally, retrieve a real result and verify current schema, source, price, merchant link and errors. The adapter follows current official search/response documentation, but a contract fixture is not a working service credential.
2. **PayPal Sandbox approval/capture — NOT EXECUTED.** Obtain Sandbox app credentials and a separate buyer account, approve the $1 demonstration token and verify a real completed capture receipt. Tests cover fixed server amount, idempotency, response-loss recovery, stale-cart/order/session checks, mismatched proof and pending capture using fixtures only. No claim of an actual PayPal success.
3. **Hackathon registration — NOT SENT.** User explicitly withholds submission authority. Marketing and conflict-of-interest answers remain open. Final registration requires explicit user approval of the exact form and agreements. Read official rules, not just this status.
4. **Demo video — PLAN ONLY.** Record the functioning final flow in English, publicly upload to YouTube under three minutes, verify access. Do not film fixtures as successful integrations.
5. **Judge access / hosting — NOT PUBLISHED.** Complete local setup instructions are included. If hosted, provision persistent single-process storage, rate/admission limits and HTTPS before enabling external credits. The app is not a production payment/storefront service.

## Ready now

Responsive shopping UI; one conversation and fluid assistance weights; original/current intent; explicit online/try-on/hybrid route; at most three sourced product cards; explicit fictional samples; corrected product and size preference; no purchase option; revision-bound confirmation; Sandbox-only server checkout code; README, env template, MIT LICENSE, CI checks and demo plan.

The external catalog product is not sold by this app. The fixed $1 USD token is an explicitly separate Sandbox-only demonstration with no fulfillment. Whether this integration is sufficiently central to satisfy hackathon judging is not guaranteed; the final demonstration should show the entire shopper-controlled decision and actual payment path. Channel3 remains optional for general entry, but required by this product brief.
