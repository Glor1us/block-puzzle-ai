import { parentPort } from 'node:worker_threads';
import { createBot } from '../src/ai/bots.ts';
import { playGame } from '../src/ai/play.ts';
import type { Job } from './pool.ts';

parentPort!.on('message', (job: Job) => {
  const bot = createBot(job.spec.bot, job.spec.weights);
  parentPort!.postMessage(playGame(bot, job.seed, job.maxMoves));
});
