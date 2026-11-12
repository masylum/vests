# v106: common language and a shared effect budget

Every company now has **15 growth tokens and 26 printed movement**. Eight distinct +1/+2/+3/fumble mixes preserve different risk profiles. Equal printed totals do not equalize recovery losses: the [valuation worksheet](v106-balance-guide.html) gives exact expected movement over all orders of each company set and an adjustable effect budget.

## Shared wording

- **Portfolio company:** a company where you own a share.
- **Leading company:** a company on the furthest occupied space, including ties. **Lead investor:** the investor controlling a company.
- **Deploy:** move growth tokens from that company’s supply into the growth bag, then mix. Cards state any required supply. Fundraising deploys what remains if supply is short.
- **Return to supply:** put growth tokens on the bottom of that company’s supply.
- **Add a share:** put one of your round investor tokens in the company, using an available slot below the five-share limit. **Return a share:** remove your investor token to your supply, reopening its slot.
- **Reveal start / Reveal end:** the founder steps before / after drawing growth tokens. Both belong to the reveal phase.

Value cards use target-first wording. All company effects remain portfolio-only. Global Working Weekend and Fresh Perspectives require no company target. Rights Issue requires a price the proposer can pay; “affordable” meant payable, not cheap, so the card wording omits that adjective and the price prompt explains the forced purchase.

## Card changes

Inside Information selects two face-up discarded tokens from one portfolio company and returns them to the growth bag. Burned or destroyed tokens cannot return. Launch Campaign inspects two supply tokens, deploys one, and leaves the other on top; that top token remains private knowledge of the player. Executive Hire deploys two. Inventory Clearance publicly reveals two random removals and pays $5. Share Consolidation may return a sole share. Board Mandate costs $2. Paid Advice moves two and deploys one, consuming the additional card without a second replacement. Growth Financing moves one and deploys two for a capital step. Sweat Equity and Portfolio Transfer say “add a share to your holding” instead of “take an unissued share.”

Matching Funds remains $4 for two tokens. Stake Purchase remains $6/$12/$18. Deployment cards state required supply where an exact amount is required; other effect eligibility follows their card text and the shared rules.

## Founder changes

Stefan reacts to every qualifying arrival. Gill acts at Reveal start. Ryan chooses one leading company before moving one and fumbling that company. Jerry moves 3/2/1 with 1/2/3+ different shareholders after a purchase. Liza’s numbered-token wording is clearer. Harry helps once per round across the reveal phase, including Reveal start. Dan converts one fumble across that reveal phase. Lei-Lei and Brittney have a two-space limit. Julie charges her lead $2, at most once per reveal; the payment is spent before using the token. Melania moves one. Reid uses the common return-to-supply language. Mack Ja replaces Indie at the same stable founder ID. Mick moves two and recovers on purchases, including while fumbled or just hired. Reed responds to every qualifying bank sale. Anya discards one value card to move two, with no deployment and no replacement.

**Observed balance issue:** unlimited Stefan and Max can chase one another to space 24 in a single resolution. Smoke seed 106500 produced 41 founder bonus moves and a first-round IPO. This implements the requested rule, and the chain is covered by a regression. Recommended next decision: Stefan may react once per originating token/action instead of once per round. That restriction is a proposal, not implemented. See the [full trace](v106-ui/stefan-outlier.json) and worksheet discussion.

## Valuation

The worksheet proposes movement-equivalent points:

`M + q·μ·deployments + recovery value + cash/κ − 10·capital/κ + card/action options + share/control effects`.

Its default q=.5, κ=$3 per point, H=1 per unreplaced card and A=2 per extra action are **provisional design rates**, not fitted tournament results. Actual choice value also depends on ownership, payout eligibility, liquidity, timing, opportunity cost and interactions. In final-score terms, Financing minus Matching is the value of one immediate move, plus $4 cash kept, minus the $10 capital penalty and lost capacity. That is roughly the move versus $6, before liquidity adjustments.

The guide contains all current card wording, founder opportunity formulas, known-token and fumble handling, and concrete comparisons. It does not claim the game is balanced.

## Presentation and verification

Catalogues show 16 portrait cards per page at 1280×720, with more on taller/wider viewports. Every card on both value-card pages and both founder pages was checked for clipped content. Company mats have shorter headers, no “Unowned” label, higher counters and round bank/lead/share markers. The bottom drawer is capped at 920px and is 16% narrower than the board below that cap; its height remains fixed across phases.

99 focused tests pass. A 16-game smoke cohort (four seeds at each of 2–5 players) checks execution, invariants, replay and independent score accounting. A separate rerun investigates the Stefan–Max outlier. These are validation checks, not a new health study or human-time experiment. The historical full suite was not rerun.
