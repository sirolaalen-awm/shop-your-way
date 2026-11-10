# SYW reuse patch — 2026-11-09
Status: implementation authorized by user; this document is the concrete change plan, not a claim of completion.

## Verified reuse
Official Channel3 @channel3/sdk 4.8.0 provides conversations.createTurn -> conversation_id, message.parts and usage. Direct account tests confirmed Croatian vest and bra/brand follow-ups. Native search config supports US/USD. This replaces our custom two-stage Ollama request editor and category/search orchestration in the live chat route.
Sources: https://channel3.ai/docs/conversations/run-a-turn ; https://channel3.ai/docs/conversations/messages-and-parts ; installed SDK declarations.

## Keep
Existing app, palette/layout, merchant links, at most a few cards, file-backed session, explicit selection/cart revision, stop/resume/reset, all server-side PayPal authorization checks and separate $1 Sandbox demo. No payment during tests.

## Replace
Live chat route calls a small server-side SDK adapter. One user message goes directly to Channel3 with stored conversation_id. The initial application context asks for a calm shopper-led assistant, current product continuity, no unrequested alternatives/upsell, up to three recommendations, user's language, and honest no-goods/$1 demo boundary. Application policy remains locally enforced; agent text cannot operate checkout.
No new LLM bridge, product-name dictionary, home-made category matcher or extra product evaluator in the active path.
Use the official JSON turn method; no hand-written streaming protocol or client token is necessary because our requests already run server-side. API key never reaches the browser. Disable automatic retries to avoid silently repeating billed turns.

## Adapt only at the boundary
Normalize native products with the existing card mapper. Display only products actually referenced by cp:id or explicitly selected by native display tools, up to three cards; do not fill remaining slots from broader search candidates. Render native cp labels as plain product names without broken pseudo-links.
Store remote conversation ID privately. Persist current native search query as the visible request summary; do not claim separately extracted size/material/budget fields when the service did not return such a schema. Hide stale pre-migration fields and misleading no-budget labels for this path.
Clear stale selectable results/confirmation when a new turn starts or fails. No silent fallback to Ollama or fictional samples.
Preserve old implementation initially as inactive reference until verification is complete; do not claim its tests prove the new adapter.

## Verification
- SDK/mocked contract tests: continuation, initial context only once, US/USD, product reference ordering, errors, stopped sessions, revision invalidation, no financial calls and no fallback.
- TypeScript, production build, existing browser/cart/payment-boundary suite.
- Real existing-app API/browser: Croatian vest size M -> refinement, bra -> Victoria typo, TV -> price correction, footwear refinement -> drill; reload, pause/resume/reset.
- Record native queries, titles, response times and limitations, not just HTTP 200.
- If native search still returns wrong materials or product categories, report evidence rather than invent another language patch.
No publish, deployment, video upload, Devpost submission or payment is part of this patch.

## Execution result
Implemented locally. See REUSE_IMPLEMENTATION_2026-11-09.md for actual final checks, the initial failed run, native-agent limitations and unchanged publication/payment status.
