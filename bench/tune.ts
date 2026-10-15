// Weight tuning: a simple (1+λ) evolution strategy on the greedy bot.
// Fitness = mean score over fixed training seeds (100001+), disjoint from the benchmark seeds (1..1000),
// so the benchmark shows whether the gain generalizes. Games are deterministic per seed, so the
// fitness of a weight set has no noise; the only risk is overfitting to the training seeds.
// Usage: node bench/tune.ts [--generations 30] [--train 200] [--sigma 0.3]

import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { DEFAULT_WEIGHTS, type Weights } from '../src/ai/bots.ts';
import { nextRandom } from '../src/core/index.ts';
import { Pool } from './pool.ts';

const { values } = parseArgs({
  options: {
    generations: { type: 'string', default: '30' },
    train: { type: 'string', default: '200' },
    sigma: { type: 'string', default: '0.3' },
  },
});

const GENERATIONS = Number(values.generations);
const TRAIN_SEEDS = [...Array(Number(values.train))].map((_, i) => 100001 + i);
const MAX_MOVES = 20000;
// points is the scale anchor (the heuristic is scale-free); trayUnfit is a hard constraint.
const TUNED_KEYS = ['filled', 'holes', 'edges', 'probeUnfit'] as const;

const pool = new Pool();
const lambda = pool.size;

let rng = 12345;
function gaussian(): number {
  let u: number, v: number;
  [u, rng] = nextRandom(rng);
  [v, rng] = nextRandom(rng);
  return Math.sqrt(-2 * Math.log(u || 1e-12)) * Math.cos(2 * Math.PI * v);
}

/** Mean training score of several weight sets, all games in one parallel batch. */
async function fitness(candidates: Weights[]): Promise<number[]> {
  const jobs = candidates.flatMap((weights) =>
    TRAIN_SEEDS.map((seed) => ({ spec: { bot: 'greedy' as const, weights }, seed, maxMoves: MAX_MOVES })),
  );
  const results = await pool.run(jobs);
  return candidates.map((_, c) => {
    const slice = results.slice(c * TRAIN_SEEDS.length, (c + 1) * TRAIN_SEEDS.length);
    return slice.reduce((s, r) => s + r.score, 0) / slice.length;
  });
}

function mutate(w: Weights, sigma: number): Weights {
  const next = { ...w };
  for (const k of TUNED_KEYS) next[k] = Math.round(w[k] * Math.exp(sigma * gaussian()) * 1000) / 1000;
  return next;
}

function save(w: Weights, score: number, gen: number) {
  const body = Object.entries(w)
    .map(([k, v]) => `  ${k}: ${v},`)
    .join('\n');
  writeFileSync(
    new URL('../src/ai/tuned-weights.ts', import.meta.url),
    `// Written by bench/tune.ts (generation ${gen}, mean train score ${Math.round(score)} on ${TRAIN_SEEDS.length} seeds).\n` +
      `import type { Weights } from './bots.ts';\n\nexport const TUNED_WEIGHTS: Weights = {\n${body}\n};\n`,
  );
}

let best = { ...DEFAULT_WEIGHTS };
let [bestScore] = await fitness([best]);
let sigma = Number(values.sigma);
console.log(`gen 0: ${Math.round(bestScore!)} (start) ${JSON.stringify(best)}`);

for (let gen = 1; gen <= GENERATIONS; gen++) {
  const t0 = performance.now();
  const candidates = [...Array(lambda)].map(() => mutate(best, sigma));
  const scores = await fitness(candidates);
  const i = scores.indexOf(Math.max(...scores));
  const secs = ((performance.now() - t0) / 1000).toFixed(0);
  if (scores[i]! > bestScore!) {
    best = candidates[i]!;
    bestScore = scores[i]!;
    sigma *= 1.2;
    save(best, bestScore, gen);
    console.log(`gen ${gen}: ${Math.round(bestScore)} ↑ sigma=${sigma.toFixed(2)} ${secs}s ${JSON.stringify(best)}`);
  } else {
    sigma = Math.max(0.05, sigma * 0.85);
    console.log(`gen ${gen}: ${Math.round(bestScore!)} (best try ${Math.round(scores[i]!)}) sigma=${sigma.toFixed(2)} ${secs}s`);
  }
}

await pool.close();
console.log(`done: ${Math.round(bestScore!)} ${JSON.stringify(best)}`);
