# Vests v111

Reveal five growth tokens each round, including any token discarded to recover. After those draws, remove one random token from the remaining bag face up, without resolving it. Skip the burn if no token remains. Burned tokens are permanently out of play and cannot be returned by value cards. Before-reveal founders, after-reveal founders and catch-up otherwise retain their timing. All card prices and founder powers are unchanged from v110.

The bot revision fixes the action-phase Headhunting valuation, uses portfolio forecasts for Headhunting/Rebalance/control, and values a control card's reachable next-action founder hire against another available action. Hiring initiation and founder selection share the same paired forecast. Flat repeated-hire penalties are removed; forecast round limits now reset correctly.

Bidding and action selection share discounted portfolio wealth, risk treatment, payment and ownership accounting. Rival bids use one bounded public-policy response layer. Public passes are reused only while the recorded public opportunity and liquidity remain unchanged. Fundraising cards retain replacement-card option value and shareholder reactions. No private rival cards or real hidden token order enter decisions.

The interface places the board immediately below the centered player chips and the fixed-size drawer immediately below the board. Supply/Used counters are smaller; the lead glyph is ♛. Sidebar pagination has a reserved slot, with inherited margins removed. UI QA covers 1280×720 and a rendered 1840×1113 desktop fixture.

## Evidence

The [v111 report](v111-health/report.html) contains 124 completed games: a 2×2 rules/policy comparison (96), rotating baseline-seat matches (18), and ten complete reviewed interactive-budget games. Engine invariants, replay and independent final scoring pass. The [current test log](v111-ui/tests.tap) contains 132 passing checks.

Revised five/burn bots produce 1/72, 0/105 and 3/138 all-pass fundraises at 2/3/4 players. Longer games are not consistently established. Standalone founder-action frequency remains low; the new bot is not proven stronger overall. The baseline wins five of six three-player mixed matches, with broad score intervals. Two-player opponent-funded shared-company rounds also decline, so their preservation needs more testing. The report separates these limitations from the observed no-bid improvement.

The v110 heuristic baseline is preserved on the v111 engine, with only burn support added to its forecasts. The study source is frozen; separately hashed final sidebar fixes affect presentation only. Historical tests for removed rules remain outside the current-rule test gate. Human fun and duration have not been measured.
