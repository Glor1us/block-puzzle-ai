// Bots: pick a move for the current state.
// greedy = look one placement ahead; search = beam search over all remaining tray pieces.

import {
  SIZE,
  canPlace,
  getPiece,
  legalMoves,
  nextRandom,
  placeOnBoard,
  placementPoints,
  type Board,
  type GameState,
  type Move,
  type Piece,
} from '../core/index.ts';
import { PROBE_PIECES, countEdges, countFilled, countHoles, countUnfit } from './features.ts';
import { TUNED_WEIGHTS } from './tuned-weights.ts';

export type Bot = (state: GameState) => Move | null;

export interface Weights {
  points: number;
  filled: number;
  holes: number;
  edges: number;
  /** probe shapes that no longer fit anywhere */
  probeUnfit: number;
  /** pieces still in the tray that no longer fit: usually means game over */
  trayUnfit: number;
}

// Hand-picked starting values (greedy v1).
export const DEFAULT_WEIGHTS: Weights = {
  points: 1,
  filled: -1,
  holes: -15,
  edges: -2,
  probeUnfit: -10,
  trayUnfit: -1000,
};

export { TUNED_WEIGHTS };

/** Heuristic value of a board, without the points earned getting there. */
export function boardValue(board: Board, rest: readonly Piece[], w: Weights): number {
  return (
    w.filled * countFilled(board) +
    w.holes * countHoles(board) +
    w.edges * countEdges(board) +
    w.probeUnfit * countUnfit(board, PROBE_PIECES) +
    w.trayUnfit * countUnfit(board, rest)
  );
}

function restOfTray(tray: readonly (string | null)[], usedSlot: number): Piece[] {
  const rest: Piece[] = [];
  tray.forEach((id, i) => {
    if (id !== null && i !== usedSlot) rest.push(getPiece(id));
  });
  return rest;
}

export function evaluateMove(state: GameState, move: Move, w: Weights = DEFAULT_WEIGHTS): number {
  const piece = getPiece(state.tray[move.slot]!);
  const res = placeOnBoard(state.board, piece, move.row, move.col);
  const streak = res.regions.length > 0 ? state.streak + 1 : 0;
  const points = placementPoints(
    state.config.scoring,
    piece.cells.length,
    res.placedCellsCleared,
    res.regions.length,
    streak,
  );
  return w.points * points + boardValue(res.board, restOfTray(state.tray, move.slot), w);
}

export function greedyBot(w: Weights = DEFAULT_WEIGHTS): Bot {
  return (state) => {
    let best: Move | null = null;
    let bestValue = -Infinity;
    for (const m of legalMoves(state)) {
      const v = evaluateMove(state, m, w);
      if (v > bestValue) {
        bestValue = v;
        best = m;
      }
    }
    return best;
  };
}

interface Node {
  board: Board;
  streak: number;
  points: number;
  /** tray slots still to place */
  slots: number[];
  first: Move;
  value: number;
}

/** FNV-1a over the board, to drop duplicate positions reached by different orders. */
function boardKey(board: Board, streak: number): number {
  let h = 0x811c9dc5 ^ streak;
  for (let i = 0; i < board.length; i++) h = Math.imul(h ^ board[i]!, 0x01000193);
  return h >>> 0;
}

/**
 * Beam search over the rest of the current tray: every order and position of the remaining pieces,
 * keeping the `beamWidth` best partial plans per level. Plays the first move of the best full plan.
 * Plans that cannot place every piece are only chosen when nothing else exists.
 */
export function searchBot(w: Weights = DEFAULT_WEIGHTS, beamWidth = 10): Bot {
  return (state) => {
    if (state.gameOver) return null;
    const cfg = state.config.scoring;
    const startSlots = state.tray.flatMap((id, i) => (id === null ? [] : [i]));

    let beam: Node[] = [
      { board: state.board, streak: state.streak, points: 0, slots: startSlots, first: null as unknown as Move, value: 0 },
    ];

    for (let depth = 0; depth < startSlots.length; depth++) {
      const children = new Map<number, Node>();
      for (const node of beam) {
        for (const slot of node.slots) {
          const piece = getPiece(state.tray[slot]!);
          const restSlots = node.slots.filter((s) => s !== slot);
          const rest = restSlots.map((s) => getPiece(state.tray[s]!));
          for (let row = 0; row <= SIZE - piece.height; row++) {
            for (let col = 0; col <= SIZE - piece.width; col++) {
              if (!canPlace(node.board, piece, row, col)) continue;
              const res = placeOnBoard(node.board, piece, row, col);
              const streak = res.regions.length > 0 ? node.streak + 1 : 0;
              const points =
                node.points +
                placementPoints(cfg, piece.cells.length, res.placedCellsCleared, res.regions.length, streak);
              const value = w.points * points + boardValue(res.board, rest, w);
              const key = boardKey(res.board, streak);
              const prev = children.get(key);
              if (!prev || prev.value < value) {
                children.set(key, {
                  board: res.board,
                  streak,
                  points,
                  slots: restSlots,
                  first: depth === 0 ? { slot, row, col } : node.first,
                  value,
                });
              }
            }
          }
        }
      }
      if (children.size === 0) break;
      beam = [...children.values()].sort((a, b) => b.value - a.value).slice(0, beamWidth);
    }

    // beam is sorted best-first and holds the deepest level reached. If no full plan exists,
    // this is the best partial one (the game is probably lost anyway).
    const best = beam[0]!;
    return best.slots.length < startSlots.length ? best.first : null;
  };
}

/** Baseline: uniformly random legal move (own seeded RNG, independent of the game's). */
export function randomBot(seed = 1): Bot {
  let rng = seed;
  return (state) => {
    const moves = legalMoves(state);
    if (moves.length === 0) return null;
    const [v, next] = nextRandom(rng);
    rng = next;
    return moves[Math.floor(v * moves.length)]!;
  };
}

export type BotName = 'random' | 'greedy' | 'greedy-tuned' | 'search' | 'search-tuned';
export const BOT_NAMES: readonly BotName[] = ['random', 'greedy', 'greedy-tuned', 'search', 'search-tuned'];

export function createBot(name: BotName, weights?: Weights): Bot {
  switch (name) {
    case 'random':
      return randomBot();
    case 'greedy':
      return greedyBot(weights ?? DEFAULT_WEIGHTS);
    case 'greedy-tuned':
      return greedyBot(weights ?? TUNED_WEIGHTS);
    case 'search':
      return searchBot(weights ?? DEFAULT_WEIGHTS);
    case 'search-tuned':
      return searchBot(weights ?? TUNED_WEIGHTS);
  }
}
