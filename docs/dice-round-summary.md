# Round dice v132 — reviewed study

[Play v132](http://localhost:5188/?variant=dice) · [Rules](dice-rules.md) · [Full report](http://localhost:5188/docs/dice-round-v132/run-02/report.html) · [Ten trace reviews](dice-round-v132/run-02/sample-review.md) · [Previous v131](dice-live-summary.md)

480/480 games completed: no stalls, failures or decision-limit cutoffs. Ten additional predetermined samples completed, were replayed, and were reviewed event-by-event. Source snapshots, manifests, commands, raw events and component statistics are in `docs/dice-round-v132/run-02/`. Run-01 is retained; run-02 fixes round labels and an off-by-one leg-duration metric. Every outcome and sampled decision matched.

Mixed-policy results (40 games per player count; mean round count includes a partial final round):

| Players | Rounds | Actions mean / median / p90 | Auctions | Sale price mean / p10–p90 | Final position range | Zero-paying companies |
|---|---:|---:|---:|---:|---:|---:|
| 2 | 11.9 | 23.2 / 22 / 30 | 14.3 | $4.18 / $1–9 | 22.6 | 4.18 |
| 3 | 8.3 | 23.6 / 23 / 31 | 14.9 | $4.68 / $1–9 | 22.4 | 4.20 |
| 4 | 6.9 | 25.9 / 25 / 37 | 16.8 | $5.31 / $1–10 | 21.7 | 3.90 |

Four-player mixed games are longer than v131's completed games (21.1 actions, 12.9 auctions), but this is not a pure rule-only controlled comparison: the forecast was adapted to the new reveal and founder timing, and v131 had one unfinished game in that cohort. Other bidding, action and hiring heuristics are unchanged.

The leg gate does not guarantee several legs. In the 80 primary self/mixed games at each count, 55 two-player, 53 three-player and 40 four-player games ended before completing leg one. First-to-24 takes priority. Among games that completed leg one, it took 15.1, 18.1 and 16.1 actions respectively. This is a conditional average, not an estimate for all games.

Hands grow by two per full round: draw three, spend one. Average remaining cards per player across primary cohorts were 24.6 / 18.8 / 15.3 for 2 / 3 / 4 players. The UI paginates long hands without discarding cards.

Across 240 primary games: 3,364 funding actions (60.3%), 1,049 public-value actions (18.8%), 901 capital calls (16.1%) and 269 founder hires (4.8%). Values are more varied than the preceding study: Conflict 173 plays, Dividend 170, Sweat 163, movement 160, Focused Execution 145 and recovery 124. Financing/tactical cards still receive very few plays under these simple heuristics. Exposure denominators and no-effect counts are in the report; low play counts do not establish weak cards.

Gross founder movement: Danilo 446 forward / 48 backward, Gill 428 forward, Ryan 421, Zack 402 and Aidan 273 across primary attempts. These are exposure-dependent contributions, not causal power rankings. Max's skipped occupied spaces and Mack's cash sit outside this movement ledger. Ryan and Dan are now limited across all purchases in a round; the sample 3004 review documents Dan converting one fumble to +1 and taking a second fumble normally.

All-seat dice comparison, four-player self-play, 20 games each: adaptive 27.3 actions, safe 22.7, balanced 20.9, risky 29.0. These small matched-seed cohorts describe table pacing, not the best individual strategy. Adaptive utility seeks portfolio value, not minimum game duration.

Limitations: random bids are a stress policy; founder scores are largely static; bots do not optimize terminal winning probability. In sample 3009, a bot uses Focused Execution to end the game while behind. Improve terminal decisions and contextual founder evaluation before interpreting win rates as balance. Human duration and enjoyment have not been measured.

Validation: 186 classic regressions and 36 dice regressions pass; production asset build passes. A complete browser game was played through, with a joint reveal checked at 1280×720 and settlement at 1024×720. Geometry checks found no document overflow or clipped settlement controls. The original tabletop design is retained; component inspectors show v132 founder wording.
