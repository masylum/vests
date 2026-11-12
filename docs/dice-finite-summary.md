> Historical results: these simulations used incorrect global before/after activation hooks. Gill and other timed founders could activate during another company’s purchase. These results do not establish balance for the corrected v135 rules.

# Finite deal-flow v133

**The four-card balance recommendation below is withdrawn.** It primarily reduced spread by ending before companies reached 24. See the [8–10-card follow-up](dice-scarcity-summary.md): nine and ten allow most games to finish, but supply alone does not keep them tight. The live default has not been changed by this research-only follow-up.

## Historical four-card experiment

Default: four cards per company (24 total), one persistent shuffled deck, no recycling. Start with five; draw up to three each round while supply lasts. Keep all unused cards. Skip empty hands. Exhaustion of deck and every hand settles all companies at their current prices after the final action resolves. Founder, dice, payout, leg and first-at-24 rules are unchanged. Previous v132 is preserved at `?variant=dice-v132`.

The previous draw routine created a new balanced deck on every draw, so spent company cards did not reduce future supply. The new engine conserves each company's four cards across deck, hands and spent pile. The board displays unspent cards per company and deck size without disclosing opponents' hands.

[Concise report, data, frozen source and ten reviewed replays](dice-finite-v133/confirm-01/report.html) · [Ten review notes](dice-finite-reviews.json).

600 screening games compared 4/5/6/8/10 copies; 240 independent confirmation games tested four; 120 smaller-table games tested two/three where setup permits. All completed. Four-player confirmation: mean first–last gap 14.6 versus v132's 22.2; first–third 7.1 versus 16.2. Mean 23.5 actions; 75/80 exhaustion endings. Two-player gap remains 18.2; three-player 16.2. Two confirmation games have no paying companies. The provisional gap target ≤16 is met only at four players; the target ≤3 zero-paying companies is unmet everywhere. Smaller supplies mostly truncate movement: 16/40 two-player games with two copies have no paying company.

Supply scarcity is now real, but not sufficient to make every race tight. Discarded cards can starve laggards, and founders/public value cards can move exhausted companies. Bots were held unchanged and exhibit late-game valuation errors. These results support a smaller finite supply, not a claim of completed global balance.

Validation: 40 dice regressions, 186 current classic regressions and Cloudflare asset build pass. Study commands and source hashes are in the report manifests. Bulk run artifacts remain local under the repository's existing report-ignore policy.
