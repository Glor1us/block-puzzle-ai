// Piece shapes. '#' = cell. Pieces never rotate, so every orientation is its own piece (43 in total).
// See docs/RULES.md for the full catalogue.

export interface Piece {
  id: string;
  /** [row, col] offsets from the top-left of the bounding box */
  cells: ReadonlyArray<readonly [number, number]>;
  height: number;
  width: number;
}

function piece(id: string, ...rows: string[]): Piece {
  const cells: [number, number][] = [];
  rows.forEach((line, r) => {
    [...line].forEach((ch, c) => {
      if (ch === '#') cells.push([r, c]);
    });
  });
  return {
    id,
    cells,
    height: rows.length,
    width: Math.max(...rows.map((l) => l.length)),
  };
}

export const PIECES: readonly Piece[] = [
  piece('dot', '#'),

  piece('I2v', '#', '#'),
  piece('I3v', '#', '#', '#'),
  piece('I4v', '#', '#', '#', '#'),
  piece('I5v', '#', '#', '#', '#', '#'),
  piece('I2h', '##'),
  piece('I3h', '###'),
  piece('I4h', '####'),
  piece('I5h', '#####'),

  piece('O', '##', '##'),

  piece('diag2a', '#.', '.#'),
  piece('diag2b', '.#', '#.'),
  piece('diag3a', '#..', '.#.', '..#'),
  piece('diag3b', '..#', '.#.', '#..'),

  piece('corner3a', '##', '.#'),
  piece('corner3b', '##', '#.'),
  piece('corner3c', '#.', '##'),
  piece('corner3d', '.#', '##'),

  // 3+1 L shapes
  piece('L4a', '###', '..#'),
  piece('L4b', '###', '#..'),
  piece('L4c', '#..', '###'),
  piece('L4d', '..#', '###'),
  // 2+2 tall L shapes
  piece('L4e', '##', '.#', '.#'),
  piece('L4f', '##', '#.', '#.'),
  piece('L4g', '#.', '#.', '##'),
  piece('L4h', '.#', '.#', '##'),

  piece('T4a', '#.', '##', '#.'),
  piece('T4b', '.#', '##', '.#'),
  piece('T4c', '###', '.#.'),
  piece('T4d', '.#.', '###'),

  piece('T5a', '###', '.#.', '.#.'),
  piece('T5b', '.#.', '.#.', '###'),
  piece('T5c', '#..', '###', '#..'),
  piece('T5d', '..#', '###', '..#'),

  piece('corner5a', '###', '..#', '..#'),
  piece('corner5b', '###', '#..', '#..'),
  piece('corner5c', '#..', '#..', '###'),
  piece('corner5d', '..#', '..#', '###'),

  piece('S4h', '.##', '##.'),
  piece('Z4h', '##.', '.##'),
  piece('S4v', '#.', '##', '.#'),
  piece('Z4v', '.#', '##', '#.'),


  piece('plus', '.#.', '###', '.#.'),
];

export const PIECE_BY_ID: ReadonlyMap<string, Piece> = new Map(PIECES.map((p) => [p.id, p]));

export function getPiece(id: string): Piece {
  const p = PIECE_BY_ID.get(id);
  if (!p) throw new Error(`Unknown piece: ${id}`);
  return p;
}
