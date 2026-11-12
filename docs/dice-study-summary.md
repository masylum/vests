# Dice preview: first payout experiment

Version `129-dice-preview`, bot `dice-heuristic-1`. 720 completed games, zero engine failures or diagnostic cutoffs; ten additional complete games replayed identically and reviewed. All games complete exactly four rounds. The default remains $0–$8 per share.

Each row contains 120 games: 60 balanced self-play and 60 rotating mixed-policy games, using matched seeds 1000–1059. All-company payouts and the fixed die remain unchanged.

| Players | Maximum per-share exit | Mean rolls | Mean finishers | Three or more finishers | Mean called capital/player |
|---|---:|---:|---:|---:|---:|
| 2 | $8 | 43.2 | 0.16 | 0% | $4.4 |
| 2 | $16 | 40.2 | 0.17 | 0% | $14.4 |
| 3 | $8 | 63.3 | 0.88 | 4.2% | $6.8 |
| 3 | $16 | 57.3 | 0.79 | 0% | $23.6 |
| 4 | $8 | 82.9 | 2.18 | 35% | $12.0 |
| 4 | $16 | 73.9 | 1.89 | 24.2% | $30.9 |

Larger payouts raise bids and capital calls under these policies, leaving fewer funding actions and dice. This supports retaining the smaller curve for the first playable release, not a claim that its balance is solved. Two-player play produces a different race density; its partial exits still score normally.

The ten reviews identify clear bot limitations: low early bid ceilings, random founder replacement, and a final-round restriction on planned capital calls that can leave bots initiating no-sale auctions. Improve those policies before inferring rule or founder imbalance. Capital never directly creates profit: all calls are deducted in settlement, including unused calls.

The full local [HTML report](dice-study/report.html) includes per-policy results, paired seed-cluster intervals, action mix, source hashes/snapshot, all 720 game records and ten complete command/event traces with candidate valuations. Bulk output is intentionally ignored by Git; the [ten reviews](dice-study-reviews.json) are retained.

Reproduce from this source:

```sh
node scripts/dice-study.js docs/dice-study 60
node scripts/dice-audit.js docs/dice-study
node scripts/dice-report.js docs/dice-study
```

The report refuses to reuse these reviews if the ten sample seeds or scores differ. New engine/bot experiments should use a new output directory and fresh reviews. The study runner is single-process and deterministic. Browser and simulation bots use the same policy.

Validation: 14 dice tests and 186 current classic regressions pass; the Cloudflare asset build succeeds. Browser checks cover a complete four-player game, setup and human growth interaction, compatible catalogue/assets, and settlement at 1280×720 and 1024×720. Local QA saves use a separate key.
