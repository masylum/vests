# v108 — compensated company growth, card presentation, and outcome testing

## Implemented rules

Every company still has **15 growth tokens**, but printed totals now compensate for fumble recovery. The aim is approximately **26 expected realized movement**, without founders, other cards or the track cap:

| Company | +1 | +2 | +3 | Fumble | Printed movement | Expected movement |
|---|---:|---:|---:|---:|---:|---:|
| Gogol | 2 | 10 | 2 | 1 | 28 | 26.13 |
| Amazin | 4 | 11 | 0 | 0 | 26 | 26.00 |
| Weta | 0 | 5 | 7 | 3 | 31 | 25.62 |
| Novidia | 0 | 9 | 4 | 2 | 30 | 26.29 |
| Testra | 1 | 7 | 5 | 2 | 30 | 26.29 |
| Obenay | 2 | 5 | 6 | 2 | 30 | 26.29 |
| Orbix | 3 | 8 | 3 | 1 | 28 | 26.13 |
| Airnest | 4 | 6 | 4 | 1 | 28 | 26.13 |

The prior v107 expected range was 24.79–30. Equal printed totals could not equalize fumble recovery losses. This iteration prioritizes the user's new expected-movement target; different printed totals are necessary to compensate. Different fumble counts retain different variance and founder synergies. These expectations assume every token is eventually drawn; they do not guarantee every shuffle or every company finishes before another exits.

Stefan remains once per token reveal, including that token's entire chain. No undrawn tokens burn. Capital is still capped at six; the two-action system, payments, selling prices and other card/founder effects remain as in v107. No proposed card buff/nerf was silently applied.

## Card names, artwork and wording

Growth Financing is now **Bridge Financing**. Capital Restructure is now **Illicit Funding**. Stable internal card IDs are retained for engine decisions.

The 13 supplied PNGs are installed unchanged. Secondary Sale uses Sell Position art; Paid Advice uses Wasteful Advice; Bridge Financing uses Bridge art; Illicit Funding uses the prior illicit-capital art; Portfolio Transfer uses Secondary Market art. Twenty-seven card types now have artwork. Public Offering, Stake Purchase and Fresh Perspectives retain monograms because no replacement image was supplied for them.

Card text is shorter. A consistent **Portfolio company / Portfolio companies / Your investor** label states target scope; a compact requirements line names supply, capital or free-share-slot requirements. The engine still validates every target and payment. Rights Issue retains the proposer-can-pay requirement and the mandatory purchase if all others pass. Paid Advice retains the extra discard and only one normal replacement. Share additions/returns still change issuance as specified.

## Tabletop presentation

The founder card spans the company mat from top to bottom. Company name and lead marker occupy the right column; share tokens have the area below them, and Supply/Used sit at the bottom. The mat is shorter and the board uses a smaller, stable logical canvas.

Small live cards are deliberate previews, not the sole way to read the rules. Click any founder, or the **↗** on a hand card, for a full 320×448 portrait card with **18px rules and 23px title**. The card inspector pauses bot scheduling and resumes it on close. Six-column/five-row catalogue indexes remain, with readable 14px labels beside the thumbnails and full-card inspection. Short tabletop founder summaries retain complete rules in the inspector. Hand descriptions use a marked preview ellipsis instead of overflowing or squeezing more text into tiny type.

## Card study

[Open the outcome report](v108-card-study/report.html).

- 50 normal self-play games plus 16 mixed simple-random stress-seat games, at the production 20-sample decision budget.
- All 30 cards tested in 9–10 source games: 300 raw paired contexts, 296 unique after removing repeated contexts. Play versus discard spends the same action and uses the real rules engine and normal replacements.
- Every immediate card result evaluated at 20 and 64 independent samples with the **exact production portfolio utility**. The utility was exported for instrumentation without changing its formula or bot decisions.
- 30 first-context matched continuations repeated using 64-sample bots.
- 18 additional related-card pairs at identical positions: Focused/Matching, Bridge/Matching, Inside/Advisor.
- 762 completed base runs/continuations in total, including repeated contexts. These are not 762 independent tests of each card.
- Ten preselected complete games reviewed with step references; raw commands, event traces, valuations, frozen simulation source, runner snapshots, protocols and hashes are included.

The report separates direct forecast values from actual complete-game score changes. Approximate intervals cluster by source game. Production parameters are not claimed globally optimal: risk aversion, relative rival valuation, forecast funding and unmodeled future actions/cards create real limitations. Broad intervals and 20→64 sign changes are shown, not hidden.

The clearest related-card signals are Bridge trailing Matching in all six shared positions and Inside beating Advisor in all six. Focused and Inside are useful strong benchmarks. Paid Advice, Working Weekend and Fresh expose missing card/action opportunity modeling; do not balance them blindly from the forecast. Repeated empty fundraises are documented bot-planning limitations.

## Verification

109 focused tests passed across the current v98 and v101–v108 regression files. Added checks cover the compensated 26-movement target and exact production utility instrumentation. All 27 artwork mappings resolve. Base study games passed per-command invariants, replay and independent final-score accounting. Retained paired continuations passed per-command invariants and replay. Failed harness attempts are retained with corrections explained in the report.

UI verification includes the 1280×720 setup, action announcement, card indexes, readable card inspectors, artwork and company mat fit. Screenshots and geometry checks are in `v108-ui`. Full historical tests and physical auction timing were not run. Bot simulations cannot establish human enjoyment or fully calibrated balance.
