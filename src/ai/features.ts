// Board features for the heuristic. Walls count as filled: an empty cell next to the edge is "covered" there.

import { SIZE, fitsAnywhere, getPiece, type Board, type Piece } from '../core/index.ts';

/** Empty cells whose 4 neighbours are all filled or wall: only a dot can use them. */
export function countHoles(board: Board): number {
  let holes = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r * SIZE + c]) continue;
      const up = r === 0 || board[(r - 1) * SIZE + c];
      const down = r === SIZE - 1 || board[(r + 1) * SIZE + c];
      const left = c === 0 || board[r * SIZE + c - 1];
      const right = c === SIZE - 1 || board[r * SIZE + c + 1];
      if (up && down && left && right) holes++;
    }
  }
  return holes;
}

/** Number of filled/empty borders between neighbouring cells (walls = filled). Lower = smoother board. */
export function countEdges(board: Board): number {
  let edges = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = board[r * SIZE + c];
      const right = c === SIZE - 1 ? 1 : board[r * SIZE + c + 1];
      const down = r === SIZE - 1 ? 1 : board[(r + 1) * SIZE + c];
      if (v !== right) edges++;
      if (v !== down) edges++;
      if (c === 0 && !v) edges++;
      if (r === 0 && !v) edges++;
    }
  }
  return edges;
}

export function countFilled(board: Board): number {
  let n = 0;
  for (let i = 0; i < board.length; i++) n += board[i]!;
  return n;
}

/** Big awkward shapes: if they still fit, the board has room for whatever comes next. */
export const PROBE_PIECES: readonly Piece[] = ['I5h', 'I5v', 'O', 'corner5a', 'corner5d', 'T5a', 'plus'].map(getPiece);

export function countUnfit(board: Board, pieces: readonly Piece[]): number {
  let n = 0;
  for (const p of pieces) if (!fitsAnywhere(board, p)) n++;
  return n;
}
