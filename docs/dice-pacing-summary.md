# Dice pacing comparison — v130-dice-preview

The dice UI now shares classic's card renderers, typography, circular track, company mats, investor icons and drawer. Dice-specific additions are deal-flow choices, pending dice, per-share exits and selectable experiment settings. Classic remains available with separate saves. Existing v129 dice replays can be loaded; the previous save is used when no v130 save exists.

960 four-player games: 40 fixed seeds (3000–3039), twelve rule configurations, balanced self-play and mixed rotating policies. Ten additional complete games (4000–4009) were replay-verified and reviewed through actions, auctions, movement, founder reactions and settlement. All completed. Earlier v129 artifacts remain unchanged.

| Setting | Normal actions | Auction attempts | Completed sales | Total shares | Die rolls | Mean sale price | Price p10–p90 | Mean finishers |
|---|---:|---:|---:|---:|---:|---:|---|---:|
| 5 actions, 1 die, original exits | 80 | 62.26 | 58.56 | 67.84 | 83.84 | $2.47 | $1–$4 | 2.58 |
| 5 actions, 1 die, double exits | 80 | 54.29 | 49.56 | 58.88 | 74.88 | $4.62 | $1–$9 | 2.03 |
| 5 actions, 1 die, triple exits | 80 | 48.96 | 44.41 | 53.78 | 69.78 | $6.23 | $1–$12 | 1.83 |
| 3 actions, 2 dice, double exits | 48 | 30.88 | 30.49 | 39.71 | 87.43 | $4.87 | $1–$9 | 2.78 |
| 3 actions, 2 dice, triple exits | 48 | 28.00 | 27.68 | 36.93 | 81.85 | $6.47 | $1–$12 | 2.56 |

Each row includes 80 games. Prices pool completed sales; p10–p90 is a price distribution, not an uncertainty interval. Other columns are per-game means. Total shares includes eight starting shares and free Sweat Equity shares, so it is not the auction count. The previous 66.9-share result used different seeds; the comparable new baseline is 67.84 shares and 62.26 auction attempts.

**Playtest recommendation:** three actions, two successive dice per new share, triple exits ($0 through space 8, then +$3 every two spaces, maximum $24). This reduced attempted auctions by 55% and normal actions by 40%, while mean die rolls and finishers stayed close to baseline. Doubled exits are a gentler alternative with less called capital ($13.59 versus $21.47 per investor), about three more auctions, and a narrower price range. All options are playable in New game; the original baseline remains the default for comparison. Setup and centre cards still roll once; games always finish four rounds.

Simply adding a second die with five actions is counterproductive for pacing: 111.55–138.68 rolls per game depending on payout. Reducing to three actions while retaining one die leaves only 0.60–0.86 companies at space 24 on average. No bot measurement establishes human game time.

## Limits exposed by the ten reviews

Policies remain heuristic-1 to isolate rule changes. They use a fixed progress forecast, do not explicitly price the extra die, reuse classic founder choices, and deliberately raise capital only before the last round. The random policy still caps bids at $8 under every payout curve. These limitations compress prices and sometimes leave good shares cheap late in the game. In sample 4001 everyone runs out of cash and three auctions fail; in 4008 random finishes with $36 while growth calls $80 of capital. Growth can spend entire rounds on capital while others initiate its purchases. These are reasons to strengthen bidding/caller policies before declaring the rules balanced.

All 16 dice tests and 186 current classic tests pass; Cloudflare assets build. Browser checks completed a short two-dice game and verified classic rendering, experiment controls, component library, and no page/drawer overflow at 1280×720.

## Artifacts and reproduction

- [Full HTML report](dice-pacing-v130/report.html): all twelve comparisons, separate lineups, paired-seed bootstrap intervals, ten reviews and replay links.
- [Metric data](dice-pacing-v130/summary.json), [raw games](dice-pacing-v130/games.jsonl), [source manifest](dice-pacing-v130/manifest.json).
- [Tracked ten-game reviews](dice-pacing-reviews.json).
- Bulk artifacts and frozen source are local/ignored, matching the repository's report convention.

```sh
npm run simulate:dice -- 42 4 --payout=3 --dice=2 --actions=3
node scripts/dice-pacing-study.js output-directory 40
node scripts/dice-pacing-audit.js output-directory
# Review all ten samples into output-directory/reviews.json, then:
node scripts/dice-pacing-report.js output-directory
```

Use the frozen source tree to reproduce this precise run. Bootstrap uncertainty resamples whole setup seeds including both lineups; matched seeds diverge after different choices. Two- and three-player settings have replay/completion tests, but this study's estimates cover four players only.
