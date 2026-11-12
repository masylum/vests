// Deal-flow primitives are independent of the legacy growth-token economy.
export const DEAL_FLOW_VERSION = '130-dice-preview';
export const GROWTH_DIE = Object.freeze([0, 1, 1, 2, 2, 3]);
export const DEAL_FLOW_RULES = Object.freeze({
  companies: 6, startingCash: 20, startingShares: 2,
  handSize: 6, actionsPerRound: 5, capitalCash: 10, finishers: 3,
});

export function rollGrowthDie(random) {
  const sample = random();
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) throw Error('Invalid die randomness.');
  const face = Math.floor(sample * GROWTH_DIE.length);
  return { face, printed: GROWTH_DIE[face], fumble: face === 0 };
}

// An entitlement is a separate ledger entry: resolving it never alters shares.
export function grantGrowth(state, player, company, source = 'share') {
  if (!state.players[player] || !state.companies[company]) throw Error('Invalid growth recipient.');
  state.pendingGrowth ??= [];
  state.growthSerial = (state.growthSerial ?? 0) + 1;
  const entry = { id: state.growthSerial, player, company, source, round: state.round, resolved: false, remaining: source === 'setup' ? 1 : (state.dicePerShare ?? 1) };
  state.pendingGrowth.push(entry);
  return entry;
}

export function pendingFor(state, player) {
  return (state.pendingGrowth ?? []).filter(entry => entry.player === player && !entry.resolved);
}

export function nextGrowthPlayer(state, after) {
  for (let offset = 1; offset <= state.players.length; offset++) {
    const player = (after + offset) % state.players.length;
    if (pendingFor(state, player).length) return player;
  }
  return null;
}

export function consumeGrowth(state, player, entitlement) {
  const entry = pendingFor(state, player).find(item => item.id === entitlement);
  if (!entry) throw Error('Choose an unresolved growth entitlement you own.');
  entry.remaining = (entry.remaining ?? 1) - 1;
  entry.resolved = entry.remaining === 0;
  return entry;
}

export function dealFlowScore(cash, payouts, capitalCalled) {
  return cash + payouts - capitalCalled;
}

export function consumeDealFlow(player, index, { fundingCompany, actionsPerRound = DEAL_FLOW_RULES.actionsPerRound } = {}) {
  if (player.actionsTaken >= actionsPerRound || player.dealFlow.length <= 1)
    throw Error('Keep your last deal-flow card for centre growth.');
  if (!Number.isInteger(index) || index < 0 || index >= player.dealFlow.length)
    throw Error('Choose a deal-flow card from your hand.');
  if (fundingCompany !== undefined && player.dealFlow[index].company !== fundingCompany)
    throw Error('Funding requires the matching company card.');
  const [card] = player.dealFlow.splice(index, 1);
  player.actionsTaken++;
  return card;
}

export function revealCentreCards(players, first, actionsPerRound = DEAL_FLOW_RULES.actionsPerRound) {
  if (!players.every(p => p.actionsTaken === actionsPerRound && p.dealFlow.length === 1))
    throw Error('Every investor must finish their actions before centre growth.');
  return players.map((_, offset) => {
    const player = (first + offset) % players.length;
    return { ...players[player].dealFlow.pop(), player, resolved: false };
  });
}
