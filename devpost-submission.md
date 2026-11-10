# Shop Your Way — Happy Customer, Happy System

## One-line Summary
A shopper-led AI companion that remembers changing needs, offers a small shortlist, and keeps payment a deliberate choice.

## Problem
Shopping searches often lose the thread when someone changes a detail or changes direction. A shopper should be able to explain what matters, refine a budget or brand, compare a few possibilities, and stop without buying.

## Solution
Shop Your Way connects a calm conversational interface to Channel3's ready-made Conversational Agent and catalog. The provider maintains the shopping conversation; SYW shows the actual native search query and only the products explicitly recommended by the agent, up to three. It does not fill spare card slots with unrelated search hits.

The shopper remains in control: follow merchant links, revise the demo selection, pause, resume, or leave. A separate optional $1 USD PayPal Sandbox demonstration shows the explicit confirmation and server-verified payment boundary. It is not a purchase of the catalog merchandise.

## Why This Matters
We focus on continuity and control rather than pushing a checkout. Our engineering lesson was to reuse a capable shopping service and keep the connecting code small instead of rebuilding product search and translation.

## How We Used AI
The active runtime uses Channel3's hosted Conversational Agent via the official @channel3/sdk 4.8.0. It interprets shopper messages, remembers follow-ups and returns catalog-backed recommendations. Server-side requests specify the US market and USD.
Earlier prototypes used Ollama/qwen3:4b and custom extraction. Those experiments informed the project but are no longer the active chat path. No model can select, confirm or operate payment controls.

## How We Used Codex
Codex helped implement and simplify the integration, reproduce Croatian product/context errors, compare provider capabilities, add boundary tests, inspect the browser flow and document real evidence. The project owner personally performed PayPal login, Sandbox buyer approval and final app capture confirmation.

## Key Features
- Conversational product search with remembered refinements and category changes.
- Up to three provider-selected recommendations, with prices and merchant links.
- Native query visibility and source attributes under Catalog details.
- Native merchant-offer refresh requested through Channel3.
- Pause/resume and an explicit stop-without-buying outcome.
- Server-authoritative $1 USD Sandbox checkout, revision confirmation, session ownership, buyer/merchant distinction and idempotent recovery.

## Architecture
Next.js 16.4.5, React, TypeScript and Zod. The existing server route calls Channel3's official SDK directly. PayPal JavaScript SDK launches approval; the server uses Sandbox Orders API create/GET/capture. Private single-process file-backed session storage. There is no production payment switch or merchant fulfillment integration.

## Testing Instructions
See JUDGE_GUIDE.md and README.md for complete local setup.
Use your own authorized Channel3 key on the server. For optional reproduction of the payment demonstration, use your own Sandbox merchant app and its separate Personal Sandbox buyer. Never use real-money credentials and never publish server secrets.
Try a product request, a budget or brand refinement, and a category change. Pause and resume. Select a reference and correct the optional demo note; changing the choice clears confirmation. The optional payment must show COMPLETED only after server verification.

## Verified Evidence
Current checks: TypeScript and production build exit 0; 53 unit checks and 7 controlled browser checks pass. Ten real native-agent flow assertions passed for tested category transitions, continuity and price ceilings. These assertions do not establish every product detail.
On 10 November 2026, the owner completed the actual separate 1.00 USD Sandbox demo. Canonical PayPal GET verified order and capture COMPLETED, with different buyer and merchant identities. Evidence: evidence/paypal-completed-2026-11-10.json. This is actual Sandbox execution, not a mocked receipt.

## Public Demo Link
No hosted deployment claimed. The official requirements accept complete repository setup/run instructions, and live field 28787 was optional when checked on 10 November 2026. Use the local runnable source route. Re-check the final form before entry.

## Public Repository Link
https://github.com/sirolaalen-awm/shop-your-way
Public MIT repository exists. The final local source must be published and reverified before entry; do not assume the public default branch is already current.

## Demo Video
Final public YouTube URL: OPEN.
The earlier sample-only preview is not the final submission video. Use DEMO_SCRIPT_EN.md for the current English plan. Actual Sandbox completion is now available for the final evidence segment; do not repeat the transaction solely to record it.

## Screenshot Shot List
1. Actual current AI search and native query summary.
2. A price/brand refinement with relevant returned cards.
3. Pause without buying.
4. Explicit separate $1 Sandbox boundary.
5. Actual completed receipt, with no passwords or server credentials.

## Known Limitations
The provider still sometimes recommends synthetic/faux-down for a down-filled request, mixes response languages or returns imperfect fit/style matches. Material, size availability, shipping and merchant inventory are not guaranteed. A strict native fill/length/M test returned no products; it was not silently relaxed or claimed solved.
Hybrid/in-person mode is planning only, not store reservations. Storage is single-process. This is a hackathon prototype, not a production checkout or merchant fulfillment system.
PayPal's centrality remains a substantive evaluation question: the demonstrated payment is a separate Sandbox token, not catalog-goods purchasing. We disclose this boundary rather than claiming merchant checkout.

## TODO Official Form Fields — technical copy
28784: Shop Your Way uses PayPal JavaScript SDK and Sandbox Orders API for a deliberate, separately labeled $1 USD demonstration payment. The server binds each order to its session and confirmed cart revision, checks the fixed amount/currency, requires a distinct Sandbox buyer, and verifies COMPLETED capture against the canonical order. Channel3's Conversational Agent and catalog provide the active AI shopping experience through the official SDK. Codex assisted development and verification. Actual Sandbox completion was verified on 10 November 2026.
28786: Channel3.
28788: https://github.com/sirolaalen-awm/shop-your-way — after verifying final public source.
28787: Optional at the 10 November check. No fabricated hosted URL; use documented local runnable source.
28798: See JUDGE_GUIDE.md. No personal owner login is needed. Configure authorized API credentials server-side and use separate test-only buyer/merchant accounts for optional Sandbox checkout.
29053: Codex for implementation, debugging and evaluation; Channel3 Conversational Agent for the active runtime. Ollama/qwen3:4b was used in earlier experiments and is inactive now.
No Codex session ID field appeared.

## Owner-only answers still needed
Submitter type and team composition; residence and legal eligibility confirmations; New/Existing relative to 1 October 2026; subjective PayPal rating/reason; contact consent; learning/career responses. Do not infer or pre-check these.
Rules acknowledgment and final authorization to submit remain the owner's decisions.
DRAFT ONLY. No project entry has been sent to Devpost.
