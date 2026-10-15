import { applyMove, newGame, type GameConfig, DEFAULT_CONFIG } from '../core/index.ts';
import type { Bot } from './bots.ts';

export interface GameSummary {
  seed: number;
  score: number;
  moves: number;
  /** true if stopped by maxMoves instead of game over */
  capped: boolean;
}

export function playGame(bot: Bot, seed: number, maxMoves = 20000, config: GameConfig = DEFAULT_CONFIG): GameSummary {
  let state = newGame(seed, config);
  while (!state.gameOver && state.moves < maxMoves) {
    const move = bot(state);
    if (!move) break;
    state = applyMove(state, move).state;
  }
  return { seed, score: state.score, moves: state.moves, capped: !state.gameOver };
}
