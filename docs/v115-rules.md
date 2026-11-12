# v115 founder update

Matt is unchanged. Confirmed interpretations: Stefan keeps his landing trigger; Bony must land exactly one space behind a space occupied by exactly one company; Reid may choose any company’s discard.

| Founder | Effect |
|---|---|
| Stefan | Once per reveal phase, when another company lands on his space, move 2. Includes reveal-start movement. |
| Harry / Dan / Julie | Once per reveal phase, retaining their existing powers. The opening is part of that phase. |
| Mario | Move 2 whenever he recovers from a fumble, including a discarded recovery token or Harry/value-card recovery. No reveal-start deployment. |
| Reid | Once per reveal phase, optionally return a chosen discarded growth token to the bottom of its company’s supply, then move that company back 2. Opportunities at reveal start, after each token, and reveal end (including the bag discard). Identical tokens are grouped. |
| Jerry | Before the reveal, move 3 minus the number of different investor shareholders. Bank shares do not count. Four shareholders means move back 1; no shareholders means move 3. No purchase reaction. |
| Bony | On landing exactly 1 space behind a lone company, swap their spaces. No purchase or recovery reaction. |
| Danilo | Accompany another company moving from his shared space, forward or backward. Arrive together before occupied/empty-space landing checks. No bank-sale reaction. |
| Patricio | On landing on an empty space, move 1 more unless leading (including tied leaders). Repeats only while still behind the leader and landing on empty spaces. No fundraise-win reaction. |

Normal fumble suppression applies except Mario’s recovery trigger. No extra once-per-round limits were added to Bony, Danilo or Patricio.

The game and bot forecasts use the same movement/recovery implementation. The legacy native accelerator remains disabled for current rules. This update has focused rules tests and complete-game smoke checks, not a new balance study; v113 statistics do not describe these founders.

Validation: 156 current-rule tests pass. Three 4-sample smoke games (seeds 11502/11503/11504, 2/3/4 players) finished in 5/2/6 rounds and replayed to identical scores. These are execution checks, not duration estimates. Reid’s human token selector was exercised from a legal replay; its drawer fits without scrolling at 1280×720.
