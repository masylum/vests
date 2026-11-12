import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../src/engine.js';
import {resolveRevealPhase, resumeRace} from '../src/racing.js';

test('Gill chooses a single one-space move, including his own company', () => {
  const game = createGame({players: 4, seed: 128});
  for (const company of game.companies) company.founder = -1;
  const [gill, target] = game.companies;
  gill.founder = 3;
  gill.tokens = [{owner: 0}];
  resolveRevealPhase(game, 'start', true);
  const {options} = game.powerChoice;
  assert.equal(options.length, game.companies.length + 1);
  assert.ok(options.slice(1).every(option => option.actions.length === 1 && option.actions[0].amount === 1));
  const choice = options.findIndex(option => option.actions[0]?.company === target.id);
  const before = game.companies.map(company => company.position);
  resumeRace(game, choice);
  before[target.id] += 1;
  assert.deepEqual(game.companies.map(company => company.position), before);
});
