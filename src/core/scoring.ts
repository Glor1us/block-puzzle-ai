// Scoring rules. Every constant is configurable; defaults are documented in docs/RULES.md and pinned
// by the reference-position tests in tests/game.test.ts.

export interface ScoringConfig {
  /** Points per placed cell */
  cellPoint: number;
  /** If false, placed cells that get cleared by the same placement earn no cell points */
  countClearedCells: boolean;
  /** Points per cleared region (row, column or 3x3 box) */
  clearBase: number;
  /** Extra points per region beyond the first in one placement (combo) */
  comboBonus: number;
  /** Clear points are multiplied by 1 + streakStep * (streak - 1), streak = consecutive clearing placements */
  streakStep: number;
}

export const DEFAULT_SCORING: ScoringConfig = {
  cellPoint: 1,
  countClearedCells: false,
  clearBase: 18,
  comboBonus: 18,
  streakStep: 0.5,
};

/**
 * Points for one placement.
 * @param streak streak value after this placement (>= 1 if something was cleared)
 */
export function placementPoints(
  cfg: ScoringConfig,
  placedCells: number,
  placedCellsCleared: number,
  regions: number,
  streak: number,
): number {
  const scoredCells = cfg.countClearedCells ? placedCells : placedCells - placedCellsCleared;
  let points = scoredCells * cfg.cellPoint;
  if (regions > 0) {
    const clear = cfg.clearBase * regions + cfg.comboBonus * (regions - 1);
    points += Math.round(clear * (1 + cfg.streakStep * (streak - 1)));
  }
  return points;
}
