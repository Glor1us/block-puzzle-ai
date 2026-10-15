import { describe, expect, it } from 'vitest';
import {
  PIECES,
  REGIONS,
  applyMove,
  boardToString,
  canPlace,
  emptyBoard,
  getPiece,
  legalMoves,
  newGame,
  parseBoard,
  placeOnBoard,
  stateFrom,
  type GameState,
  type Move,
} from '../src/core/index.ts';

function play(state: GameState, moves: Move[]): GameState {
  for (const m of moves) state = applyMove(state, m).state;
  return state;
}

describe('pieces', () => {
  it('have unique ids and sane shapes', () => {
    expect(new Set(PIECES.map((p) => p.id)).size).toBe(PIECES.length);
    for (const p of PIECES) {
      expect(p.cells.length).toBeGreaterThan(0);
      for (const [r, c] of p.cells) {
        expect(r).toBeLessThan(p.height);
        expect(c).toBeLessThan(p.width);
      }
    }
    expect(getPiece('corner5a').cells).toEqual([[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]]);
  });
});

describe('board', () => {
  it('has 27 regions of 9 cells', () => {
    expect(REGIONS).toHaveLength(27);
    for (const r of REGIONS) expect(new Set(r).size).toBe(9);
  });

  it('rejects out-of-bounds and overlapping placements', () => {
    const b = emptyBoard();
    const i5h = getPiece('I5h');
    expect(canPlace(b, i5h, 0, 4)).toBe(true);
    expect(canPlace(b, i5h, 0, 5)).toBe(false);
    expect(canPlace(b, i5h, -1, 0)).toBe(false);
    b[4] = 1;
    expect(canPlace(b, i5h, 0, 0)).toBe(false);
    expect(canPlace(b, getPiece('diag2a'), 0, 3)).toBe(true); // diag cells skip (0,4)
  });

  it('clears a row, a column and a box at once; shared cells clear once', () => {
    // Filling (4,4) completes row 4, column 4 and the center box.
    const b = parseBoard([
      '....#....',
      '....#....',
      '....#....',
      '...###...',
      '####.####',
      '...###...',
      '....#....',
      '....#....',
      '....#....',
    ]);
    const res = placeOnBoard(b, getPiece('dot'), 4, 4);
    expect(res.regions.sort((a, z) => a - z)).toEqual([4, 13, 22]);
    expect(res.placedCellsCleared).toBe(1);
    expect([...res.board].every((v) => v === 0)).toBe(true);
  });
});

describe('game flow', () => {
  it('is deterministic for a seed', () => {
    expect(newGame(42).tray).toEqual(newGame(42).tray);
  });

  it('refills the tray only after all 3 pieces are placed', () => {
    let s = stateFrom(emptyBoard(), ['dot', 'dot', 'dot']);
    s = play(s, [{ slot: 0, row: 0, col: 0 }]);
    expect(s.tray).toEqual([null, 'dot', 'dot']);
    s = play(s, [{ slot: 1, row: 0, col: 2 }]);
    expect(s.tray).toEqual([null, null, 'dot']);
    s = play(s, [{ slot: 2, row: 0, col: 4 }]);
    expect(s.tray.every((t) => t !== null)).toBe(true);
    expect(s.score).toBe(3);
  });

  it('lists every legal move', () => {
    const s = stateFrom(emptyBoard(), ['dot', null, 'I5h']);
    expect(legalMoves(s)).toHaveLength(81 + 9 * 5);
  });

  it('ends the game when no tray piece fits', () => {
    // Only single holes left, all isolated so no clear happens; I2v cannot fit.
    const b = parseBoard([
      '.#.#.#.#.',
      '#########',
      '.#.#.#.#.',
      '#########',
      '.#.#.#.#.',
      '#########',
      '.#.#.#.#.',
      '#########',
      '.#.#.#.#.',
    ]);
    expect(stateFrom(b, ['I2v', null, null]).gameOver).toBe(true);
    expect(stateFrom(b, ['I2v', 'dot', null]).gameOver).toBe(false);
  });

  it('tracks streak and resets it on a non-clearing placement', () => {
    const b = parseBoard([
      '########.',
      '########.',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
    ]);
    let s = stateFrom(b, ['dot', 'dot', 'dot']);
    let r = applyMove(s, { slot: 0, row: 0, col: 8 });
    expect(r.result.streak).toBe(1);
    expect(r.result.points).toBe(18); // dot cleared with the row → no cell point
    r = applyMove(r.state, { slot: 1, row: 1, col: 8 });
    expect(r.result.streak).toBe(2);
    expect(r.result.points).toBe(27); // 18 * 1.5
    r = applyMove(r.state, { slot: 2, row: 5, col: 5 });
    expect(r.result.streak).toBe(0);
    expect(r.result.points).toBe(1);
  });

  it('gives a combo bonus for several regions in one placement', () => {
    const b = parseBoard([
      '........#',
      '........#',
      '........#',
      '........#',
      '........#',
      '........#',
      '........#',
      '........#',
      '########.',
    ]);
    const r = applyMove(stateFrom(b, ['dot', 'dot', 'dot']), { slot: 0, row: 8, col: 8 });
    expect(r.result.regions).toHaveLength(2);
    expect(r.result.points).toBe(18 * 2 + 18);
  });
});

// Reference positions: full three-piece turns whose resulting board and score change are known.
// They pin the default scoring model (cell points, clear bonus, streak multiplier) end to end.
describe('reference positions', () => {
  it('331 → 363: box cleared on a streak', () => {
    const before = parseBoard([
      '.##....##',
      '.......##',
      '###....#.',
      '..####.##',
      '..####...',
      '...##..#.',
      '..###....',
      '..##.....',
      '..#......',
    ]);
    const s = play(stateFrom(before, ['corner3a', 'dot', 'diag2a'], { score: 331, streak: 1 }), [
      { slot: 1, row: 5, col: 5 },
      { slot: 0, row: 4, col: 7 },
      { slot: 2, row: 4, col: 1 },
    ]);
    expect(s.score).toBe(363);
    expect(boardToString(s.board)).toBe(
      ['.##....##', '.......##', '###....#.', '..#....##', '.##....##', '..#....##', '..###....', '..##.....', '..#......'].join('\n'),
    );
  });

  it('363 → 390: column cleared, no streak', () => {
    const before = parseBoard([
      '.##....##',
      '.......##',
      '###....#.',
      '..#....##',
      '.##....##',
      '..#....##',
      '..###....',
      '..##.....',
      '..#......',
    ]);
    const s = play(stateFrom(before, ['corner5a', 'dot', 'T4a'], { score: 363 }), [
      { slot: 2, row: 4, col: 0 },
      { slot: 1, row: 2, col: 8 },
      { slot: 0, row: 1, col: 1 },
    ]);
    expect(s.score).toBe(390);
    expect(boardToString(s.board)).toBe(
      ['.#.....##', '.#.#...##', '##.#...##', '...#...##', '##.....##', '##.....##', '#..##....', '...#.....', '.........'].join('\n'),
    );
  });
});
