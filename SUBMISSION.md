# Devpost submission: Rotapot

Copy each section into the matching Devpost field.

---

## Project name
Rotapot

## Tagline
An AI treasurer for stokvels, mukando and diaspora savings circles. Built on PayPal, with the treasurer in control.

## Links
- Live demo: https://rotapot.simakk.co.za (judge login in *Notes for judges*, or sign up with any email)
- Code: https://github.com/simandebvu/rotapot
- Video: https://youtu.be/6AdlBTQAcvI

## Prize categories to tick
- Best Use of Agentic Commerce
- Most Impactful
- Best Use of PayPal + AI

---

## Inspiration

Across Southern Africa, millions of people save in rotating savings circles. South Africans call them stokvels; Zimbabweans call them mukando or rounds. Every month each member puts in the same amount, and the whole pot goes to one member, in turn. People use these circles to pay school fees, build a house back home, or buy a fridge.

The part I wanted to fix is the admin. A circle can run on a WhatsApp group, a notebook and one person doing all the chasing. When members are spread between Harare, Johannesburg, Leicester, Dublin and Dallas, that job gets harder. I built Rotapot for the person keeping it all together.

## What it does

Rotapot gives the treasurer an AI assistant for the chasing and the bookkeeping, with PayPal handling contributions and payouts. The treasurer decides when to release the pot. The agent has no payout tool.

- **Start a real circle in two minutes.** Sign up, verify your email, and build a circle: amount, due date, members, rotation order. Rotapot emails each member a signed invitation. They create their own account, accept the rules and give the PayPal email where their pot should land. The treasurer then launches the circle.
- **The agent works while you're away.** Every morning the treasurer agent goes through each of your circles on its own, without anyone opening the app. Following each circle's rules, it sends the reminders that are due and puts any fully paid pot up for your approval. When you sign in, a briefing is waiting, labelled as something it did on its own. You can watch every step, including the actual tool calls.
- **Agent-first, not dashboard-first.** Every circle can be run from outside the app. Rotapot exposes the same nine treasurer tools as an MCP server, so a treasurer can connect any MCP-capable agent with a personal key and say "chase whoever is late in the Leicester round." The guardrails are the same as in the app: an outside agent can propose a payout but never release one.
- **Collects through PayPal.** Every member gets a personal PayPal checkout link (Orders API). The pay page greets them in their own language and shows when their turn to receive the pot comes.
- **Writes to members in their own language.** The demo supports Shona, Ndebele, isiZulu, Sesotho, Setswana and English. Messages appear in an in-app WhatsApp-style conversation; real WhatsApp delivery is a next step. The agent follows each circle's reminder instructions, and code blocks repeat reminders to the same member within 12 hours. The language templates still need native-speaker review before real use.
- **Members can reply, and the agent handles it.** "I already paid" gets checked against PayPal before anyone is accused of anything. "Can I pay half now and the rest Friday?" gets an answer in the member's language. The agent checks their payment history and proposes an instalment plan, which the treasurer approves or declines with one tap. A member on a plan pays the right instalment from the same link.
- **A person always releases the money.** The agent can only *propose* a payout. Money moves through PayPal Payouts only when the treasurer taps Release. The agent has no tool that can release the pot. When she releases it, gold flows round the pot into the recipient, the circle turns to the next person, and the recipient gets a WhatsApp-style message.
- **Trust passport.** Each member has a payment record across their circles: years saving, on-time rate, streak and a dot for each payment. The agent reads that history when considering a payment plan. I wanted reliability that usually lives in someone's notebook to be visible. The demo's historical records are seeded; this is not a credit score or a lending product.

## How I built it

- **Next.js 15 + React 19 + TypeScript.** The treasurer dashboard, the member pay pages and the API routes.
- **Accounts.** Better Auth with email verification and password reset (Resend), signed invitation links, and signed per-member pay links. Every circle is scoped to its own account.
- **MCP server.** A stateless Streamable HTTP endpoint (`/api/mcp`) exposes the agent's nine tools with per-account bearer keys, which are stored hashed and can be revoked. There's also an `llms.txt` describing it.
- **Claude as the agent.** I used the Anthropic SDK with a custom tool loop, so you can watch each step as it happens. The same loop runs in three places: on demand in the app, on a daily schedule (a systemd timer calls a secret-protected endpoint that briefs every account), and behind the MCP server for outside agents. The agent has nine tools: read all circles, read one circle, check a payment with PayPal, send a reminder, reply to a member, read a member's trust passport, propose a payment plan, propose a payout, and check a payout's status. Payment verification can also capture a checkout the member has already approved but which has not yet been captured.
- **PayPal.**
  - **Orders v2** handles each contribution: create the order, capture it, and look up its status to check a member's "I already paid".
  - The **PayPal JS SDK** puts the checkout buttons on the member's page.
  - **PayPal Agent Toolkit** (`@paypal/agent-toolkit`) gives the agent a short allowlist of PayPal's own tools: it searches the PayPal transaction ledger and looks up orders to reconcile a circle's books, and drafts and sends a PayPal invoice when a member asks for one. Order creation, payment, refunds and disputes are deliberately left off, so the agent still cannot move money.
  - **Webhooks** (`PAYMENT.CAPTURE.COMPLETED`, `CHECKOUT.ORDER.APPROVED`), signature-verified with PayPal, book a contribution even if the member closes the tab before the browser capture finishes.
  - **Payouts v1** releases the pot to whoever's turn it is. Each payout uses a fixed batch ID per cycle, and each capture uses a request ID, so a double tap can't pay twice.
- **Guardrails in code, not just in the prompt:**
  - A payout can only be proposed once every member has paid.
  - Payment plans must add up to what the member owes and fall within 21 days of the due date.
  - The agent can't send duplicate reminders.
  - Only the treasurer's approval route can release money.
- **Design.** The pot ring is patterned on *shweshwe*, the indigo-printed cotton worn across Southern Africa. Members sit around it, and it physically turns when a payout is released.

## Business model

The circle ledger is free: the books, the invitations, the pay links and the trust passport. Building a dashboard is cheap now, so charging for one makes little sense. What saves the treasurer hours every month is the agent: it chases payments, handles member replies, reconciles with PayPal and gets payouts ready. That's what a circle would pay for, as a small flat fee per circle per month or a small share of each released pot, which is about what members already chip in to thank the person who keeps the notebook.

## Challenges I ran into

- **Deciding what the agent is allowed to do.** I wanted it to do useful work, rather than just suggest things in a chat window. It can write reminders, check contributions and propose plans, but releasing a pot stays with the treasurer. Payout readiness, reminder cooldowns and payment-plan limits are checked in code.
- **Writing in five Southern African languages** naturally and kindly, never like a debt collector.
- **Keeping it useful when things get messy.** I fixed an early problem where closing the tab interrupted the agent's run. I also adjusted its instructions after it treated an early instalment as suspicious. Paying early should not make someone look less reliable.
- **Showing the agent's work** without overwhelming people: plain-language steps, with the literal tool call next to each.

## What I’m proud of

- One briefing covers the demo's three circles across five countries, with a visible record of what the agent did.
- A member writes in isiZulu, and within seconds the agent has checked their record, answered them in isiZulu and put a plan in front of the treasurer.
- The trust passport turns years of quiet reliability into something visible.
- It's built for how these circles actually work: rotating payouts, members in the diaspora, WhatsApp, and kindness.

## What I learned

The biggest lesson for me was how much of the work sits outside the model. The model can write a kind reminder, but the application still needs to know whether that reminder is allowed, whether a payment has actually arrived and who can release the pot. I got a better result by making those boundaries explicit. That is useful beyond this project: I can apply the same approach to building practical AI features for other products, with clear permissions, visible actions and a working payment flow.

## What's next for Rotapot

- Real WhatsApp delivery and inbound messages through the WhatsApp Business API.
- Local payment rails alongside PayPal (for example PayShap in South Africa). PayPal doesn't settle in rand, so the demo runs in US dollars, which fits Zimbabwe and the diaspora.
- Explore a portable payment record that members can choose to share, with proper consent and validation before any use in financial decisions.
- Native-speaker review of every message template, and more languages: isiXhosa, Tshivenda, Xitsonga, chiChewa.

## Built with
nextjs, react, typescript, claude, anthropic-sdk, model-context-protocol, paypal-agent-toolkit, paypal-webhooks, paypal-orders-api, paypal-payouts-api, paypal-js-sdk, better-auth, resend, sqlite, node.js, caddy

---

## Notes for judges
- The demo uses PayPal **sandbox**; no real money moves.
- **Judge login:** `JUDGE_EMAIL` / `JUDGE_PASSWORD` (a verified account). Or sign up with your own email; the verification email is real.
- **PayPal sandbox buyer** for checkout: `SANDBOX_BUYER_EMAIL` / `SANDBOX_BUYER_PASSWORD`.
- Fastest path: sign in, choose **Explore sample circles**, watch the briefing, open a circle, pay as a member from the pay link, then release the payout. For the full invitation journey, use two email addresses.
- To try the MCP server, create a key under **Connect an agent** and use the config snippet shown there. The README also has a curl example.
- Historical payment records in the sample circles are seeded. Messages stay in the in-app outbox; they are not delivered through WhatsApp.
- This is a prototype (a per-account JSON store and SQLite for auth), not a production financial service.
