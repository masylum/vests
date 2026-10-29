import { pathToFileURL } from "node:url";
import {
  createGame,
  currentPlayer,
  command,
  assertGame,
} from "./src/engine.js";
import { botCommand } from "./src/bots.js";
export function simulate({
  seed = 42,
  players = 4,
  rules = {},
  samples = 8,
  policy = "normal",
  policies = null,
  seat = 0,
  trace = false,
  sampler = 'independent',
} = {}) {
  if (policies !== null && (!Array.isArray(policies) || policies.length !== players || policies.some(p => !["noIntel", "noFounder", "randomPower", "randomCall", "randomBid", "blindDeck", "blindFounders", "adaptiveRandomFounder", "adaptive", "normal", "allIn", "concentrated", "passive", "randomFounder", "randomChoices", "sellAll"].includes(p))))
    throw Error("Choose one valid policy per player.");
  const g = createGame({ seed, players, rules });
  g.fast = !trace;
  const commands = [];
  for (let n = 0; !g.ended && n < 6000; n++) {
    if(g.metrics.cycles>80)throw Error("Censored: no IPO after 80 rounds, seed " + seed);
    const id = currentPlayer(g),
      chosenPolicy=policies?.[id] ?? (id === seat ? policy : "normal"),
      cmd = botCommand(g, id, {
        samples,
        policy: chosenPolicy,
        sampler,
      });
    if (trace) commands.push({ id, cmd });
    command(g, id, cmd);
    assertGame(g);
  }
  if (!g.ended) throw Error("Did not finish " + seed);
  if (trace)
    g.replay = {
      version: g.version,
      setup: {
        seed,
        players,
        rules: {...rules},
      },
      commands,
    };
  return g;
}
const avg = (a) => a.reduce((s, n) => s + n, 0) / Math.max(1, a.length);
export function summary(games) {
  const total = (k) => games.reduce((s, g) => s + g.metrics[k], 0),
    mean = (k) => total(k) / games.length;
  return {
    games: games.length,
    meanScore: avg(games.flatMap((g) => g.scores)),
    positiveFunds: avg(games.flatMap((g) => g.scores.map((n) => +(n > 0)))),
    cycles: mean("cycles"),
    legCycles: [0, 1, 2].map((l) =>
      avg(games.map((g) => g.metrics.legCycles[l]??0)),
    ),
    auctions: mean("auctions"),
    contested: total("contested") / Math.max(1, total("auctions")),
    soleBidder: total("soleBidder") / Math.max(1, total("auctions")),
    unsold: total("unsold") / Math.max(1, total("auctions")),
    meanPayment: avg(games.flatMap((g) => g.metrics.payments)),
    purchased: mean("purchased"),
    revealed: mean("revealed"),
    entered:mean("entered"),
    pendingPaid: avg(games.map(g=>g.pile.filter(c=>c.paid).length)),
    pendingCards: avg(games.map(g=>g.pile.length)),
    downRounds: mean("downRounds"),
    bankDilution: mean("bankDilution"),
    setbacks: mean("setbacks"),
    wasted: mean("wasted"),
    wasteFraction: total("wasted") / Math.max(1, total("entered")),
    losingInvestments: avg(games.flatMap(g => g.metrics.investments.map(x => +(x.payout < x.cost)))),
    defaults: total("defaults") / (games.length * games[0].players.length),
    defaultsByLeg: [0, 1, 2].map((l) =>
      avg(
        games.flatMap((g) =>
          (g.settlements[l]?.accounts??[]).map((a) => +(a.unpaid > 0)),
        ),
      ),
    ),
    fallbacks: total("fallbacks") / games.length,
    movementGrowth: mean("growthMovement"),
    founderBonus: mean("founderBonus"),
    founderSwaps: mean("founderSwaps"),
    sold: mean("sold"),
    retained: mean("retained"),
    bankFraction: avg(
      games.map((g) => {
        const ts = g.companies.flatMap((c) => c.tokens);
        return (
          ts.filter((t) => t.owner === null).length / Math.max(1, ts.length)
        );
      }),
    ),
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const {parallel}=await import('./scripts/parallel.js');
  const count=Number(process.argv[2]??10);
  if(!Number.isInteger(count)||count<1)throw Error('Choose a positive game count.');
  const games=await parallel(Array.from({length:count},(_,i)=>({seed:10000+i,samples:12})),{moduleURL:new URL('./scripts/simulate-game.js',import.meta.url)});
  console.log(JSON.stringify(summary(games),null,2));
}
