# v117: Max and selective emphasis

Max Bahnhof: “While moving, I skip spaces with other companies.”

Occupied spaces do not consume Max’s movement, forward or backward. Several companies on a space still count as one occupied space. Zero movement stays put. Max stops at the track boundary; he cannot skip past 24 or below 0. Fumbled founders remain inactive. Swaps and effects naming a destination still place Max on that destination.

The old occupied-landing extra move has been removed. Danilo may accompany Max, but his arrival cannot create another Max move. The same movement function runs token effects, cards, catch-up and bot forecasts.

Each founder/value card has one selected bold effect phrase. Titles remain bold and reveal timing stays yellow. Text and formatting are separate so every view uses the same emphasis without changing card mechanics.

Validation: 177 current-rule tests pass, including forward/backward skipping, crowds, boundaries, fumbles, relocations, token reveals and Max–Danilo catch-up. The two v116 round-one seeds were rerun at the same 24-sample bot budget: seed 116203 (2 players) now finishes in 8 rounds; seed 116404 (4 players) now finishes in 7. Both pass replay, invariants and independent cash/score accounting. Frozen source, full traces and results are under `docs/v117-validation/`. This is targeted regression validation, not a new game-health or balance study.
