> Historical results: these simulations used incorrect global before/after activation hooks. Gill and other timed founders could activate during another company’s purchase. These results do not establish balance for the corrected v135 rules.

# Scarcity follow-up: eight to ten cards

Newer: [individual-hand scarcity, draw two and card-free support actions](dice-flow-summary.md). This clarifies the earlier movement attribution and tests the next proposals.

[Report and ten complete reviewed games](dice-finite-v133/scarcity-02/report.html). Rules v133, configured supplies 8/9/10; existing live default unchanged. Four-card recommendation withdrawn: ending early was not a valid balance improvement.

540 primary games (30 seeds × 3 supplies × 3 player counts × balanced/mixed cohorts), plus 90 funding-only diagnostic games and 90 call-targeting diagnostic games. All 720 completed; ten additional samples replay exactly, with cash + payout − called capital reconciled. All aggregate supply and movement accounting reconciles. No production engine or bot changes.

| Cards/company | Reached 24 | Mean first–last gap, only reaching 24 | Mean first–third gap, only reaching 24 |
| --- | --- | --- | --- |
| 8 | 160/180 (88.9%) | 22.6 | 14.5 |
| 9 | 175/180 (97.2%) | 22.5 | 15.3 |
| 10 | 177/180 (98.3%) | 22.6 | 15.4 |

Winners average 6.1 matching-card calls and still have 2.7 company cards unspent (2.4 already in hands). Only 45/512 finishing winners reach the matching-call cap. Winning positions reconcile as 3.4 after setup + 16.1 net during own-call actions + 4.5 during other actions. Own-call movement includes founder reactions. Approximately 90% of discards belong to bottom-half companies at that moment, ties included. Drawing three while spending one leaves an average 27.2 cards in hands when the first company finishes. Thus finite supply rarely forces the winner's investors to stop, and the other cards do not force laggard investment.

The bot has a separate action-selection weakness: samples repeatedly show a player calling a company that immediately ends the game in another player's favor. Redirecting already-chosen calls toward the lowest-position company in the actor's hand tightens ten-copy four-player finishes from 22.7 to 12.3 spaces, but reduces finish frequency from 29/30 to 24/30 and increases mean total actions from 22.9 to 53.9. This is a diagnostic policy, not demonstrated rational play or a proposed compulsory catch-up rule. The funding-only diagnostic also removes capital access; its exhaustion results are confounded by cash starvation.

Neither supply nor tested policy achieves both provisional targets (≥95% reach 24, mean first–last ≤16 and first–third ≤8 among those finishes). Finish-rate uncertainty and per-player results appear in the report. Next discriminate bot endgame incentives, off-company founder movement and draw/hand availability separately, keeping enough total supply to finish. Do not present a new default as balanced on this evidence.

Reproduce with the frozen sources and manifests linked in the report. Primary seeds 4001–4030, sample seeds 5001–5010; seat policies rotate by seed. The targeting follow-up has its own frozen source identity. Historic artifacts remain unchanged; bulk files remain local under the repository's existing report-ignore policy.
