# Vests v102 — tabletop presentation and funding

Supersedes v101 minimum bids and excess-bid locking; other v101 rules remain.

- Any positive whole-dollar bid is valid at every company position. Zero means pass. Public Offering starts at $1; subsequent raises are at least $1. Rights Issue prices must be positive and affordable.
- A winning investor spends only the actual payment. The excess of their bid over that payment stays available immediately. Second-price, first-price and tie rules otherwise remain unchanged.
- Deployment remains payment divided by four, rounded up, capped by available supply.
- Founder and value cards use width:height 5:7 with full-width artwork at the top. Company mats show numeric Supply and Used counts. The Supply catalogue shows each company’s original token quantities, not its live hidden supply.
- Each investor has one white/yellow panel with cash visibility unchanged, card count and capital steps 0–6. The decision drawer always stays at the bottom. UI v102.1 repairs the catalogues with fixed 5:7 card proportions and responsive page capacities.

Validation: 52 focused tests passed, including late-leg $1 fundraising and immediate reuse of unpaid bid money. Four complete seeded bot games (2/3/4/5 players; 12 forecast samples) passed per-command invariants, deterministic replay and independent score accounting. Logs are in `docs/v102-qa/`. These are execution checks, not a new balance study; the v101 report describes the old funding rules.
