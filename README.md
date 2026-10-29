# Vests

A local board-game prototype for one human and 2–4 bots. Version 96 includes 22 founders, 14 unique value cards, the six-section illustrated rulebook, and the supplied Mario Adonei and Reid Fastings portraits.

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

The optional Rust forecast accelerator requires `rustc`. Its build checks native/JavaScript parity before installing the platform-specific binary. Rebuild after engine changes. Without a compatible build, the game uses the JavaScript implementation. Browser bot decisions stay on the local server; no game observations leave this computer.

`npm test` covers current rules, historical regressions, replays, conservation, privacy, bot forecasts and the local server. The small frozen sources and saved outcomes under `docs/` are **test fixtures only**; they are not the current rules or a published balance study.

## Current rules

Each investor starts with $50, one LP owing $60 at exit, and one private value card. A new LP can be taken without spending an action. Take one main action, then draw, play or exchange one value card; the hand limit is three.

Companies start on space 1. Fundraising uses sealed second-price bids, with open raises for tied high bidders. Funding thresholds are $1/$4/$7, $3/$6/$9 and $5/$8/$11 by company leg. Treasury deploys supply cards into a shared growth pile. Resolve five growth draws, public burns, after-reveal powers and the one-space catch-up for companies on the lowest occupied space.

Reaching IPO at space 24 marks the final round; finish it before settlement. First arrival ranks ahead on a shared space. All companies on the furthest space are leading. The top three companies pay their final track value, divided by all issued shares. Subtract every LP obligation from cash and exit receipts; most final money wins.

## Repository scope

This repository contains the playable game, supplied assets, tools and tests with their required reference fixtures. Historical report pages, bulk tournament archives, local dependencies and generated native binaries remain outside the published snapshot. Generate new study outputs in an ignored local directory.
