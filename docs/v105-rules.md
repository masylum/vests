# v105: agency, card planning and stable presentation

Harry Cage now responds to fumbles during the complete reveal sequence: before reveal, token draws, and after reveal. He may help once per sequence. This includes Matt Sikaberg’s before-reveal fumble. A regression exercises the offer, recovery and two-token deployment. Fumbles from hiring or ordinary action-phase cards remain outside this timing window.

If your hand is empty, you may spend one action to draw one value card. Recycle discards as normal. You cannot use this action with a nonempty hand or when every value card is held by investors. Bots prioritize refilling an empty hand, including at capital six; passing remains restricted to investors with no legal action.

Bots evaluate Underwritten Round, Public Offering and Sealed Tender using sampled opponent bids and the resulting payment, ownership, growth deployment and founder effects. Underwritten forecasts include its two bonus tokens when someone else wins. First-price bids pay their own amount. Ascending initiation uses a proxy for the eventual ascending price; it is not a full sequential auction solver. Rights Issue retains explicit price selection and forced-purchase valuation.

Board Mandate’s forecast now spends $4 and changes control. Founder replacement competes in the same value units as other actions, includes the hiring fumble, and carries an additional penalty for repeated changes within the round. Choice execution uses the same forecast assumptions. Exchanges compare a conservative public replacement estimate against the card’s retained option value; cards with explicit outcome forecasts use those values when considering discarding. No hidden opponent hands or deck order are read. Replacement and future-action values remain heuristics, not optimal-play guarantees.

The company mat reserves its top-right corner for a round lead marker, with round share tokens below and separate Supply/Used counters. Before/after-reveal timing is highlighted yellow. Bank-sale buttons show $3/$6/$9 before selection. The supply library aligns fumble icons with numbered tokens and has a shared fumble legend. Both card catalogues use two fixed rows of portrait 5:7 cards with full-width art.

The board, investor strip and drawer have reserved geometry. The former conditional drawer heights are removed. Founder reaction prompts reuse the already-announced token’s compact caption and page reaction chains. At 1280×720, checked action announcement, bid, result, deployment, token announcement and founder reaction have identical board/drawer bounds. The tested reaction and both catalogues have zero vertical overflow. Very small viewports remain unverified.

Refresh now restores the replay plus pending action announcement, selected hand card/target, scouting selections, reaction-page position, autoplay and bid-form drafts. Each QA URL has its own save slot. Opening a catalogue is temporary and does not advance the game.

Cleanup removes 264 overridden CSS declarations, obsolete treasury/grid/lead-slot styles, unreachable value-card branches, unused crisis/recovery bindings, and the live Anya/Melania/Financing experiment switches. Their defaults remain move 2 / move 2 / deploy 2. Historical reports retain their frozen sources and runners; superseded runners were removed from scripts/. The reusable smoke runner is scripts/health-game.js.

Validation: **71 focused tests pass**. **Eight smoke games**, two at each of 2–5 players, complete with invariant, deterministic replay and independent cash/score accounting checks. These games include one empty-hand draw, 185 card plays and 33 exchanges. They establish execution, not balance or human enjoyment. The historical full test suite was not rerun.

Screenshots: [tabletop](v105-ui/tabletop.png), [reaction drawer](v105-ui/reaction.png), [supplies](v105-ui/supply.png), [value cards](v105-ui/value-cards.png), [founders](v105-ui/founders.png). The v103 report remains a version-specific historical study.
