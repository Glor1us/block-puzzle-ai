// Board operations and game state. States are immutable: applyMove returns a new state.

import { PIECES, getPiece, type Piece } from './pieces.ts';
import { nextRandom } from './rng.ts';
import { DEFAULT_SCORING, placementPoints, type ScoringConfig } from './scoring.ts';

export const SIZE = 9;
export const TRAY_SIZE = 3;

/** 81 cells, row-major, 1 = filled */
export type Board = Uint8Array;

/** 27 regions: rows 0-8, columns 9-17, boxes 18-26 (box index = 3 * boxRow + boxCol) */
export const REGIONS: readonly (readonly number[])[] = (() => {
  const regions: number[][] = [];
  for (let r = 0; r < SIZE; r++) regions.push([...Array(SIZE)].map((_, c) => r * SIZE + c));
  for (let c = 0; c < SIZE; c++) regions.push([...Array(SIZE)].map((_, r) => r * SIZE + c));
  for (let b = 0; b < SIZE; b++) {
    const r0 = Math.floor(b / 3) * 3;
    const c0 = (b % 3) * 3;
    regions.push([...Array(SIZE)].map((_, i) => (r0 + Math.floor(i / 3)) * SIZE + c0 + (i % 3)));
  }
  return regions;
})();

export function emptyBoard(): Board {
  return new Uint8Array(SIZE * SIZE);
}

export function canPlace(board: Board, piece: Piece, row: number, col: number): boolean {
  if (row < 0 || col < 0 || row + piece.height > SIZE || col + piece.width > SIZE) return false;
  for (const [dr, dc] of piece.cells) {
    if (board[(row + dr) * SIZE + col + dc]) return false;
  }
  return true;
}

export function fitsAnywhere(board: Board, piece: Piece): boolean {
  for (let r = 0; r <= SIZE - piece.height; r++) {
    for (let c = 0; c <= SIZE - piece.width; c++) {
      if (canPlace(board, piece, r, c)) return true;
    }
  }
  return false;
}

export interface PlaceResult {
  board: Board;
  /** indices into REGIONS that were cleared */
  regions: number[];
  /** how many of the placed cells were removed by the clear */
  placedCellsCleared: number;
}

/** Places a piece (caller must check canPlace) and clears all completed regions at once. */
export function placeOnBoard(board: Board, piece: Piece, row: number, col: number): PlaceResult {
  const next = board.slice();
  const placed = piece.cells.map(([dr, dc]) => (row + dr) * SIZE + col + dc);
  for (const i of placed) next[i] = 1;

  const regions: number[] = [];
  REGIONS.forEach((cells, idx) => {
    if (cells.every((i) => next[i])) regions.push(idx);
  });
  for (const idx of regions) for (const i of REGIONS[idx]!) next[i] = 0;

  const placedCellsCleared = placed.filter((i) => !next[i]).length;
  return { board: next, regions, placedCellsCleared };
}

export interface GameConfig {
  scoring: ScoringConfig;
  /** pieces the generator draws from, uniformly */
  pieces: readonly Piece[];
}

export const DEFAULT_CONFIG: GameConfig = { scoring: DEFAULT_SCORING, pieces: PIECES };

export interface GameState {
  config: GameConfig;
  board: Board;
  /** piece ids; null = slot already used */
  tray: (string | null)[];
  score: number;
  /** consecutive placements that cleared something */
  streak: number;
  moves: number;
  rng: number;
  gameOver: boolean;
}

export interface Move {
  slot: number;
  row: number;
  col: number;
}

export interface MoveResult {
  points: number;
  regions: number[];
  streak: number;
}

function dealTray(rng: number, pieces: readonly Piece[]): [tray: string[], rng: number] {
  const tray: string[] = [];
  for (let i = 0; i < TRAY_SIZE; i++) {
    const [v, next] = nextRandom(rng);
    rng = next;
    tray.push(pieces[Math.floor(v * pieces.length)]!.id);
  }
  return [tray, rng];
}

function isStuck(board: Board, tray: (string | null)[]): boolean {
  return tray.every((id) => id === null || !fitsAnywhere(board, getPiece(id)));
}

export function newGame(seed: number, config: GameConfig = DEFAULT_CONFIG): GameState {
  const [tray, rng] = dealTray(seed, config.pieces);
  const board = emptyBoard();
  return { config, board, tray, score: 0, streak: 0, moves: 0, rng, gameOver: isStuck(board, tray) };
}

/** Builds a state from an explicit position (tests, puzzles, reading a real game). */
export function stateFrom(
  board: Board,
  tray: (string | null)[],
  opts: Partial<Pick<GameState, 'score' | 'streak' | 'rng' | 'config'>> = {},
): GameState {
  return {
    config: opts.config ?? DEFAULT_CONFIG,
    board,
    tray,
    score: opts.score ?? 0,
    streak: opts.streak ?? 0,
    moves: 0,
    rng: opts.rng ?? 1,
    gameOver: isStuck(board, tray),
  };
}

export function legalMoves(state: GameState): Move[] {
  const moves: Move[] = [];
  if (state.gameOver) return moves;
  state.tray.forEach((id, slot) => {
    if (id === null) return;
    const piece = getPiece(id);
    for (let row = 0; row <= SIZE - piece.height; row++) {
      for (let col = 0; col <= SIZE - piece.width; col++) {
        if (canPlace(state.board, piece, row, col)) moves.push({ slot, row, col });
      }
    }
  });
  return moves;
}

export function applyMove(state: GameState, move: Move): { state: GameState; result: MoveResult } {
  if (state.gameOver) throw new Error('Game is over');
  const id = state.tray[move.slot];
  if (id == null) throw new Error(`Empty tray slot ${move.slot}`);
  const piece = getPiece(id);
  if (!canPlace(state.board, piece, move.row, move.col)) {
    throw new Error(`Illegal move: ${id} at ${move.row},${move.col}`);
  }

  const placed = placeOnBoard(state.board, piece, move.row, move.col);
  const streak = placed.regions.length > 0 ? state.streak + 1 : 0;
  const points = placementPoints(
    state.config.scoring,
    piece.cells.length,
    placed.placedCellsCleared,
    placed.regions.length,
    streak,
  );

  let tray = state.tray.map((t, i) => (i === move.slot ? null : t));
  let rng = state.rng;
  if (tray.every((t) => t === null)) [tray, rng] = dealTray(rng, state.config.pieces);

  const next: GameState = {
    ...state,
    board: placed.board,
    tray,
    score: state.score + points,
    streak,
    moves: state.moves + 1,
    rng,
    gameOver: isStuck(placed.board, tray),
  };
  return { state: next, result: { points, regions: placed.regions, streak } };
}

/** Board from 9 strings of '#' (filled) and '.' (empty). */
export function parseBoard(rows: string[]): Board {
  if (rows.length !== SIZE || rows.some((r) => r.length !== SIZE)) throw new Error('Board must be 9x9');
  const board = emptyBoard();
  rows.forEach((line, r) => [...line].forEach((ch, c) => (board[r * SIZE + c] = ch === '#' ? 1 : 0)));
  return board;
}

export function boardToString(board: Board): string {
  const lines: string[] = [];
  for (let r = 0; r < SIZE; r++) {
    lines.push([...board.subarray(r * SIZE, r * SIZE + SIZE)].map((v) => (v ? '#' : '.')).join(''));
  }
  return lines.join('\n');
}
