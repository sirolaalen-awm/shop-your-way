# Shop Your Way

**Happy Customer, Happy System.** A shopper-led AI assistant: your needs, your pace, your choice.

Next.js / TypeScript, one tool-calling model, server-side Channel3 product search and server-side PayPal Sandbox create/capture. Shopping behaviors are continuous assistance weights, not separate agents or rigid profiles. No inventory database or multi-agent runtime.

## Run locally

Node.js 22+ and npm are required.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Windows PowerShell: use `Copy-Item .env.example .env.local` instead of `cp`. Open http://127.0.0.1:3000. Set `APP_ORIGIN` to the exact browser origin (localhost and 127.0.0.1 differ). Restart after changing credentials.

### AI: choose one provider

Default is **local Ollama**, with `qwen3:4b`:

```sh
ollama pull qwen3:4b
ollama serve
```

Set `AI_PROVIDER=ollama`, `AI_MODEL=qwen3:4b`, `OLLAMA_BASE_URL=http://127.0.0.1:11434`. Ollama must be installed separately. A real model is required for conversation: there is no scripted fallback pretending to be AI. Local hardware affects speed and model reliability.

Alternatively set `AI_PROVIDER=openai`, `AI_MODEL` to a Responses API tool-capable model you can access, and `OPENAI_API_KEY`. Hosted inference may incur charges and is opt-in. The app uses the Responses API with `store:false`; that flag does not replace the provider's data-use policy. Do not enter sensitive personal/payment data into chat. No hosted model calls were required for the local checks.

### Channel3

Create your own authorized account via https://www.trychannel3.com/developers/ and set `CHANNEL3_API_KEY` **on the server**. Search uses `POST https://api.trychannel3.com/v1/search`, `x-api-key`, `{query,limit:3}` and a price filter only for USD budgets (no implied currency conversion). Current documented `{products:[{id,title,images,offers:[{price:{price,currency},domain,url,availability}]}]}` is normalized. Actual account/API access is required to validate live results. A configured key is not proof of successful integration.

With no key, the UI explains that no catalog call was made. “Open fictional sample products” is an explicit separate action. Samples are fictional, labeled, and never passed off as Channel3 results. An API error never silently changes sources. External product text is untrusted data and cannot authorize any purchase. Returned prices and observations are not confirmed physical stock, reservations, size availability or discounts.

### PayPal Sandbox

1. Sign in to https://developer.paypal.com/dashboard/ using your own PayPal account.
2. Under **Apps & Credentials → Sandbox**, create/use a REST app and set its `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` in `.env.local`.
3. Under **Testing Tools → Sandbox Accounts**, use a business merchant and a separate personal buyer account. Use only Sandbox buyer credentials in the PayPal approval popup.
4. Choose a result or explicit sample, save a variant preference, and confirm the demonstration cart.
5. Approve the **$1.00 USD Sandbox demonstration token** through the PayPal JavaScript SDK button.
6. The app creates and captures via the Sandbox Orders API. It displays success only after checking the order, session identity, amount, currency and completed capture ID on the server.

**Catalog browsing and demo checkout are separate.** The selected catalog product is a reference, not a seller-authorized listing in our store. We have no merchant purchase integration. This $1 token creates no physical goods order, delivery, inventory claim or reservation. There is no production PayPal switch in the code. Live PayPal money must never be used here.

Server controls: the browser supplies no payment amount; current revision must be confirmed; cart corrections invalidate confirmation and pending order association; order ID is bound to the session; create/capture use stable idempotency keys; GET-before-capture recovers completed orders after response loss. HTTP errors and pending captures are not success. Do not reset the session during an unresolved payment: return to the original session and retry for reconciliation before starting a new demo.

## Demo scenarios

1. **Shoes / practical and price-conscious:** “Comfortable walking shoes for daily commuting, under $100. Keep it simple.” Then “Actually, wide fit matters more than the lowest price.” Watch the remembered goal and changing assistance weights.
2. **TV / exploration:** “I’m exploring a TV for a small room under $600. Help me compare picture quality; no rush.” Then request only two options. No unsolicited accessories.
3. **Hybrid:** “I want to try the shoes in person before choosing online.” The route changes while the goal and budget remain. No store stock or appointment is asserted. Select another result, correct size, confirm the separate demo cart, complete Sandbox checkout, or stop without buying.

## Checks and evidence

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
# Explicit optional real local-model smoke test, no paid model calls:
node --import tsx scripts/local-model-smoke.ts
# With the local app running, actual browser + local AI (no external credentials):
node --import tsx scripts/browser-model-smoke.ts
```

Unit tests use injected model/catalog/payment responses: they verify boundaries, not real third-party integration. Browser tests operate the actual app without calling payment APIs; sample products are explicitly selected. The local-model smoke test uses a real installed Ollama model and a controlled catalog boundary, and records its actual replies in `evidence/`. Never describe these checks as a successful live Channel3 request or real Sandbox payment. See `BUILD_STATUS.md` for the dated results and blockers.

## Architecture and limits

- `src/lib/ai.ts`: one model, schema-validated intent extraction and a bounded `search_products` loop; no model payment tool. OpenAI uses native Responses function calls. Local Ollama uses a schema-constrained JSON tool-request protocol because the installed small model's native tool template proved unreliable. Explicit English/Croatian route and pace phrases override model guesses through a small tested parsing guard; unrecognized phrasing still relies on the model and is not guaranteed.
- `src/lib/catalog.ts`: Channel3 adapter, provenance, HTTPS link filtering and explicit fixtures.
- `src/lib/domain.ts`: original/current intent, selection, route, revision and demo receipt.
- `src/lib/paypal.ts`: fixed Sandbox endpoint, trusted amount, payment evidence checks.
- `src/lib/store.ts`: cookie-bound, per-session serialized JSON storage, atomic writes and pre-request idempotency checkpoint.
- `src/app/api/shop/route.ts`: validated actions, same-origin POST, httpOnly/sameSite cookie; secrets remain server-side.

This is a **single-process hackathon prototype**, not a production payment service. Use a persistent private `DATA_DIR` volume. Do not deploy multiple workers/replicas against these files or ephemeral serverless storage: locks are process-local. Session validity is 24 hours of inactivity; files are not automatically deleted. Delete `.data` only when no unresolved payment exists and the server is stopped. Never commit it. It contains conversations and Sandbox payment IDs.

For public hosting, add admission/rate limits before enabling hosted AI or Channel3 credits, bound disk retention, and provision persistent storage. Run `npm run build` then `npm start`; the script binds localhost, so configure an explicit trusted reverse proxy for public access and HTTPS, set `APP_ORIGIN` accordingly. A repository with complete local setup can meet the functional-demo access route; public hosting is not required by the official prose. Submission fields still request a demo/test-build URL: verify which accepted URL to provide rather than inventing a hosted deployment.

## Hackathon readiness

Not registered or submitted by this build. See `HACKATHON_READINESS.md`. Public repository: https://github.com/sirolaalen-awm/shop-your-way. A working real Sandbox capture, judge setup, and public YouTube video under three minutes must still be supplied and verified. `DEMO_PLAN.md` is a recording plan, not a completed video. MIT license covers this application's source, not third-party catalog data, merchant trademarks or model weights. Google Fonts are fetched by CSS (DM Sans and Libre Caslon Display under their own open font licenses); the UI uses system fallbacks offline.

## Primary documentation

- [Channel3 search](https://channel3.ai/docs/guides/make-a-search) and [response schema](https://channel3.ai/docs/guides/response-overview).
- [PayPal standard JS/server checkout](https://developer.paypal.com/docs/checkout/standard/integrate/) and [Orders API](https://developer.paypal.com/docs/api/orders/v2/).
- [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling).
- [Official hackathon rules](https://paypalaihackathon.devpost.com/rules).
