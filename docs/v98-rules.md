# Vests v98 — playtest revision

Historical v98 snapshot: 102 simulated games and 11 current-rule tests were checked, with a bank-sale ownership dead end identified. The current build is v99; see README for its changes. The revised card shortlist below is proposal-only and is not in the playable deck.

## Turn and economy

Each investor starts with 20 coins and three random value cards. Take two actions, in any order, including repeats:

- Propose fundraising for any company with supply and fewer than five issued shares. Everyone may bid; proposing does not guarantee a share. The proposal consumes an action even if nobody buys.
- Replace a founder in a company you lead, choosing from the public founder market.
- Play or discard one value card and draw one replacement. A replacement can be used on your next action. Opening or cancelling the chooser does not consume an action.
- Gain 10 coins and advance your capital counter by one. Each step subtracts 10 from your final score; the starting 20 coins carry no deduction.
- Sell one owned share to the bank. It pays 6/12/18 coins by the company's current leg (spaces 1–8 / 9–16 / 17–24). The bank retains the share, preserving dilution and the five-share issuance limit.

Retain sealed second-price auctions, including minimum bids of 1/3/5 by company leg. A sole bidder pays their bid. A proposer tied for highest wins the tie; other top ties use open raises. The existing winning-bid commitment remains locked until round end. Loans are unavailable.

## Growth and founders

The actual investment payment deploys `ceil(payment / 4)` tokens from that company's supply immediately, capped by available tokens. Mix the bag after deployment. There is no treasury or automatic treasury deployment.

Each company has 15 tokens. The following preserves the previous **printed** movement totals and fumble counts. Removed company-power movement is not included: conditional and recurring powers have no single fixed movement total.

| Company | +1 | +2 | +3 | Fumble | Printed movement |
|---|---:|---:|---:|---:|---:|
| Gogol | 2 | 12 | 0 | 1 | 26 |
| Amazin | 9 | 6 | 0 | 0 | 21 |
| Weta | 0 | 9 | 3 | 3 | 27 |
| Novidia | 1 | 12 | 0 | 2 | 25 |
| Testra | 0 | 12 | 1 | 2 | 27 |
| Obenay | 0 | 12 | 1 | 2 | 27 |
| Orbix | 6 | 8 | 0 | 1 | 22 |
| Airnest | 4 | 10 | 0 | 1 | 24 |

Six tokens are revealed each round. Fumble recovery still consumes a draw. Keep the existing public burn (one fewer than investors), catch-up, founder order, full-round IPO check and payout rules. Catch-up and founder effects still allow companies to reach 24 even with burns or fumbles.

The Supply view has fifteen rows and one column per company: six columns in a default four-player game. Used tokens accumulate at the top, remaining supply below, with empty slots between representing the bag/current resolving token. Supply is solid company color; used and revealed tokens have black faces, colored numbers and borders. Supply values are visible; bag order is not.

- Stefan Hobbes moves 1 when triggered, once per round.
- Jess Bazos swaps within 2 spaces.
- Dan Saltman converts fumbles to movement only during a growth-token reveal, including reveal reaction chains.
- Mario Adonei deploys 2 tokens before reveal if fumbled. He neither blocks passage nor awards a card upon recovery.
- Portfolio Rebalance swaps two portfolio companies at different positions within 3 spaces.
- Remove Bridge Financing, Illicit Capital, Wasteful Advice, Secondary Market, and the Sell Position card.
- Inside Information may inspect/discard bag tokens belonging only to portfolio companies.

## Capital, founder pool and deck composition

Capital starts at zero. Final score is cash plus exit proceeds minus 10 per capital step. Raising capital supplies liquidity without directly increasing the score; the deduction applies even if it makes the final score negative. It does not remove spendable cash during play.

Mack Ja is removed from setup, the public market, the replacement supply and the active catalogue. His ID is reserved so the other founder IDs and portraits remain unchanged. The provisional replacement power is removed.

Nine retained value-card types have two copies each, so even five players can start with three cards and still draw replacements. The shortlisted new types below are not implemented. Once the new deck is selected, reassess whether to use one copy of each type instead.

The JavaScript rules engine remains authoritative. The old native forecast accelerator is bypassed for v98. Bot valuations have been adapted to direct deployment and legal actions. The 2026-11-02 study completed 102 games with invariant, replay and independent accounting checks; 11 current-rule regressions pass. Stronger forecasts reduce five-player stalls, but three of twelve confirmation games still lose all investor holdings. Repeated all-pass proposals and selling the final holding remain bot concerns. Old regression expectations and fixtures still need migration; the full suite is not green. See the local [health report](v98-health-2026-11-02/report.html). The proposed new cards below are not included in that study.

## Revised value-card shortlist

These five designs remain after user review; they are proposals, not implemented cards. The other five slots in the original ten-card proposal remain open. All cards cost one action and draw one replacement after resolution. Every company named or affected directly must be in your portfolio. Costs must be paid in full.

| Card | Revised rule | Decision / tradeoff |
|---|---|---|
| Matching Funds | Pay 4 coins to deploy 2 tokens in a portfolio company. No new shares. | Spend your own cash to grow an asset shared with other investors. Requires 2 supply tokens. |
| Secondary Sale | Move a portfolio company back exactly 2 spaces. Each shareholder receives 3 coins per share held in it; bank shares pay nobody. | Cash now versus exit value, with unequal benefits to co-investors. Requires space 2 or higher. Renamed from Special Dividend; no share changes ownership. |
| Buyback Window | Pay 8 / 14 / 20 coins in company leg 1 / 2 / 3 to take one bank-held share in a portfolio company. Each other shareholder receives 2 coins from the bank. No growth tokens deploy. | Buy influence while funding rivals; only useful after a bank sale. Proposed prices are 2 above the bank sale price in each leg. |
| Focused Execution | Only as your first action: deploy 3 tokens in a portfolio company, then forfeit your remaining action. | Commit the whole turn to growth while helping all shareholders. Requires 3 supply tokens. |
| Paid Advice | Discard one additional value card. Move a portfolio company 2 spaces, then draw only this played card’s normal replacement. | Sacrifice a future option for immediate movement; your hand becomes smaller. |

Buyback Window's exact prices are proposed, not yet confirmed. Company leg means spaces 1–8 / 9–16 / 17–24. Secondary Sale retains the previously proposed effect; its name does not introduce an actual share transfer.

Rejected designs: Emergency Sprint, Succession Package, Founder Buyout, Lean Operation and Investor Distribution. Do not implement these. Replacement designs have not yet been selected.
