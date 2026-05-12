import type { Field } from '@/models/types';

export function pickAiTarget(fields: Field[][]): { x: number; y: number } | null {
  const activeHits = getActiveHits(fields);

  if (activeHits.length > 0) {
    const candidates = targetModeCandidates(fields, activeHits);
    if (candidates.length > 0) return pick(candidates);
  }

  // Hunt mode: checkerboard parity — every ship spans ≥2 cells so this grid always covers it
  const huntCells: { x: number; y: number }[] = [];
  for (const row of fields) {
    for (const f of row) {
      if (f.status === 'empty' && (f.x + f.y) % 2 === 0) huntCells.push({ x: f.x, y: f.y });
    }
  }
  if (huntCells.length > 0) return pick(huntCells);

  // Fallback: any empty cell (when checkerboard is exhausted)
  const empty: { x: number; y: number }[] = [];
  for (const row of fields) {
    for (const f of row) {
      if (f.status === 'empty') empty.push({ x: f.x, y: f.y });
    }
  }
  return empty.length > 0 ? pick(empty) : null;
}

function getActiveHits(fields: Field[][]): { x: number; y: number }[] {
  const hits: { x: number; y: number }[] = [];
  for (const row of fields) {
    for (const f of row) {
      if (f.status === 'hit') hits.push({ x: f.x, y: f.y });
    }
  }
  return hits;
}

function targetModeCandidates(
  fields: Field[][],
  hits: { x: number; y: number }[],
): { x: number; y: number }[] {
  const rows = fields.length;
  const cols = fields[0].length;

  // With 2+ collinear hits, extend along that axis first
  if (hits.length >= 2) {
    const allSameRow = hits.every(h => h.y === hits[0].y);
    const allSameCol = hits.every(h => h.x === hits[0].x);

    if (allSameRow) {
      const y = hits[0].y;
      const xs = hits.map(h => h.x).sort((a, b) => a - b);
      const candidates = emptyAt(
        fields,
        [
          { x: xs[0] - 1, y },
          { x: xs[xs.length - 1] + 1, y },
        ],
        rows,
        cols,
      );
      if (candidates.length > 0) return candidates;
    }

    if (allSameCol) {
      const x = hits[0].x;
      const ys = hits.map(h => h.y).sort((a, b) => a - b);
      const candidates = emptyAt(
        fields,
        [
          { x, y: ys[0] - 1 },
          { x, y: ys[ys.length - 1] + 1 },
        ],
        rows,
        cols,
      );
      if (candidates.length > 0) return candidates;
    }
  }

  // Single hit or no clear axis: all four neighbours
  const seen = new Set<string>();
  const candidates: { x: number; y: number }[] = [];
  for (const { x, y } of hits) {
    for (const [dx, dy] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (ny >= 0 && ny < rows && nx >= 0 && nx < cols && fields[ny][nx].status === 'empty') {
        candidates.push({ x: nx, y: ny });
      }
    }
  }
  return candidates;
}

function emptyAt(
  fields: Field[][],
  cells: { x: number; y: number }[],
  rows: number,
  cols: number,
): { x: number; y: number }[] {
  return cells.filter(
    ({ x, y }) => x >= 0 && x < cols && y >= 0 && y < rows && fields[y][x].status === 'empty',
  );
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
