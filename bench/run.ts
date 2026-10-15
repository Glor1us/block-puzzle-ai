// Benchmark: play N seeded games with a bot (in parallel) and print score / survival stats.
// Usage: node bench/run.ts [--bot greedy|greedy-tuned|search|search-tuned|random] [--games 1000] [--seed 1]
//                          [--max-moves 20000] [--threads N]

import { parseArgs } from 'node:util';
import { BOT_NAMES, type BotName } from '../src/ai/bots.ts';
import { Pool } from './pool.ts';
import { stats } from './stats.ts';

const { values } = parseArgs({
  options: {
    bot: { type: 'string', default: 'greedy' },
    games: { type: 'string', default: '1000' },
    seed: { type: 'string', default: '1' },
    'max-moves': { type: 'string', default: '20000' },
    threads: { type: 'string' },
  },
});

const bot = values.bot as BotName;
if (!BOT_NAMES.includes(bot)) throw new Error(`Unknown bot: ${values.bot}. Known: ${BOT_NAMES.join(', ')}`);

const games = Number(values.games);
const seed0 = Number(values.seed);
const maxMoves = Number(values['max-moves']);
const pool = new Pool(values.threads ? Number(values.threads) : undefined);

const t0 = performance.now();
const results = await pool.run(
  [...Array(games)].map((_, i) => ({ spec: { bot }, seed: seed0 + i, maxMoves })),
  (done) => process.stderr.write(`  ${done}/${games}\r`),
);
await pool.close();
const secs = (performance.now() - t0) / 1000;

console.log(`bot=${bot} games=${games} seeds=${seed0}..${seed0 + games - 1} threads=${pool.size} time=${secs.toFixed(1)}s`);
console.table({ score: stats(results.map((r) => r.score)), moves: stats(results.map((r) => r.moves)) });
const capped = results.filter((r) => r.capped).length;
if (capped) console.log(`capped at ${maxMoves} moves: ${capped} games (their score is a lower bound)`);
