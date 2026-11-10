# Devpost submission: Rotapot

Copy each section into the matching Devpost field.

---

## Project name
Rotapot

## Tagline
An AI treasurer for stokvels, mukando and diaspora savings circles. Built on PayPal, with the treasurer in control.

## Links
- Live demo: https://rotapot.simakk.co.za (demo sign-in, details pre-filled)
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

- **The agent works before you ask.** When Rudo, the demo treasurer, signs in, the agent goes through all three of her circles on its own. Following each circle's rules, it sends the reminders that are due and puts any fully paid pot up for her approval. Then it briefs her on what needs her. You can watch every step live, including the actual tool calls.
- **Collects through PayPal.** Every member gets a personal PayPal checkout link (Orders API). The pay page greets them in their own language and shows when their turn to receive the pot comes.
- **Writes to members in their own language.** The demo supports Shona, Ndebele, isiZulu, Sesotho, Setswana and English. Messages appear in an in-app WhatsApp-style conversation; real WhatsApp delivery is a next step. The agent follows each circle's reminder instructions, and code blocks repeat reminders to the same member within 12 hours. The language templates still need native-speaker review before real use.
- **Members can reply, and the agent handles it.** "I already paid" gets checked against PayPal before anyone is accused of anything. "Can I pay half now and the rest Friday?" gets an answer in the member's language. The agent checks their payment history and proposes an instalment plan, which the treasurer approves or declines with one tap. A member on a plan pays the right instalment from the same link.
- **A person always releases the money.** The agent can only *propose* a payout. Money moves through PayPal Payouts only when the treasurer taps Release. The agent has no tool that can release the pot. When she releases it, gold flows round the pot into the recipient, the circle turns to the next person, and the recipient gets a WhatsApp-style message.
- **Trust passport.** Each member has a payment record across their circles: years saving, on-time rate, streak and a dot for each payment. The agent reads that history when considering a payment plan. I wanted reliability that usually lives in someone's notebook to be visible. The demo's historical records are seeded; this is not a credit score or a lending product.

## How I built it

- **Next.js 15 + React 19 + TypeScript.** The treasurer dashboard, the member pay pages and the API routes.
- **Claude as the agent.** I used the Anthropic SDK with a custom tool loop, so you can watch each step as it happens. The agent has nine tools: read all circles, read one circle, check a payment with PayPal, send a reminder, reply to a member, read a member's trust passport, propose a payment plan, propose a payout, and check a payout's status. Payment verification can also capture a checkout the member has already approved but which has not yet been captured.
- **PayPal.**
  - **Orders v2** handles each contribution: create the order, capture it, and look up its status to check a member's "I already paid".
  - The **PayPal JS SDK** puts the checkout buttons on the member's page.
  - **Payouts v1** releases the pot to whoever's turn it is. Each payout uses a fixed batch ID per cycle, and each capture uses a request ID, so a double tap can't pay twice.
- **Guardrails in code, not just in the prompt:**
  - A payout can only be proposed once every member has paid.
  - Payment plans must add up to what the member owes and fall within 21 days of the due date.
  - The agent can't send duplicate reminders.
  - Only the treasurer's approval route can release money.
- **Design.** The pot ring is patterned on *shweshwe*, the indigo-printed cotton worn across Southern Africa. Members sit around it, and it physically turns when a payout is released.

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
nextjs, react, typescript, claude, anthropic-sdk, paypal-orders-api, paypal-payouts-api, paypal-js-sdk, node.js, caddy

---

## Notes for judges
- The demo uses PayPal **sandbox**; no real money moves. Sign in with the pre-filled demo account.
- Historical payment records and the starting circle balances are seeded. New actions update the running demo. Messages stay in the in-app outbox; they are not delivered through WhatsApp.
- This is a prototype with demo sign-in and a JSON file store, not a production financial service.
- **Reset demo** (top right) restores the starting state.
