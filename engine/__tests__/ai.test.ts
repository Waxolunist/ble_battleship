import { pickAiTarget } from '@/engine/ai';
import { GRID_SIZE } from '@/models/types';
import { emptyGrid } from './helpers';
import type { Field } from '@/models/types';

/** Build a grid from a picture: '.' empty, 'X' hit, 'm' miss, '#' sunk. */
function gridFrom(rows: string[]): Field[][] {
  const status = { '.': 'empty', X: 'hit', m: 'miss', '#': 'sunk' } as const;
  const base = emptyGrid();
  return base.map((row, y) =>
    row.map((f, x) => ({ ...f, status: status[rows[y][x] as keyof typeof status] })),
  );
}

/** Every distinct target the AI picks across many runs, for a fixed grid. */
function targetsOver(fields: Field[][], runs = 400): Set<string> {
  const seen = new Set<string>();
  for (let i = 0; i < runs; i++) {
    const t = pickAiTarget(fields);
    if (t) seen.add(`${t.x},${t.y}`);
  }
  return seen;
}

const BLANK = Array.from({ length: GRID_SIZE }, () => '.'.repeat(GRID_SIZE));

describe('pickAiTarget — hunt mode', () => {
  it('only ever targets checkerboard cells on an untouched grid', () => {
    for (const key of targetsOver(emptyGrid())) {
      const [x, y] = key.split(',').map(Number);
      expect((x + y) % 2).toBe(0);
    }
  });

  it('never targets a cell that is already resolved', () => {
    const rows = [...BLANK];
    rows[0] = 'mmmmmmmmmm';
    const fields = gridFrom(rows);
    for (const key of targetsOver(fields)) {
      expect(key.endsWith(',0')).toBe(false);
    }
  });

  it('falls back to odd-parity cells once the checkerboard is exhausted', () => {
    // Resolve every even-parity cell; only odd-parity cells remain.
    const fields = emptyGrid().map(row =>
      row.map(f => ({
        ...f,
        status: ((f.x + f.y) % 2 === 0 ? 'miss' : 'empty') as Field['status'],
      })),
    );
    const targets = targetsOver(fields, 100);
    expect(targets.size).toBeGreaterThan(0);
    for (const key of targets) {
      const [x, y] = key.split(',').map(Number);
      expect((x + y) % 2).toBe(1);
    }
  });

  it('returns null when the whole grid is resolved', () => {
    const fields = emptyGrid().map(row => row.map(f => ({ ...f, status: 'miss' as const })));
    expect(pickAiTarget(fields)).toBeNull();
  });

  it('ignores sunk cells as targets', () => {
    const fields = emptyGrid().map(row => row.map(f => ({ ...f, status: 'sunk' as const })));
    expect(pickAiTarget(fields)).toBeNull();
  });
});

describe('pickAiTarget — target mode around a single hit', () => {
  it('fires at one of the four neighbours of a lone hit', () => {
    const rows = [...BLANK];
    rows[5] = '.....X....';
    const targets = targetsOver(gridFrom(rows));
    expect([...targets].sort()).toEqual(['4,5', '5,4', '5,6', '6,5'].sort());
  });

  it('does not walk off the edge next to a corner hit', () => {
    const rows = [...BLANK];
    rows[0] = 'X.........';
    const targets = targetsOver(gridFrom(rows));
    expect([...targets].sort()).toEqual(['0,1', '1,0'].sort());
  });

  it('skips neighbours that are already resolved', () => {
    const rows = [...BLANK];
    rows[4] = '.....m....';
    rows[5] = '....mX....';
    const targets = targetsOver(gridFrom(rows));
    expect([...targets].sort()).toEqual(['5,6', '6,5'].sort());
  });
});

describe('pickAiTarget — target mode along a run of hits', () => {
  it('extends a horizontal run at either end, not sideways', () => {
    const rows = [...BLANK];
    rows[5] = '...XX.....';
    const targets = targetsOver(gridFrom(rows));
    expect([...targets].sort()).toEqual(['2,5', '5,5'].sort());
  });

  it('extends a vertical run at either end, not sideways', () => {
    const rows = [...BLANK];
    rows[3] = '.....X....';
    rows[4] = '.....X....';
    const targets = targetsOver(gridFrom(rows));
    expect([...targets].sort()).toEqual(['5,2', '5,5'].sort());
  });

  it('extends only the open end when one end is blocked', () => {
    const rows = [...BLANK];
    rows[5] = '..mXX.....';
    const targets = targetsOver(gridFrom(rows));
    expect([...targets]).toEqual(['5,5']);
  });

  it('extends a run pinned against the left edge', () => {
    const rows = [...BLANK];
    rows[5] = 'XX........';
    const targets = targetsOver(gridFrom(rows));
    expect([...targets]).toEqual(['2,5']);
  });

  it('falls back to neighbours when both ends of the run are blocked', () => {
    const rows = [...BLANK];
    rows[5] = '..mXXm....';
    const targets = targetsOver(gridFrom(rows));
    // No axial extension available, so it probes above and below the hits.
    expect([...targets].sort()).toEqual(['3,4', '3,6', '4,4', '4,6'].sort());
  });

  it('prefers finishing a wounded ship over hunting', () => {
    const rows = [...BLANK];
    rows[5] = '.....X....';
    const targets = targetsOver(gridFrom(rows));
    expect(targets.size).toBeLessThanOrEqual(4);
  });
});

describe('pickAiTarget — determinism under a stubbed RNG', () => {
  const origRandom = Math.random;
  afterEach(() => {
    Math.random = origRandom;
  });

  it('picks the first candidate when random returns 0', () => {
    Math.random = () => 0;
    expect(pickAiTarget(emptyGrid())).toEqual({ x: 0, y: 0 });
  });

  it('picks the last candidate when random returns just under 1', () => {
    Math.random = () => 0.999999;
    expect(pickAiTarget(emptyGrid())).toEqual({ x: GRID_SIZE - 1, y: GRID_SIZE - 1 });
  });
});
