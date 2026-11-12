> Historical results: these simulations used incorrect global before/after activation hooks. Gill and other timed founders could activate during another company’s purchase. These results do not establish balance for the corrected v135 rules.

# Draw rate and card-free support actions — v134 research

[480-game report with ten complete reviewed replays](dice-flow-v134/run-01/report.html). This is an isolated experiment under `src/experiments/flow-economy`, not a change to the live v133 game. Nine cards per company; five initial cards; compare draw 2/3 × non-funding actions paid/free in deal-flow cards. Funding still requires and spends a matching card; every player still takes one action each round. Other rules and existing bot decision logic are unchanged except for a legal empty-hand response.

The user's distinction is correct: individual-hand scarcity cannot be inferred from remaining cards across the table. A five-card hand has a 38.6% chance of containing none of a specified company's nine cards. Bots receive only their own hand. During round four, a unique leader's card was absent from the acting hand on 30.0% of baseline turns, 45.1% with draw two/paid, and 44.8% with draw two/free. Later-round observations are conditional on a game still running.

| Draw / support-card cost | Reached 24 | Mean first–last gap among finishes | Mean first–third gap among finishes | Mean actions |
| --- | --- | --- | --- | --- |
| 3 / paid | 115/120 | 22.5 | 14.7 | 28.5 |
| 2 / paid | 115/120 | 22.7 | 14.8 | 27.6 |
| 3 / free | 120/120 | 22.4 | 14.5 | 28.3 |
| 2 / free | 120/120 | 22.2 | 14.2 | 28.5 |

All 480 completed; zero censored or failed. Card-free support actions eliminated exhaustion in this sample, but neither modification established a tight race. Two draws still grow a hand by one on a funding turn or two on a non-funding turn before the deck empties. Combined configuration left 32.8 cards across hands at the finish versus baseline 25.4. Preserved laggard cards remain optional investments. Differences in small mean gaps should not be treated as established improvements.

The former “4.5 spaces during other companies' actions” wording was misleading: it included value actions targeting the finishing company. In the new baseline, the winner averages 2.36 net spaces during other-company fundraisings and 1.93 during value actions. Own-call movement includes founder reactions. Previous sample 5004 gives a concrete example: four Gill +1 activations on other-company fundraisings, plus net +4 from Sweat on the winning company itself. No hidden card knowledge is required for any of these effects.

Four engine regressions pass (draw/depletion accounting, matching funding, privacy, baseline parity and empty-hand turns covered across four tests). All 480 supply and winner-movement totals reconcile; ten stored command replays reproduce complete logs and settlement accounting. Primary seeds 6001–6020; fixed sample slots 7001–7010, no replacements needed. Provisional finishing and gap targets, uncertainty, separate player counts and full source hashes are in the report. Existing live rules remain unchanged pending a decision to adopt an experimental configuration.
