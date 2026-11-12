# v109 — shared cards, six companies and revised effects

The game now supports **2–4 investors**, with two more companies than investors. Orbix and Airnest are out of the pool. The six retained token mixes are unchanged from v108: fifteen tokens each, 25.62–26.29 expected movement after recovery losses. No tokens burn.

## Card changes

All company effects target your portfolio. Pay all stated costs and have enough required components before playing. The cards omit separate scope and prerequisite labels; these rules still apply. One normal replacement follows a card play unless its effect says otherwise.

| Card | v109 effect |
|---|---|
| Matching Funds | Pay $3; deploy 2 tokens. No new share. |
| Bridge Financing | Advance capital by 1; move 2 and deploy 1 token. No cash. |
| Inside Information | Choose a portfolio company; return 1 of its discarded tokens to the growth bag. |
| Focused Execution | Choose two different portfolio companies. Move the first back 2, then the other forward 2. No deployment. |
| Paid Advice | Discard another value card; move 1 and gain $3. Draw only the normal replacement. |
| Working Weekend | Pay $2; gain 2 actions this turn. Once per turn. Playing it still spends one action. |
| Fresh Perspectives | Gain $2; draw 2 value cards instead of the normal replacement. |

Paid Advice retains its additional discard; Bridge Financing retains its capital cost. Other costs, timings and effects remain unchanged.

Executive Session is now **Infamous Ousting**. Public Offering is now **Convertible Notes**, retaining the ascending auction. Stable internal card identifiers preserve artwork mappings and engine commands.

Mick Dells is now **Mony Pa** (Pony Ma); Reed Holdman is **Danilo Egg** (Daniel Ek); Marc Cubano is **Patricio Colson** (Patrick Collison). Their powers are unchanged. Mack Ja uses the previous Jack Ma portrait. Morris Chang and Robert Noyce have not been added because no powers or existing-founder mappings were specified.

## Presentation

The board scales beyond its old fixed size and is centered within the available table area. The bottom drawer and centered investor strip retain their reserved spaces. Company mats use dark shades of their company color for ink and borders; the lead spot uses a crown. Names sit to the right of the full-height founder card, with share space above the Supply / Used counts.

One shared founder renderer and one shared value-card renderer serve the hand, board and catalogue. Contexts change width; poker proportions, artwork, complete text and proportional typography remain consistent. Separate shortened founder summaries, hand text truncation, value-card zoom icons, scope labels and prerequisite labels are removed. Timing reads **Before the reveal**, highlighted yellow. The catalogue has **8 columns and 4 rows**; selecting a card opens its readable detail. On small screens, the complete overview necessarily uses smaller cards; detail remains available.

## Verification

All 115 regression and v109 tests pass. They cover payments, token conservation, capital limits, changed movement, explicit two-company targeting, invalid-command atomicity, discarded-token return and renamed component identities. Six complete bot games (two seeds each at 2, 3 and 4 investors, eight forecast samples) also check engine invariants, deterministic replay and independent score accounting. All six completed. A seventh four-investor game at the production 24-sample setting also completed, with replay and independent accounting checks (`docs/v109-ui/production-smoke.json`). Saved cohort results: `docs/v109-ui/smoke-games.json`.

This is an implementation smoke check, **not a new balance study**. The v108 study is preserved as historical evidence and does not rank these redesigned cards. Production bot cost/target heuristics and the provisional worksheet have been updated to the new effects; their exchange rates have not been newly calibrated by this check.
