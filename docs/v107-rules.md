# v107: persistent growth and quantified effect budgets

Stefan Hobbes reacts **once per token reveal**. The allowance covers the complete token reaction chain and resets for the next token. His trigger requires a growth-token reveal; action, Reveal start/end, hiring, purchase and catch-up movement do not trigger him. This implements the requested token-reveal scope. Max's occupied-space bonus is unchanged. The former chase-to-IPO regression now ends with Stefan at 5 and Max at 6, rather than both at 24.

Tokens no longer burn at round end. Unrevealed tokens stay in the bag. Engine resolution and bot projections both skip burning. The historical `burnPile` export remains for old explicit callers; it is not part of current gameplay and the default burn count is zero.

All eight company sets contain **15 tokens and 30 printed movement**. Their exact expected movement over a uniformly shuffled full set, starting unfumbled and without founders, ranges from **24.7912 to 30**. This includes the token lost to each fumble recovery. Expectation is not a guarantee for every shuffle or a guarantee all supply will deploy before another company exits. Distinct fumble counts retain different reliability; equal printed totals alone cannot equalize that.

Both component catalogues now have **6 columns and 5 rows**. At the verified 1280×720 viewport, 70×98 portrait thumbnails show all 30 value cards (26 founders occupy the same fixed sheet). Selecting a card opens a readable 280×392 poker-card detail. The sheet and detail have no scrolling; hidden thumbnail descriptions remain available in detail. The company title aligns with the lead marker above the founder picture.

## Effect-budget workbench

[Open the ranked table](v107-balance-guide.html). All 30 value cards have numeric decomposed budgets, including deployment, returning tokens to supply or bag, ownership changes, control, founder reassignment and fundraising. The table sorts by gross budget, net after action cost or name. It displays equal-copy mean, median, range and standard deviation, compares each card with the mean, and exports the current assumptions to CSV. All 26 founders have numeric effect and frequency-weighted values; each activation-frequency estimate can be edited.

The reference state and exchange rates are design hypotheses, not empirical calibration. The default effective random-token movement is the equal-company mean full-set recovery-adjusted movement divided by 15 (1.813736). The deployment probability is 0.8. Returning a token to supply also pays a 0.65 probability it will deploy. Consequently:

- Deploy 1 random token: **1.45 points**.
- Return 1 random token to supply: **0.94 points**.
- Return a selected 2.5-movement discard to the bag: **2.00 points**.
- Recover a useful fumbled company: **2.00 points**.
- Card deck gross mean: **1.34 points**; median **1.39**; net mean after a 2-point action opportunity: **−0.66**.

Share calculations use post-transaction fractions, including changed dilution for returned/newly issued shares. The reference assumes a $60 company exit, 75% chance of paying, two of four shares held, and $3 per point. These inputs are adjustable. Public Offering and Sealed Tender have identical estimates when payment and buyer distributions are held equal. Rights Issue assigns otherwise-unsold outcomes to the proposer’s mandatory purchase; Underwritten adds its conditional two-token bonus. This is a controlled outcome assumption, not evidence that the formats behave identically at a physical table.

Executive Hire's old zero was its net deployment-minus-fumble package, not a zero deployment value. The new breakdown exposes every positive benefit and negative cost. Package totals can still be zero when the priced benefits cancel the costs.

## Balance proposals, not applied rules

1. Use 2–3 gross points as an initial experimental target for a useful legal card, then measure frequency and actual score effects. This is a proposed band rather than a fitted optimum.
2. Matching Funds at **$2 for two** would move from 1.57 to 2.24 points under the defaults. Test against the current $4 version.
3. Executive Hire at **three deployments** would move from 0.90 to 2.35 points before founder/fumble synergies. Test against the current two.
4. Keep Growth Financing under observation: it is 0.57 points at the reference rates; it trails Matching by one point because one move is exchanged for $6 net scoring cost. Liquidity, proximity to exit and capital capacity can reverse its usefulness.
5. Inspect Inside Information (4.00) against Financial Advisor (2.89); selected known discards and supply re-deployment are materially different. Do not price both as identical deployment.
6. Test ownership cards across low/high payouts and the last portfolio stake. Their negative reference budgets identify tradeoffs, not universally bad cards.
7. Record actual founder activations, especially Mick purchase/recovery and Reed repeated sales. Replace the frequency hypotheses before claiming founder balance.

## Verification

- **107 focused tests passed** across v98 and v101–v107 regression files. Covers token totals/expectations, Stefan chain cap/reset/scope, persistent bag for 2–5 investors, all-card finite budgets, decomposition/averages, positive token values, share dilution, and unchanged current card/founder mechanics.
- **16 complete smoke games**, four each at 2/3/4/5 investors, samples=4. Every command passed engine invariants; every completed game replayed to identical scores and passed independent cash/score accounting. Duration: 4–11 rounds. No token-burn events. The old outlier seed 106500 completed in round 11.
- UI inspected at **1280×720**: 6×5 catalogue, complete names, full card inspection, workbench sorting/controls and positive primitive prices.
- Full historical suite and a statistically powered balance tournament were not run. Smoke games are execution checks, not proof of balance. No physical fundraising timing claims.

Raw smoke games, replays, checks and screenshots: [v107 verification files](v107-ui/checks.json).
