# Devpost submission: Rotapot

Copy each section into the matching Devpost field.

---

## Project name
Rotapot

## Tagline
The AI treasurer for stokvels, mukando and diaspora savings circles, built on PayPal.

## Links
- Live demo: https://rotapot.simakk.co.za (demo sign-in, details pre-filled)
- Code: https://github.com/simandebvu/rotapot
- Video: _paste YouTube link_

## Prize categories to tick
- Best Use of Agentic Commerce
- Most Impactful
- Best Use of PayPal + AI

---

## Inspiration

Across Southern Africa, millions of people save in rotating savings circles. South Africans call them stokvels; Zimbabweans call them mukando or rounds. Every month each member puts in the same amount, and the whole pot goes to one member, in turn. People use these circles to pay school fees, build a house back home, or buy a fridge. South Africa's stokvel sector alone is estimated to hold tens of billions of rand.

These circles run on a WhatsApp group, a notebook and one overworked treasurer. She chases late payers by hand, keeps the books in her head and moves the money herself. The members are now spread between Harare, Johannesburg, Leicester, Dublin and Dallas, so cash doesn't work and trust gets stretched. We built Rotapot for that treasurer.

## What it does

Rotapot gives the treasurer an AI agent that handles the chasing and the bookkeeping, with PayPal moving the money. The agent never moves money itself.

- **The agent works before you ask.** When Rudo, our demo treasurer, signs in, the agent goes through all three of her circles on its own. Following each circle's rules, it sends the reminders that are due and puts any fully paid pot up for her approval. Then it briefs her on what needs her. You can watch every step live, including the actual tool calls.
- **Collects through PayPal.** Every member gets a personal PayPal checkout link (Orders API). The pay page greets them in their own language and shows when their turn to receive the pot comes.
- **Writes to members in their own language.** Reminders, receipts and payout notices are written in Shona, Ndebele, isiZulu, Sesotho, Setswana or English, the way people actually text. One circle's rules forbid reminders before the due date, and the agent respects that. It never sends the same member two reminders within 12 hours.
- **Members can reply, and the agent handles it.** "I already paid" gets checked against PayPal before anyone is accused of anything. "Can I pay half now and the rest Friday?" gets an answer in the member's language. The agent checks their payment history and proposes an instalment plan, which the treasurer approves or declines with one tap. A member on a plan pays the right instalment from the same link.
- **A person always releases the money.** The agent can only *propose* a payout. Money moves through PayPal Payouts only when the treasurer taps Release. The agent has no tool that can send money. When she releases it, gold flows round the pot into the recipient, the circle turns to the next person, and the recipient gets a WhatsApp-style message.
- **Trust passport.** Every contribution adds to each member's payment record across all their circles: years saving, on-time rate, streak, and a dot for every payment. Most of these members have no credit file, but they have years of proof that they pay. The agent already uses this record to decide how to treat a late payer. In time, the same record could help members get loans, rent a home or buy insurance.

## How we built it

- **Next.js 15 + React 19 + TypeScript.** The treasurer dashboard, the member pay pages and the API routes.
- **Claude as the agent.** We used the Anthropic SDK in a loop we wrote ourselves, so every step can be streamed to the screen as it happens. The agent has nine tools: read all circles, read one circle, check a payment with PayPal, send a reminder, reply to a member, read a member's trust passport, propose a payment plan, propose a payout, and check a payout's status.
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

## Challenges we ran into

- **Making the agent safe to trust with money.** We gave it the power to act (send reminders, propose plans, propose payouts) without the power to pay. Every rule that matters is enforced in code, so a confused model can't break it.
- **Writing in five Southern African languages** naturally and kindly, never like a debt collector.
- **Keeping it calm under real conditions.** An early version stopped halfway, losing its work, if the viewer closed the tab. It now always finishes. It also once treated a member who paid an instalment early as suspicious, so we taught it that paying early is a good sign.
- **Showing the agent's work** without overwhelming people: plain-language steps, with the literal tool call next to each.

## Accomplishments that we're proud of

- The agent briefs a treasurer across three circles in five countries in about 15 seconds, and follows each circle's own rules.
- A member writes in isiZulu, and within seconds the agent has checked their record, answered them in isiZulu and put a plan in front of the treasurer.
- The trust passport turns years of quiet reliability into something visible.
- It's built for how these circles actually work: rotating payouts, members in the diaspora, WhatsApp, and kindness.

## What we learned

The hard part of agentic payments isn't making the agent capable; it's deciding exactly where its authority stops. "Propose, don't pay" turned out to be both the safest design and the most persuasive one: treasurers keep control, and the agent takes the drudgery off them.

## What's next for Rotapot

- Real WhatsApp delivery and inbound messages through the WhatsApp Business API.
- Local payment rails alongside PayPal (for example PayShap in South Africa). PayPal doesn't settle in rand, so the demo runs in US dollars, which fits Zimbabwe and the diaspora.
- With members' consent, turning the trust passport into a portable credit record that lenders, landlords and insurers can rely on.
- Native-speaker review of every message template, and more languages: isiXhosa, Tshivenda, Xitsonga, chiChewa.

## Built with
nextjs, react, typescript, claude, anthropic-sdk, paypal-orders-api, paypal-payouts-api, paypal-js-sdk, node.js, caddy

---

## Notes for judges
- The demo uses PayPal **sandbox**; no real money moves. Sign in with the pre-filled demo account.
- Each member's payment history before the current cycle is seeded, to show what the trust passport looks like with years of data. Everything that happens in the demo (payments, reminders, plans, payouts) is live.
- **Reset demo** (top right) restores the starting state.
