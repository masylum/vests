# Vests

A local board-game prototype for one human and 1 to 4 bots. Version 97 includes 22 founders, 14 unique value cards, the six-section illustrated rulebook, and the supplied Mario Adonei and Reid Fastings portraits.

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

`npm test` covers current rules, historical regressions, replays, conservation, privacy, bot forecasts and the local server. The small frozen sources and saved outcomes under `docs/` are **test fixtures only**; they are not the current rules or a published balance study.

## Current rules

Each investor starts with $50, one LP owing $55 at exit, and one private value card. A new LP can be taken without spending an action. Take one main action, then draw, play or exchange one value card; the hand limit is three.

Companies start on space 1. A growth card discarded to recover a fumble uses one of the five draws without a replacement. Fundraising uses sealed second-price bids, with open raises for tied high bidders. Funding thresholds are $1/$4/$7, $3/$6/$9 and $5/$8/$11 by company leg. Treasury deploys supply cards into a shared growth pile. Resolve five growth draws, public burns of one fewer card than investors, any available after reveal powers and the one space catch-up for companies on the lowest occupied space.

Finish the full round before checking IPO. The game ends only if a company is on space 24 and is not fumbled at that point. Otherwise, play another round. First arrival ranks ahead on a shared space. All companies on the furthest space are leading. Use two more companies than investors. The top half of companies, rounded down, pay their final track value, divided by all issued shares. Subtract every LP obligation from cash and exit receipts; most final money wins.

## Repository scope

This repository contains the playable game, supplied assets, tools and tests with their required reference fixtures. Historical report pages, bulk tournament archives, local dependencies and generated native binaries remain outside the published snapshot. Generate new study outputs in an ignored local directory.

## Deploy to Cloudflare

Run `npm ci`, then `npm run deploy` while signed into Cloudflare with Wrangler. The build publishes only the game and assets as the Worker **vests**. Reports, test fixtures, source archives and the local server are excluded.

Logs are enabled at 100% sampling and traces at 5%. The public game uses the existing JavaScript browser bot implementation. The optional native Rust accelerator remains available for local play and simulations.
