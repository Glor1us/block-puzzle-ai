import { describe, expect, it } from 'vitest';
import { emptyBoard, legalMoves, parseBoard, stateFrom } from '../src/core/index.ts';
import { countEdges, countHoles } from '../src/ai/features.ts';
import { greedyBot, randomBot, searchBot } from '../src/ai/bots.ts';
import { playGame } from '../src/ai/play.ts';

describe('features', () => {
  it('counts holes and edges', () => {
    expect(countHoles(emptyBoard())).toBe(0);
    expect(countEdges(emptyBoard())).toBe(4 * 9); // every border cell touches a wall
    const b = parseBoard([
      '.#.......',
      '#........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
    ]);
    expect(countHoles(b)).toBe(1); // corner (0,0)
  });
});

describe('greedy bot', () => {
  it('takes the clear when one is available', () => {
    const b = parseBoard([
      '########.',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
    ]);
    expect(greedyBot()(stateFrom(b, ['dot', null, null]))).toEqual({ slot: 0, row: 0, col: 8 });
  });

  it('keeps room for the rest of the tray', () => {
    // Only a 1x5 gap fits I5h; the dot must not go there.
    const b = parseBoard([
      '####.....',
      '#########',
      '#########',
      '#########',
      '#########',
      '#########',
      '#########',
      '#########',
      '########.',
    ]);
    const move = greedyBot()(stateFrom(b, ['dot', 'I5h', null]))!;
    expect(move.slot === 1 || move.row !== 0).toBe(true);
  });

  it('search bot outlives greedy on the first seeds', () => {
    // Greedy dies within 60 moves on seeds 1-3; search should reach the 150-move cap.
    for (const seed of [1, 2, 3]) {
      expect(playGame(greedyBot(), seed).moves).toBeLessThan(60);
      expect(playGame(searchBot(), seed, 150).moves).toBe(150);
    }
  }, 60_000);

  it('search bot only returns legal moves and null when stuck', () => {
    const s = stateFrom(emptyBoard(), ['plus', 'I5h', 'diag3a']);
    const m = searchBot()(s)!;
    expect(legalMoves(s)).toContainEqual(m);
    const full = parseBoard(Array(9).fill('#########'));
    expect(searchBot()(stateFrom(full, ['dot', null, null]))).toBeNull();
  });

  it('beats the random bot', () => {
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const mean = (bot: ReturnType<typeof greedyBot>) =>
      seeds.reduce((s, seed) => s + playGame(bot, seed).score, 0) / seeds.length;
    expect(mean(greedyBot())).toBeGreaterThan(3 * mean(randomBot()));
  });
});
