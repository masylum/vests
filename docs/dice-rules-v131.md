# Live dice v131

Play `/?variant=dice`. Classic remains at `/?variant=classic`; the fixed-four-round dice version is preserved at `/?variant=dice-old` with separate saves and replay validation. Previous rules: [v130](dice-rules-v130.md).

Each player starts with $20 and two randomly dealt permanent shares. Companies start on 1; the last investor leads. Resolve one chosen die per starting share clockwise, as in the previous setup. Then deal eight private deal-flow cards. Only deal-flow cards are private.

On your turn spend one deal-flow card to fund its matching company, or discard any card to call $10 of repayable capital, play one of four public value cards, or hire one of four public founders for a company you lead. Both public markets immediately refill used slots. Existing auctions, bids and founder-choice ownership remain unchanged.

Every newly issued share, including Sweat Equity, gets two immediate dice. Its owner commits both types and their order before rolling. Resolve before-reveal founders once, then each die and its reactions separately, then after-reveal founders once. Complete the purchase before checking the leg/end trigger. Leon's once-per-round restriction resets only at the next leg; once-per-reveal powers reset for each purchase. Existing fumble/recovery behavior remains.

| Die | Equally likely faces | Printed mean | Fumble chance |
|---|---|---:|---:|
| Safe | 1, 1, 1, 1, 2, 2 | 1.333 | 0 |
| Balanced | ×, 1, 1, 2, 2, 3 | 1.5 | 1/6 |
| Risky | ×, ×, 1, 2, 3, 3 | 1.5 | 1/3 |

A crossing of 8, then 16, ends the leg after the entire action/purchase resolves. Keep all unused deal-flow cards, draw three more, refresh all four public founders and values, and rotate first player. New refresh cards are drawn before returning the old market, avoiding an immediate identical card refresh. Deal-flow draws use a fresh shuffled supply balanced across six companies; undealt cards remain unseen. There is no hand cap, fixed action quota, centre growth, catch-up or round-four cap. Opening growth is round zero; any boundaries it already passed are complete when normal play starts.

The first crossing of 24 ends the game after the full purchase, even if a later reaction moves that company backward. All companies exit at their final positions. Score = cash + per-share payouts − all called capital. Negative scores stand.

| Spaces | Exit per share |
|---|---:|
| 0–10 | $0 |
| 11–12 | $1 |
| 13–14 | $2 |
| 15–16 | $4 |
| 17–18 | $6 |
| 19–20 | $9 |
| 21–22 | $12 |
| 23–24 | $16 |

This is the first progressive curve tested, preserving the requested doubled $16 ceiling. Safe/balanced/risky outcomes include existing founder effects; printed means are not expected actual movement.

Compatible supply: 20 founders, one copy each; 13 value-card kinds, two copies each. Excluded founders: Wang, Cage, Mirati, Hearts, Fastings and Anya; the retired founder remains out of play. Anya and Advice depend on private value hands; Fresh Faces conflicts with the four-card market procedure. Other exclusions preserve the previous dice compatibility filter (token supply, extra actions, capital forgiveness and leadership overrides).

If all hands run out before a boundary, the game is marked stalled without invented redealing or settlement. This is observable in simulation, particularly with two players; it is an unresolved rule case, not a completed game.

Latest evidence: [v131 report](dice-live-v131/run-02/report.html), [summary](dice-live-summary.md), ten complete reviewed replay traces plus five stalled sample attempts. Run `npm run simulate:dice-live -- 42 4` or `npm run study:dice-live -- docs/dice-live-v131/NEW-RUN`.
