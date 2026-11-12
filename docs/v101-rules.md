# Vests v101 — cards, founders and physical company mats

The 21 requested cards are added to the nine retained types: 30 types, two copies each. Start with three; Fresh Perspectives can grow the hand, and Paid Advice/Anya can shrink it. The additive deck was explicitly confirmed by the user. The full definitions are in `src/card-expansion.js` and `src/intel.js`.

All company-targeting cards require portfolio ownership, including both ends of Mutual Insurance and Portfolio Transfer. Working Weekend and Fresh Perspectives have no company target and remain usable without shares. Card fundraising overrides the ordinary lead-only proposal restriction, but still requires a portfolio stake, remaining supply and an unissued share. Everyone may bid. Normal funds are still lead-only, with an unled-company entry exception.

## Resolution details

- Each card costs one action and draws one replacement unless explicitly stated otherwise. A card fundraise draws its replacement after resolution, then consumes its single action; it does not require an additional fundraise action.
- Working Weekend adds two actions before consuming its card action. Its once-per-turn flag resets when the next player begins a turn, not between actions.
- Fresh Perspectives draws two instead of one; it requires enough available cards for the increase. Supply/discards recycle normally. There is no three-card hand ceiling.
- Inventory Clearance uniformly removes two random supply tokens without replacement into a hidden, permanently destroyed zone. It logs quantities only; these tokens are not in the used pile and cannot be returned by Financial Advisor or founders.
- Exact movement costs must be payable: back-two cards require position at least 2, back-three at least 3; Paid Advice requires room to move two. Focused Execution requires one supply token; Growth Financing and Matching Funds require two.
- Capital is a bounded current track, 0–6. Consolidation/Restructure reopen capacity when they reduce it. Growth Financing adds no cash, but increases the final deduction by ten. Normal capital actions still provide ten cash for one step.
- Returned shares are removed from issuance, not transferred to the bank. Bank sales still retain an issued, bank-held share and pay 3/6/9 by leg. Stake Purchase excludes bank-held shares and transfers payment to the chosen investor.
- Mandate/Coup lead overrides expire on the next share issuance, retirement, transfer or bank sale in that company. Recompute natural leadership using holdings and purchase recency.
- Rights Issue offers clockwise starting after the proposer; first acceptance pays the named price. If all others pass, the proposer buys at that price. The proposer must afford it at play time.
- Public Offering starts with the proposer, permits first bid at the minimum and subsequent raises of at least one, and removes passing investors permanently. All-pass means no sale. A bidder's current high bid is not challenged by themselves.
- Sealed Tender preserves host top-tie preference and normal open tie resolution between other tied investors, but an untied winner pays their own bid.
- Underwritten Round deploys its bonus only for another investor's win, capped by remaining supply. Existing locked excess-bid commitments remain for normal/underwritten sealed raises.
- A new founder hire, through either normal replacement or Executive Session, fumbles the company. Mikel's renamed counterpart is explicitly able to recover after hiring.

## New founders

| Requested identity | Playable name | Power |
|---|---|---|
| Indra Noori | Indie Noury | Before reveal, while active and sharing a space: deploy one for every co-located company, where available. |
| Mikel Dell | Mick Dells | On a share purchase, move one and recover, even fumbled or just hired. Paid investor-to-investor purchases also qualify; free grants do not. |
| Reed Hoffmann | Reed Holdman | Once per round, while active, a bank share sale triggers move two and deploy one. |
| Mark Cubano | Marc Cubano | While active, an existing shareholder winning a fundraise triggers move two. Rights Issue is treated as a fundraise win. |
| Anne Wojitski | Anya Wojik | Before reveal, while active, the lead may discard one value card for move two and deploy two; no replacement. Deployment is supply-capped. |

## Physical presentation

Each smaller company mat has two graduated wells: face-down supply and used tokens. The tick marks (0/5/10/15) and the actual layers show physical quantities. No live bag-count display. Destroyed clearance tokens are not put in the used well. This is a UI representation of a proposed physical holder; token-thickness tolerance and practical handling still require a physical prototype.

Hands and catalogues have explicit paging. New card/founder artwork uses monograms pending final illustrations. The engine remains JavaScript; migration is outside this revision.

## Validation status

50 focused tests pass, plus two localhost server tests. The initial full historical suite records 351 passing, 91 failing, seven skipped; two port-permission failures passed on rerun. The remaining legacy failures require fixture/rule migration and review. Do not call the full suite green.

The frozen 130-game study and ten full reviewed replays are generated under `docs/v101-health-2026-11-02-verified/`. Earlier v98 results are historical and are not comparable proof of v101 balance.

Final study: 130/130 completed, with ten full replay reviews. Normal-policy median seven rounds, range four to 21; 15 of 340 player-games had at least three consecutive empty-portfolio round ends after owning a stake. Growth Financing was played once, Matching Funds five times and Stake Purchase ten times across 90 normal-policy games. This is a playable prototype with unresolved balance and agency concerns, not a balance certification.

The retained ending rule requires an unfumbled company on 24 at round end. Fumbling a company there can delay settlement; reaching 24 does not irrevocably trigger the end.
