# Game rules and scoring model

This is the spec the engine in `src/core/` implements. All scoring constants live in `ScoringConfig`
(`src/core/scoring.ts`) and can be changed without touching the engine.

## Board and turns
- A 9×9 grid. It splits into **27 regions**: 9 rows, 9 columns and 9 boxes of 3×3.
- The tray holds **3 pieces**. They can be placed in any order. A new set of 3 is dealt only after all 3 are placed.
  Duplicate pieces in one tray are allowed.
- A piece may go anywhere it fits on empty cells. It doesn't have to touch other blocks.
- **Pieces never rotate.** Each orientation is a separate piece in the catalogue.
- After every placement, all completed regions clear **at the same time**. A cell shared by a cleared row and a
  cleared box is removed once. There is no gravity.
- **Game over:** none of the pieces left in the tray fits anywhere on the board.
- Pieces are drawn uniformly from the catalogue with a seeded PRNG, so a seed fully determines a game.

## Piece catalogue (43)
`#` = cell. "×4" = all four orientations are separate pieces.

```
dot        bars 2–5, vertical and horizontal (8)        O 2×2
#          #  #  #  #     ##  ###  ####  #####           ##
           #  #  #  #                                    ##
              #  #  #
                 #  #
                    #

diagonals of 2 and 3, both directions (4)
#.   .#   #..   ..#
.#   #.   .#.   .#.
          ..#   #..

corner3 ×4   L4 (3+1) ×4   L4 (2+2) ×4   T4 ×4   T5 ×4   corner5 ×4   S/Z (4)            plus
##           ###           ##            #.      ###     ###          .##  ##.  #.  .#   .#.
.#           ..#           .#            ##      .#.     ..#          ##.  .##  ##  ##   ###
                           .#            #.      .#.     ..#                    .#  #.   .#.
```

## Scoring model
For one placement of a piece with `n` cells that clears `r` regions:

```
cellPoints  = cellPoint × (n − cells of this piece removed by the clear)
clearPoints = (clearBase × r + comboBonus × (r − 1)) × (1 + streakStep × (streak − 1))     if r > 0
```

- **Combo:** several regions in one placement. Each region beyond the first adds `comboBonus`.
- **Streak:** the number of consecutive placements that cleared something. A placement without a clear resets it to 0.
- Cells of the placed piece that vanish in the same clear earn no cell points.

| Parameter | Default |
|---|---|
| `cellPoint` | 1 |
| `countClearedCells` | false |
| `clearBase` | 18 |
| `comboBonus` | 18 |
| `streakStep` | 0.5 |

### Worked example (pinned by `tests/game.test.ts`)
The streak counter is at 1. A single dot completes the center box: `0` cell points (the dot itself is cleared) +
`18 × 1.5 = 27`. Then a 3-cell corner and a 2-cell diagonal add `3 + 2`. Total for the turn: **+32**.
