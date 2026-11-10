# Shop Your Way

**Happy Customer, Happy System.** AI adapts to the shopper, at the shopper's pace.

## Current implementation
The existing SYW interface now uses the official **Channel3 Conversational Agent** through **@channel3/sdk 4.8.0**. One server-side call sends the shopper's message; Channel3 maintains the conversation, interprets refinements and returns text plus catalog products.
The active chat route does not call Ollama, OpenAI, the custom request editor or the custom category matcher. Earlier experiments and their tests remain as historical reference, not a hidden fallback.

SYW keeps the accepted interface, up to three explicitly recommended product cards (no automatic filling from broader search hits), merchant links, local session/cart controls, pause/resume/reset, and a separate optional PayPal Sandbox demonstration. The current request summary is the search query supplied by Channel3, not a second AI's invented form fields.

## Run locally
Node.js 22+ and npm are required.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

On Windows use `Copy-Item .env.example .env.local`. **On an existing installation, keep .env.local; do not overwrite existing credentials.**

Set `CHANNEL3_API_KEY` on the server using your authorized Channel3 account. Open http://127.0.0.1:3000/ and use matching `APP_ORIGIN`. Restart after changing environment settings. Ollama is not required for the active app.
Channel3 receives the shopping messages and keeps the remote conversation. This is hosted processing, not local inference. Credentials and the remote conversation ID are not returned in the public session response. No credentials belong in chat or source control.

The API uses the US market, English catalog locale and USD. The assistant is asked to reply in the shopper's language, recommend at most three relevant items and respect changes and stopping. Replies can still mix languages, and catalog matches are not guaranteed to satisfy every material, fit, size or stock constraint. Check with the merchant.

## Optional PayPal Sandbox demonstration
Set `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` from a Sandbox REST app on the server. A separate Personal Sandbox buyer is needed for user-controlled approval.
Select a product reference and explicitly confirm the separate **$1.00 USD Sandbox demonstration token**. No catalog merchandise is sold, delivered, reserved or ordered by SYW. Merchant product browsing and this demo payment are separate.

Only explicit app controls can create/approve/capture a Sandbox payment. Agent text has no payment authority. The server checks session ownership, revision, amount/currency, distinct buyer/merchant and completed capture evidence. Cart changes invalidate confirmation. An unresolved capture must be reconciled against its original order. Automated test fixtures are not proof of a real capture.

## Checks
```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
# Optional: actual authorized Channel3 calls, consuming account credits:
node --import tsx scripts/reuse-live-probe.ts
```

For browser tests while the app runs, isolate storage and build output:
```powershell
$env:DATA_DIR = Join-Path $env:TEMP ('syw-tests-' + [guid]::NewGuid())
$env:SYW_DIST_DIR = '.next-slot-tests'
npm.cmd run test:e2e
```

The live probe imports the same companion used by the route. Read its recorded assertions: HTTP 200 does not prove every merchant detail. Existing unit suites include historical local-model contracts and retained financial/session checks; new native-adapter tests cover continuation, context, card mapping and failures. The browser suite uses fictional samples and controlled payment callbacks, without real payment calls.

## Architecture
- `src/lib/channel3-companion.ts`: thin official SDK adapter, one native turn, private conversation ID, native query summary and card mapping. No automatic retries or silent fallback to another model.
- `src/app/api/shop/route.ts`: same-origin validated actions and serialized local transactions.
- `src/lib/catalog.ts`: existing normalization for display and explicitly labeled fictional demo samples. Its older direct search path is not called by active chat.
- `src/lib/domain.ts`, `store.ts`: cart/session ownership and single-process file storage.
- `src/lib/paypal.ts`: separate fixed-amount Sandbox Orders API boundary.

If Channel3 fails, selectable old cards are cleared and the failure is shown; no fictional or stale success replaces it. Stop/resume does not send a provider turn. Reset creates a new local session and the next message starts a new Channel3 conversation.
The explicit fictional sample button is for demo tools only, not a fallback masquerading as live search.

## Limits and judge access
This is a single-process hackathon prototype. Use private persistent `DATA_DIR`; do not use multiple workers or ephemeral serverless storage. Local sessions expire after 24 hours of inactivity, except unresolved payment attempts; files are not automatically deleted. Local reset/expiry is not a claim that the provider has deleted its stored conversation.

A complete repository setup is the local-demo route. No public hosted demo or final public YouTube video is claimed. Keep judge access available through judging. PayPal completion is not established by source code or mocked tests.
MIT covers SYW source only, not third-party catalog material or model/service rights.

## Current reports and primary sources
See `NATIVE_SHORTLIST_RD_2026-11-09.md` for the latest recommendation-only cards, native offer refresh, source attributes and remaining material mismatch. See `REUSE_PATCH_2026-11-09.md` for the authorized plan and `REUSE_IMPLEMENTATION_2026-11-09.md` for actual results and remaining limits. Earlier README is preserved under evidence/retired/2026-11-09-reuse/.

- https://channel3.ai/docs/conversations/run-a-turn
- https://channel3.ai/docs/conversations/messages-and-parts
- https://channel3.ai/docs/conversations/context
- https://channel3.ai/docs/conversations/filters
- https://developer.paypal.com/docs/checkout/standard/integrate/
- https://paypalaihackathon.devpost.com/
