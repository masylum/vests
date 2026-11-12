# Vests v130-dice-preview — Deal flow

An alternative to classic v128, not a replacement. Play at `/?variant=dice`; classic remains at `/` or `/?variant=classic`. Both use the existing JavaScript auction and founder-effect engine. Save slots and replay versions are separate.

## Confirmed rules

- Six companies, 24 spaces, starting on space 1 as in classic. Two to four investors start with $20 and three compatible value cards.
- Shuffle twelve starting shares (two per company), then deal two clockwise to each investor. The last dealt investor leads. Each starting share supplies one round-zero die; players choose their unresolved shares in clockwise order. Ownership never expires when growth resolves.
- Four normal rounds, always completed. At each round's start, shuffle a deck with one card of each company per player and deal six private deal-flow cards per player. There is no remaining draw pile. Everyone takes five actions, clockwise, one per turn.
- Initiate funding with its matching deal-flow card, regardless of leadership. Existing sealed second-price auction, sole-bidder payment, host tie preference and open rival tie raises apply. The winner pays the bank, gains one permanent share and exactly one pending die. Latest investor leads regardless of share count. No share cap, supply restriction or payment-to-growth conversion.
- Alternatively discard any deal-flow card to call $10 (record $10 repayable), play a compatible value card, or change the founder of a company you lead from the three-card public market. Value-card play replaces the card normally. Fresh Perspectives draws two. Normal hiring preserves fumble status. No free card exchanges or empty-hand draws: these are not actions in the new action table.
- Resolve purchased-share dice clockwise, skipping players with none, choosing one entitlement at a time. Then reveal/resolve each player's deliberately retained final deal-flow card clockwise from the first player. These centre cards create no shares. Identical company cards remain separate dice.
- Six equally likely die faces: Fumble, 1, 1, 2, 2, 3. Fumble has zero base movement and applies existing fumble effects. A fumbled company spends its next die recovering instead of moving, including Mario's recovery power. Compatible before/after-reveal powers run once around normal growth phases. No opening before-reveal phase, no growth bags and no catch-up subsidy.
- Rotate the first player after each normal round. Round zero starts with the same first player as round one.
- Reaching three finishers no longer ends play: the user replaced that ending with a fixed four-round exit. Reaching 24 does not block funding or pending rolls. Existing setbacks, swaps, fumbles and recovery still apply. Track first arrival order separately from current finish status.
- After round four, **every company pays** its position's per-share price. No top-half qualification and no dilution. Remaining cash + share payouts − all called capital is the score; negative scores stand.

## Payout curve and experiments

The New game dialog offers 1×/2×/3× exits, one or two dice per newly acquired share, and five or three actions per player per round. These settings are recorded in replays and simulations. Defaults remain the original five-action, one-die, 1× curve for comparison.

With three actions, deal four cards per player from the same shuffled balanced deck; the unused cards stay out of play that round. Retain one card for centre growth. With two dice, finish both dice for the chosen share successively before passing clockwise. Resolve each die and its founder effects separately; do not sum the faces. Setup shares and centre cards still roll once. Every newly issued share, including Sweat Equity and card auctions, gets the configured dice count. Four rounds are unchanged.

For four players, three actions reduces the fixed action count from 80 to 48. Two dice alone does not reduce the action count and can increase resolution time. Auction attempts, completed sales, total shares (including eight starting shares and free shares), and die resolutions are distinct metrics.


Default per-share prices are $0 at positions 0–8, $1 at 9–10, $2 at 11–12, …, $8 at 23–24. This is `max(0, ceil((position - 8) / 2))`. The study compares this with doubled increments, using the same setup seeds and policies. Four rounds and all-company payouts remain fixed in both experiments. A larger score alone does not establish a better game.

## Component compatibility

Retain all existing movement/reaction founders except Jenkins Wang (qualification/whole-company exit), Harry Cage and Mura Mirati (supply deployment), Julie Hearts (redirects a company's entitled die), and Reid Fastings (discard/supply manipulation). Retired founder remains out of play. Founder market and replacement draws use only this compatible pool.

Two copies each of 15 value cards: Resolve Crisis, Warm Introduction, Portfolio Rebalance, Headhunting, Portfolio Conflict, Infamous Ousting, Mutual Insurance, Rights Issue, Convertible Notes, Sealed Tender, Secondary Sale, Focused Execution, Paid Advice, Fresh Perspectives and Sweat Equity. All remaining values are excluded because of token supplies, extra actions, capital reduction, leadership overrides or share transfers. Sweat Equity's new share receives the new core rule's one die; “deploy no tokens” still holds. Card-initiated auctions also create one die for the winning share.

The app's component library lists every included founder and value card, the die, deck quantities and these rules. Opponents' live deal-flow and value-card hands remain private.

## Commands

```sh
npm start
npm run simulate:dice -- 42 4 --trace
npm run test:dice
npm run study:dice -- docs/dice-study 60
npm run simulate -- 42
```

Dice simulations accept seed and player count. The programmatic `simulateDice` also accepts `payoutStep`, named policies and trace mode. `balanced`, `growth`, `saver` and `random` are bounded public-information heuristic policies, not optimal strategies. Trace mode records commands, decision context and complete engine events, then independently replays and checks the result. Legacy simulations retain their existing CLI.

The production engine validates on a working copy so rejected dice commands do not consume a card, cash or an action. The frontend submits commands to the same engine used by headless simulations; it does not implement independent rules. This is a local single-human game with bots, not a network multiplayer service.
