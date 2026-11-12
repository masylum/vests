# v104 presentation and recovery clarification

- Announce each main action before executing it. Card announcements show the played card and its effect before any bidding or resolution. Fundraising receipts retain the format name, including Sealed Tender.
- Select a value card in the side hand, then choose Play or Discard. Selecting and returning to actions does not spend an action.
- Group deployments by company, summing all contributions. Two Amazin deployments of three appear as one six-token entry.
- Use token terminology for growth components; value cards remain cards. Remove the redundant Growth token caption on numbered tokens.
- Investor symbols: tree, rocket, lightning, egg; moon for a fifth investor. Shares are round markers, and the current lead uses a separate square marker.
- Reserve board/company/drawer dimensions across phase changes; compact auction receipts and page multiple reaction groups.
- Fumbled companies discard their next revealed growth token to recover without moving. This consumes one reveal and does not draw a replacement. The existing engine already followed this rule; a dedicated regression test now covers the draw count, bag size, discard and recovery.

Validation: 64 focused tests pass. Four low-budget bot smoke games (2–5 players) complete with invariant, replay and accounting checks. This release has no new balance-study claim; the v103 alternatives remain experimental. UI checks cover action selection, card announcement, bid and result at 1280×720; no universal viewport claim.
