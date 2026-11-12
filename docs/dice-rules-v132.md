# Dice version 132 — turns, rounds and legs

Play `?variant=dice-v132`. v131 remains at `?variant=dice-v131`; v130 at `?variant=dice-old`; classic is unchanged. Saves and replays are versioned.

- Setup: six companies at 1, $20 and two random shares per player, one chosen die per starting share. Deal **five private deal-flow cards** after setup. Latest investor leads. Setup is round zero; its limited founder usage resets before round one.
- A **turn** is one action, spending one deal-flow card: fund its matching company, or discard it to call $10, play a public value card, or hire a founder for a company you lead. Auctions and founder choices are part of that turn. Called capital is repaid in full at exit.
- A **round** is one turn per player, clockwise. At each new round keep every unused card and draw three; no hand cap. Reset round-limited founders. A leg transition does not reset the round, change turn order or grant another draw.
- A **leg** ends after the full action resolves when at least three companies are currently at or beyond 8, then 16. Previous crossings alone do not count if companies have moved back. Refresh both public markets then: four founders and four value cards. Every used market slot also refills immediately. Only deal-flow cards are private.
- Each newly issued share grants a joint two-die reveal after the auction. Choose any pair: safe (1,1,1,1,2,2), balanced (×,1,1,2,2,3), risky (×,×,1,2,3,3). Order is irrelevant. Add numbers as one movement, resolving its founder reactions, then resolve each × as a fumble. Both faces are drawn before any resulting choice. A numbered movement spent recovering a fumbled company is lost; subsequent × results still fumble it. Two × results cannot cancel each other by recovering the company.
- Before/after-reveal founders now have at most one activation opportunity per round, at their applicable reveal timing. Once-per-reveal limits become once-per-round limits. Dan replaces one eligible fumble per round with **+1**, not +2. Triggered per-round limits apply to value-card effects too. Unrestricted reactive founders retain their triggers. Liza adds to the summed movement once.
- **The first company reaching 24 ends the game**, even if an earlier leg is incomplete. Finish the full action, dice and reactions before settlement. Reaching 24 remains a terminal trigger if a later effect moves that company back. All companies pay their final-position exit prices.

Exit per share: 0–10 $0; 11–12 $1; 13–14 $2; 15–16 $4; 17–18 $6; 19–20 $9; 21–22 $12; 23–24 $16. Final score = cash + all share payouts − called capital. Highest score wins, ties shared.

No centre growth, catch-up, private value-card hands or fixed round limit. The compatible founder/value pools and doubled payout ceiling are unchanged from v131. Opening movement is retained.

Implementation: `src/live-dice-engine.js`; simultaneous-reveal forecast: `src/live-dice-bots.js`; browser: `src/dice-app.js`. `npm run test:dice`; `npm run simulate:dice-live -- 42 4`; `node scripts/live-dice-study.js docs/dice-round-v132/NEW-RUN`.
