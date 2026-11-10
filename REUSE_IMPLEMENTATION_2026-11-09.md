# SYW — ready-made Channel3 bridge implementation — 2026-11-09

Implemented in the EXISTING Shop Your Way application. The approved reuse patch is REUSE_PATCH_2026-11-09.md. This is completed local implementation and verification, not publication or hackathon submission.

## Actual active path
Browser -> existing /api/shop -> channel3-companion.ts -> official @channel3/sdk 4.8.0 conversations.createTurn.
Channel3 handles conversation memory, natural-language refinements and catalog search. The native conversation ID is private session state; later turns send it back directly. There is no active Ollama/OpenAI intent extraction, custom product translator, category matcher or LLM evaluation of catalog cards in this route.
Our adapter is 55 lines including blank lines, the app context and boundary/error handling. This count is descriptive, not a quality metric.
The earlier local-model modules/tests remain inactive reference; they are not a hidden fallback or proof of the new agent.

## Reused / preserved
- Official SDK, JSON turn method, native message/tool/product schema and conversation persistence.
- Existing SYW colors/layout, three cards, existing merchant links and card normalization.
- Referenced cp:id products are prioritized before filling remaining card slots. cp labels become readable product names, not broken pseudo-links.
- Server-only key; no key or conversation ID exposed in publicSession. US country, English catalog locale and USD config sent on every turn.
- Existing user-controlled cart, stop/resume/reset and separate $1 Sandbox payment boundaries.
- Initial app context explains general retail scope, calm support, up to three recommendations and no merchant-goods/payment authority.
- No automatic retry or alternate-model fallback. Failed turns clear selectable old cards and confirmation.
- Current request panel displays the native search query. Stale old extracted fields and misleading “No price limit” labels are suppressed; we do not pretend the agent returned a structured intent schema.
- README and .env.example updated: Ollama is not required to run the active app. Earlier README archived under evidence/retired/2026-11-09-reuse/.

## Verification actually executed
Final typecheck, unit, production build and browser command exits: all 0, evidence/reuse-check-exits-final.json.
- Unit suite: 51 passed, 0 failed; evidence/reuse-unit-final.log. Four new native-adapter tests cover continuation/context/US configuration/private state, reference ordering, stale-card clearing, failure without fallback, pause/unresolved-payment guard and unsafe-link/foreign-currency boundaries. Retained suites include legacy intent contracts and existing financial/session tests; all 51 are not claimed as new-agent semantic tests.
- Browser suite: 7 passed, 0 failed; evidence/reuse-browser-final.log. Isolated temporary storage and .next-slot-tests. Controlled payment fixtures only.
- Production build: exit 0, .next-slot-build; evidence/reuse-build-final.log.
- Actual official SDK + hosted agent + real catalog: 10/10 recorded category/continuation/price assertions passed; evidence/reuse-live.json, checkedAt 2026-11-09T14:36:21.099Z. Observed 4.206–6.626 seconds per turn. No local Ollama or OpenAI calls.
  Cases: Croatian quilted down vest size M; black vest with USD150 ceiling; switch to bras; Victoria's Secret typo refinement; 55-inch TV under USD500; cap to USD400; remove ceiling; daily low-heel shoes; feminine refinement; switch to cordless drill.
- Existing localhost browser: migrated the real existing session, sent Croatian vest request and black/USD150 refinement. Query retained long/down/size M and changed color/ceiling; three USD cards shown. Stop disabled entry/selection, resume restored them, reload retained native query, messages and cards.
- Screenshot: AWM workspace outputs/syw-channel3-agent-2026-11-09.jpg.

## Failures retained and limits
Initial integration run was 8/10, preserved in evidence/reuse-live-initial.json. The native agent incorrectly refused two category changes, including drill after shoes. Declaring SYW's general-retail scope in the official application_context was followed by a 10/10 fresh-conversation run. This is sample evidence, not a universal reliability guarantee.
Ready-made native agentic search mode was also tried once, evidence/reuse-native-agentic.json (5.72 seconds, usage 2 credits/1 search). It did not establish strict material compliance, so default mode was retained.

IMPORTANT: 10/10 measures the named assertions, not every product detail. The provider still returned a Featherless vest for a down-filled request, sometimes suit/wool-style vests, and a ballet flat among low-heel refinements. Replies sometimes mixed Croatian and English. Native query preserved constraints, but retrieval did not satisfy all of them. No homemade material synonym/ranking patches were added.
A Canadian retailer domain also appeared despite requested US/USD configuration; shipping to the US was not independently verified. Size M availability, material, long cut and stock must be checked against merchant evidence. Hosted agent output must not be treated as a confirmed reservation or purchase.

## Exact changed runtime files
package.json/package-lock.json; src/lib/channel3-companion.ts (new); src/lib/domain.ts (private native state/public query); src/app/api/shop/route.ts (active import/provider); src/app/page.tsx (native summary/no stale field claims); README.md; .env.example.
tests/channel3-companion.test.ts and scripts/reuse-live-probe.ts provide reproducible checks.

## Still outside this change
No payment, capture, merchant order, new app/project, public deployment, source push, final video upload or Devpost submission. Public repo still needs the reviewed final source published under the separate submission preparation plan.
Outstanding product-quality work is to use supported provider filtering/verification where available and evaluate mismatches; do not silently recreate a home-made search engine or claim all criteria now work.

## Primary sources
https://channel3.ai/docs/conversations/run-a-turn
https://channel3.ai/docs/conversations/messages-and-parts
https://channel3.ai/docs/conversations/context
https://channel3.ai/docs/conversations/filters
Installed official SDK 4.8.0 declaration files were read to verify request, result, locale and retry options.
