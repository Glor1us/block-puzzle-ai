// Runs games on worker threads. Seeds are handed out one at a time, so long and short games balance out.

import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';
import type { BotName, Weights } from '../src/ai/bots.ts';
import type { GameSummary } from '../src/ai/play.ts';

export interface BotSpec {
  bot: BotName;
  weights?: Weights;
}

export interface Job {
  spec: BotSpec;
  seed: number;
  maxMoves: number;
}

export class Pool {
  private workers: Worker[];
  private onError: ((e: unknown) => void) | undefined;

  constructor(threads = availableParallelism()) {
    this.workers = [...Array(threads)].map(() => {
      const w = new Worker(new URL('./worker.ts', import.meta.url));
      w.on('error', (e) => this.onError?.(e));
      return w;
    });
  }

  get size() {
    return this.workers.length;
  }

  /** Plays all jobs; results come back in job order. */
  run(jobs: Job[], onProgress?: (done: number) => void): Promise<GameSummary[]> {
    const results: GameSummary[] = new Array(jobs.length);
    let next = 0;
    let done = 0;
    return new Promise((resolve, reject) => {
      this.onError = reject;
      if (jobs.length === 0) return resolve(results);
      const feed = (w: Worker) => {
        if (next >= jobs.length) return;
        const index = next++;
        w.once('message', (r: GameSummary) => {
          results[index] = r;
          done++;
          onProgress?.(done);
          if (done === jobs.length) resolve(results);
          else feed(w);
        });
        w.postMessage(jobs[index]);
      };
      for (const w of this.workers) feed(w);
    });
  }

  close() {
    return Promise.all(this.workers.map((w) => w.terminate()));
  }
}
