# Live dice v131 — first study

[Play](http://localhost:5188/?variant=dice) · [Rules](dice-rules.md) · [Full report](dice-live-v131/run-02/report.html) · [Metrics](dice-live-v131/run-02/metrics.json) · [Ten complete reviews](dice-live-v131/run-02/sample-review.md)

480 attempted games: **397 completed, 83 stalled, zero engine failures or decision cutoffs**. Three player counts, self-play and rotated mixed policies, plus matched-seed all-safe/all-balanced/all-risky/adaptive table comparisons. Ten complete samples independently replayed; five stalled selection attempts retained. Run-02 repeats the identical seeds and rules with additional decision-count metrics; it is not an additional independent 480 games. Run-01 remains archived. Rules and bots both changed since v130, so historical differences are descriptive rather than causal.

## Four-player mixed policies

39 completed of 40; one stalled. Statistics below condition on completion.

| Measure | Result |
|---|---:|
| Actions | Mean 21.1; median 20; p90 30; maximum 39 |
| Auctions / sold shares | Mean 12.9 / 12.9 |
| Permanent shares at exit | Mean 22.0, including 8 setup shares and free Sweat Equity shares |
| Dice rolls | Mean 36.1; p90 46 |
| Decisions excluding acknowledgements/committed rolls | Mean 112.6; p90 157 |
| Paid auction price | Mean $5.50; median $5; p10–p90 $1–$10; maximum $23 |
| Final company positions, ranked | 24.0, 15.2, 9.1, 5.0, 3.0, 1.7 |
| Lead-to-last spread | Mean 22.3 spaces |
| Companies paying zero | Mean 3.87 of 6 |

The loop is much shorter than the previous fixed-round version, but the race is highly concentrated. Twenty actions does not mean twenty decisions: every auction involves several bidders and founder decisions add further interaction. These are not estimates of human minutes.

## Termination needs a rule decision

Across the primary self + mixed cohorts (80 attempts at each count), stalls were **34/80 with two players, 6/80 with three, and 1/80 with four**. The original expectation that hands cannot run out is contradicted by these legal games. No fallback was added. The UI records the stall and offers a new game; it does not pretend that a stalled game has settled.

The fixed-dice cohorts also stall: 38/80 two-player attempts, 4/80 three-player attempts, 0/80 four-player attempts. This cannot be solved simply by selecting safe dice. Conditional completion statistics understate long-game problems because stalled games have no valid ending.

## Actions and cards

Across all 240 primary attempts (including stalls), 5,363 actions comprised funding **56.8%**, public values **28.5%**, capital calls **9.0%**, and founder changes **5.7%**. Value-generated auctions are counted as auctions as well as value actions, not extra actions.

Conflict of Interest (323 plays), Dividend (319) and Sweat Equity (307) accounted for 62.1% of 1,528 value plays. They turn low-paying holdings into cash or add free shares to the leader. Infamous Ousting had 10 plays, Public Offering 4, Sealed Tender 5, and Rights Issue 1 despite many public exposures. The bots use crude scores for these tactical cards; low use is not evidence they should be removed.

Recorded gross founder movement was led by Gill (821 forward), Danilo (612 forward / 103 backward), Zack (590 forward), Ryan (497 forward) and Dan (408 forward). Exposure counts and hires are in the report. These totals are not causal strength rankings. Max's occupied-space skipping is included in base movement rather than the founder ledger; Mack primarily produces cash. A displayed zero in that ledger does not mean no contribution.

The ten reviews repeatedly show **Ryan fumbling a leading Dan company, which converts the fumble into +2 on each purchase**, even purchases of other companies. One reviewed two-player game finished in five actions. Zack and Danilo also advance with other companies' purchases. These interactions deserve a focused experiment before adjusting the exit curve again.

## Dice

All nine ordered pairs were selected. Safe/safe was most common (27.2% of primary purchase choices), followed by safe/balanced (12.9%) and risky/risky (12.7%). Balanced and risky have the same printed mean, but fumbles/recovery and founder responses make their actual effects different. With Dan, risky dice can be attractive; near a guaranteed finish, safe dice often win the local evaluation.

For four-player homogeneous tables on 20 matched seeds, completed-game action means were adaptive **18.4**, safe **19.9**, balanced **17.4**, risky **18.4**, with no stalls. This small comparison does not establish a winning dice policy: every seat changed together, and outcomes diverged after the first different choice.

## Limits and next experiment

Bidding forecasts future share prices heuristically; action selection does not model rival winning chances or terminal score margins. Hiring uses static preferences. Random is a stress policy with uniform bids from zero to cash, not a competent baseline. Source snapshots, seed/seat protocol, approximate game-level mean intervals, all failed/stalled records and complete sample replays are preserved in the report directory.

Next: improve terminal-aware funding/bidding under unchanged rules; then isolate the Ryan/Dan interaction. A separate user decision is needed for hand exhaustion. Keep the requested payoff curve fixed until those effects can be distinguished.

Validation: 186 current/classic tests + 27 dice tests passed; Cloudflare asset build passed. Browser QA exercised setup, ordered risky/safe choice, immediate rolls across leg boundaries, public market refresh, larger hands, and a complete settlement at 1280×720. Detailed QA artifacts are stored alongside the report.
