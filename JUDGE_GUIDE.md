# Judge guide — Shop Your Way

## What you are evaluating
A shopper-led conversational catalog experience with a separate optional PayPal Sandbox payment demonstration. No catalog merchandise is sold or fulfilled.

## Local build
1. Install Node.js 22+ and npm.
2. Clone the public source repository and enter its folder.
3. Run npm ci.
4. Copy .env.example to .env.local. On Windows: Copy-Item .env.example .env.local.
5. Set CHANNEL3_API_KEY using your authorized Channel3 developer account. Keep it server-side.
6. Keep APP_ORIGIN=http://127.0.0.1:3000 and run npm run dev.
7. Open http://127.0.0.1:3000/.

Ollama and OpenAI credentials are not required for the active app. Channel3 calls consume the configured account's credits. Without a key, only the explicitly labeled fictional samples in Demo tools are available; those do not reproduce live AI/catalog behavior.
No public hosting is claimed. This repository and these instructions are the runnable-build access route.

## Suggested conversational evaluation
Start: “I need a 55-inch TV under $500. Keep it simple.”
Refine: “Under $400 instead.”
Then: “No price limit.”
Check the native query and prices, then press Stop without buying. Resume and try a new product, for example “I need a cordless drill.”
For Croatian continuity, try “ženske cipele za svaki dan s niskom petom”, then “malo ženstvenije”.
These are evaluation prompts, not guaranteed outcomes; provider catalogs and answers change.

## Optional separate Sandbox payment
To reproduce payment, configure PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET from your own Sandbox REST app. PayPal provides separate default Business seller and Personal buyer test accounts in its Developer Dashboard.
1. Choose a catalog reference or explicit fictional sample.
2. Optionally save a demo note. No size/color is reserved.
3. Review the separate fixed $1 USD token notice and confirm the demo cart.
4. Use Pay with PayPal and sign in with the distinct Personal SANDBOX buyer.
5. Approve the test. If returning through the manual approval link, press Verify approval and complete $1 Sandbox demo in SYW.
6. Completion must show a server-verified COMPLETED receipt.

Do not use the project owner's personal PayPal login, real-money credentials or a merchant login as the buyer. Server secrets are not published. A browser return URL alone is not success.
If a payment attempt is unresolved, use the original session's verification action; do not reset and create another order.

## Proven completed demonstration
On 10 November 2026, actual order/capture completion for the separate 1.00 USD Sandbox token was independently checked by canonical PayPal GET. Both were COMPLETED and buyer differed from merchant. See evidence/paypal-completed-2026-11-10.json.
No new payment is needed merely to inspect this proof.

## Automated verification
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e

Browser checks use fictional samples and controlled callbacks; they are not substituted for live payment evidence. Use isolated DATA_DIR and SYW_DIST_DIR when another local instance is running; see README.

## Limits
The prototype uses a private persistent DATA_DIR on one process. Do not run multiple replicas on these files. External results can mismatch material, fit, variants or availability. In-person planning does not reserve goods or appointments. The separate Sandbox token is not catalog checkout.
