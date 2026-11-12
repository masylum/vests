# v103: decision planning and controlled experiments

The live game keeps Anya at move 2 + deploy 2 (discard, no replacement, before reveal), Melania at move 2 for a shareholder card, and Growth Financing at two tokens for one capital step. Matching Funds stays $4 for two; Stake Purchase stays $6/$12/$18. Backward costs and card text are unchanged.

Bots now share ordinary Fundraise proposal/bid payment evaluation, including their own bid; unpaid bids incur no lock penalty. Portfolio Transfer and Stake Purchase are evaluated with projected ownership and exit proceeds. Executive Session explicitly chooses a public founder; Rights Issue explicitly chooses an affordable price. Losing the last portfolio company has a future-card-access cost. Working Weekend compares affordable reachable known actions after the $4 payment, without a flat discard bonus. Its conservative planner excludes overlapping company effects and unknown replacement draws; it can miss sequential combinations.

Engine-only experiment settings: `anyaMove: 1`, `shareholderMove: 1`, `financingTokens: 3`. Three-token Financing requires three supply tokens. Defaults are 2/2/2. These settings were compared individually and together after the bot fixes; none has been adopted as a default.

The local [v103 report](v103-study-2026-11-03/report.html) records 122 completed games, frozen sources and seeds, ten complete replay reviews, metric definitions and limitations. 63 focused tests pass. The historical full suite was not rerun. Physical fundraising times remain unmeasured; a [printable protocol](v103-study-2026-11-03/physical-timing.html) covers all four formats and three Stake Purchase situations.

Important finding: a player at capital 6 with an empty hand may be forced into harmful actions because passing is allowed only when no action is legal. Proposed next trial: spend an action to draw one card when empty, compared separately against voluntary pass. Neither proposal is implemented in this version.

Layout: wider board, portrait cards, bottom drawer sized to the rendered board, and horizontally centered investor panels. Supply reference continues to show original company token distributions; company mats show simple Supply/Used counts.
