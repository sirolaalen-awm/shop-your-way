# PayPal AI Hackathon — readiness, 3 November 2026

Official data retrieved read-only through Devpost Hackathons on 2026-11-03. No registration or submission was sent. Eligibility is not established from the user's language or timezone. The connected registration form returned `already_registered:false`, `can_register:true` at retrieval time; re-read before registering.

Sources: [official rules](https://paypalaihackathon.devpost.com/rules), [event and requirements](https://paypalaihackathon.devpost.com/), [announcements](https://paypalaihackathon.devpost.com/updates), [support Discord](https://discord.gg/sJ2G6DyvSK). Use the website as final authority. These are dated observations, not permanent claims.

## Exact official excerpts

> “NO PURCHASE OR PAYMENT NECESSARY TO ENTER OR WIN.”

> “Individuals who are at least the age of majority where they reside as of the time of entry”

> “What to Create: Entrants must build or update an application that integrates the PayPal developer platform (using the free sandbox environment) along with an AI tool, model, or platform of their choice”

> “Any AI tool works, as long as PayPal integration is central to the project.”

> “The repository must be public and open source by including an open source license file.”

> “All Submission materials must be in English or, if not in English, the Entrant must provide an English translation”

The rule text excludes sanctioned/prohibited jurisdictions (including Brazil, Quebec, Russia, Crimea, Cuba, Iran and North Korea), promotion entities and their employees/representatives/agents, relevant immediate families/households, judges and their employers, affiliates and other conflicts of interest. This is an operational summary, not a substitute for the full legal text and not a determination that a particular person qualifies.

## Dates

- Submission window: 1 October 2026 16:15 UTC – **12 November 2026 20:00 UTC / 21:00 Europe/Zagreb**.
- Latest announcement offers an early eligibility check for submissions by **5 November**; it does not specify a separate exact hour.
- Structured judging end: 15 December 2026 16:00 UTC. Working access must remain available through judging.
- Read the official dates before final submission. The rules and structured dates disagree on the winners-announcement hour; no operational decision here relies on that hour.

## Required delivery and this project's current position

| Requirement | Current state / action |
|---|---|
| Eligible individual/team/organization | Participant must confirm residence, age of majority and absence of excluded affiliations/conflicts. Not inferred. |
| Devpost registration | Pending required answers and explicit agreement/authorization. Confirmed answers are held only in an ignored local draft; marketing and conflict-of-interest are unanswered. User explicitly prohibits submission before approval. |
| Meaningful PayPal + AI | App contains one-model intent/search loop and server PayPal Sandbox create/capture. Actual local model and real Sandbox capture must be separately evidenced; code alone does not prove them. |
| Functional demo | Local build and run instructions prepared. Hosted deployment not mandatory in official prose, but the form has a required demo/test-build URL: verify an acceptable URL when preparing submission. |
| Public open-source repository | https://github.com/sirolaalen-awm/shop-your-way created on the connected account under the original public-repository build authorization. Source, MIT LICENSE, env template and README are in the publication package. Verify final public contents and license detection. |
| Text description and tools disclosure | README identifies model options, PayPal, Channel3 and code assistance. Submission copy not sent. Actual used model and integrations must be stated honestly. |
| Public YouTube video under 3 minutes | Recording plan prepared; video not recorded/uploaded. Must show actual functioning integrations. |
| Third-party usage rights | Merchant/catalog results not our merchandise. API account authorization and branding/data permissions still require review before public materials. MIT covers our source only. |
| Judge access | Instructions exist. Provide permitted Sandbox test access privately through appropriate judging instructions; never publish server secrets. Keep working access through judging. |
| Optional sponsor integrations | Channel3 is optional for basic eligibility, required by our chosen product brief. Do not claim Channel3 sponsor eligibility without a real authorized integration and sponsor-specific requirements check. |

Judging criteria are equally weighted in the official rules: Technological Implementation, Design, Potential Impact, Innovation/Idea, Presentation (tool reports 1–5 scale). No guaranteed eligibility, award or novelty is claimed. The separate $1 Sandbox token is an honest way to demonstrate checkout without pretending to sell catalog merchandise; whether this makes PayPal sufficiently central remains a substantive judging risk. Show the complete intent → correction → confirmed cart → actual Sandbox capture journey.

## Next necessary human-controlled steps

1. Confirm required registration answers and personal eligibility. Read the full rules and terms before authorizing registration; nothing is auto-agreed.
2. Create/access your PayPal Developer Sandbox app and separate buyer account; put credentials locally in `.env.local`.
3. Create authorized Channel3 API access and put its key locally. Credentials are never needed in this chat.
4. Confirm a GitHub destination, publish only this project's reviewed source, verify public accessibility and license detection.
5. Finish actual API/payment acceptance, record the short English video, provide test access, then review the final submission before authorizing it.

**A note on accuracy:** this guide is a helper. The information on the Devpost website is the correct and accurate version — if there is ever any discrepancy between what you read here and what the website says, the website prevails.
