# Vests

**Current dice: v155.** Five public deal-flow cards at every player count; no round cap. Finish the current round when a company reaches 24 or the final deal-flow row is exhausted, then all companies exit at current prices. [Play](http://localhost:5188/?variant=dice) · [Secret-investment comparison: 216 games](docs/dice-secret-v153/run-02/report.html). Each investor privately receives one balanced bonus card: +$5/share in one company and +$3/share in the next, paid at exit. The deck has one card per active company; deal without replacement. Danilo advances one space when a company sharing his space moves. Base payouts remain $0 on spaces 0–4 and $1–$20 on spaces 5–24. Each investor starts with $20 cash and $20 repayable capital. Bots value their own bonus and sample unknown opponent cards in support planning. Start a new game to use the new setup. [Previous support-planner study](docs/dice-support-v150/run-01/report.html) is a historical snapshot.

[Five-card row / finish-only experiment](docs/dice-flow-finish-v154/run-01/report.html): 144 fresh simulations plus72 capped controls; historical experiment (finish-only, without the new deck-exhaustion ending). Reproduce with `node scripts/flow-finish-study.js NEW_DIRECTORY`.

Only classic and current dice are supported. Retired dice URLs open current dice; frozen editions live in `archive/versions` for historical regression/replay evidence and are excluded from production. `npm test` runs only current classic and dice regressions.


Current build **v128** ([changes](docs/v128-rules.md)). Gill Bates may move any one company 1 space before the reveal. Draw up to six growth tokens each round. Working Weekend costs no cash. [Current health report](docs/v128-health/report.html) · [Earlier pacing study](docs/v122-backlog-study/report.html).

Earlier reports and saved games retain their versioned rules.

## Run

Requires Node.js 20 or newer. No npm installation is needed; the game uses Node’s built-in modules.

```sh
npm start
```

Open **http://localhost:5188**. Rules, growth supplies, founders, value cards and exit values are available inside the game.

## Test and accelerate

```sh
npm test
npm run native:build
npm run dev
```

The optional Rust forecast accelerator requires `rustc`. Its build checks native/JavaScript parity before installing the platform-specific binary. Rebuild after engine changes. Without a compatible build, the game uses the JavaScript implementation. On localhost, browser bot decisions use the local server. Public deployments calculate bot decisions in a browser worker; game observations stay on the player’s device.

`npm run test:current` runs the 186 current-rule regressions (all pass). Historical files still describe older rules: its v110 audit had 407 passing, 107 failing and 7 cancelled tests. That historical suite needs migration before it can act as a current-build gate. The small frozen sources and saved outcomes under `docs/` are **test fixtures only**; they are not the current rules or a published balance study.

## Current rules

Normal founder replacement costs one action, no coins, and causes no fumble; it preserves an existing fumble.

Two to four investors start with $20 and three value cards. Take any two actions, including repeats: fundraise for a company you lead or one without a leader; change a founder in a company you lead; play/discard and replace a value card; gain $10 and advance capital; sell a share to the bank for $3/$6/$9 by company leg. An empty hand may spend an action to draw one card.

Payment immediately deploys `ceil(payment / 5)` supply tokens. There is no treasury, loan, bid lock or company special power. Each company has 15 growth tokens, including its fumbles. Resolve before-reveal founders, reveal six tokens, then discard one random remaining bag token face up without resolving it. Stop discarding when the bag is empty. Resolve after-reveal founders and catch-up normally. A fumbled company discards its next drawn token and recovers; there is no replacement draw. Burning means discarding: cards can return that token.

Value cards target portfolio companies. There are two copies of all 30 types. Capital is limited to six steps and subtracts $10 per step at final scoring. Cards can lower capital and reopen capacity. Fresh Perspectives refreshes the public founder market and draws two value cards instead of the normal replacement.

Finish the round before checking IPO: an unfumbled company at 24 ends the game. Use investors + 2 companies; the top half, rounded down, pay out. Bank-owned shares still dilute exit proceeds. Cash plus exit proceeds minus $10 per capital step wins. The optional native forecast accelerator remains disabled for the current rule system; decisions use JavaScript.

## Repository scope

This repository contains the playable game, supplied assets, tools and tests with their required reference fixtures. Historical report pages, bulk tournament archives, local dependencies and generated native binaries remain outside the published snapshot. Generate new study outputs in an ignored local directory.

## Deploy to Cloudflare

Run `npm ci`, then `npm run deploy` while signed into Cloudflare with Wrangler. The build publishes only the game and assets as the Worker **vests**. Reports, test fixtures, source archives and the local server are excluded.

Logs are enabled at 100% sampling and traces at 5%. The public game uses the existing JavaScript browser bot implementation. The optional native Rust accelerator remains available for local play and simulations.

Historical dice v130 restores the classic tabletop design and exposes payout (1×/2×/3×), dice per new share (1/2), and actions per round (5/3) in **New game**. [Pacing comparison and playtest recommendation](docs/dice-pacing-summary.md) covers 960 games and ten reviewed replays. Example: `npm run simulate:dice -- 42 4 --payout=3 --dice=2 --actions=3`.
