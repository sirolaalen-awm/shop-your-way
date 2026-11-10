# SYW — native shortlist finishing changes — 2026-11-09
Implemented locally in the existing app. This report supersedes the earlier card-filling behavior in REUSE_IMPLEMENTATION_2026-11-09.md.

## Changes actually made
- Removed our automatic filling of up to three card slots from a broad search_products candidate pool.
- Cards now come only from native cp:id recommendations or native explicit show_products/compare_products selections, up to three. One or two recommendations remain one or two.
- Enabled the official SDK config offer_refresh_timeout_ms:2000 on every native conversation turn. This requests Channel3's merchant-offer refresh; it does not independently establish every stock/variant statement.
- Kept native structured_attributes on product cards and displayed their unmodified values under Catalog details. These are catalog data, not independently verified merchant facts.
- An unlinked broad candidate pool no longer produces selectable recommendations. Empty-state wording now says no shortlist, rather than pretending no product exists.
- No new translator, synonym dictionary, category engine, automatic second model or payment operation.

## Native strict-filter investigation
Official SDK types and real category metadata were inspected. Metadata for vests did not include down insulation, while vests-3 listed insulation-fill-material values Duck down, Goose down and Down blend.
A real conversation call with native gender female + these fill values + Long + Medium (M) returned no products (evidence/native-exact-filter-test.json). The agent's final text was incomplete. This is not evidence that such products are unavailable.
These restrictive values were NOT hardcoded into all shopping turns or silently relaxed, and no claim of a solved automatic material filter is made.
Category metadata: evidence/native-filter-category-probe.json.

## Actual checks
- TypeScript final exit 0; evidence/shortlist-typecheck-final.log.
- Unit suite 53 passed, 0 failed; evidence/shortlist-unit-final.log. New checks verify that unselected broad candidates never fill cards, explicit native display remains usable and malformed attributes are not presented as valid source arrays.
- Production build exit 0; evidence/shortlist-build-final.log.
- Existing browser suite 7 passed, 0 failed; evidence/shortlist-browser.log. Isolated data/build directory; controlled financial fixtures only.
- Real native SDK/catalog flow 10/10 category, continuation and price assertions passed; evidence/reuse-shortlist-live.json. Existing vest, black/USD150, bra, Victoria typo, TV USD500->400->unlimited, daily shoes, feminine refinement and cordless-drill scenarios. Zero Ollama/OpenAI calls. Eight cases displayed two recommendations, two displayed three. Times 4.537–7.851 seconds in these samples.
- Actual existing localhost browser: repeated the same black long vest size M / USD150 request. Only two cards were shown, exactly the two linked native recommendations. Opened Catalog details and observed source attributes (e.g. Polyester, Long). No third card added.
- Screenshot: AWM workspace outputs/syw-native-shortlist-2026-11-09.jpg.
- An initial TypeScript/build failure in a deliberately malformed test fixture is retained in shortlist-typecheck.log and shortlist-build.log. The fixture type was corrected; final source checks passed. Do not count the earlier failed run as PASS.

## Remaining confirmed limitation
The native agent still recommended synthetic/faux-down insulation for a down-filled request and claimed it matched the conditions. The actual browser catalog description of Women's Karis Gale Long Vest explicitly said synthetic faux down. Exposing its source values does not fix that mismatch.
The 10/10 assertions do NOT cover strict down fill, every size/color variant or every merchant specification. No claim that the full product-relevance issue is solved.
Provider-recommended-only cards remove an error introduced by our adapter; they cannot guarantee that the provider's recommendation is correct.

## Boundaries
Accepted design retained. No payment/capture/order creation, new project, source push, deployment, video upload or Devpost submission. PayPal remains a separate explicit $1 Sandbox demo.

## Primary sources
https://channel3.ai/docs/conversations/run-a-turn
https://channel3.ai/docs/conversations/messages-and-parts
https://channel3.ai/docs/guides/category
Installed @channel3/sdk 4.8.0 SearchConfig/SearchFilters/CategoryAttribute/Product declarations.
