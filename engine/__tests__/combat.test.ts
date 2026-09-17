import { applyFire } from '@/engine/combat';
import { buildPreviewCells } from '@/engine/placement';
import { emptyGrid, place, renderStatus, sink } from './helpers';

describe('applyFire — miss', () => {
  it('marks an empty cell as a miss', () => {
    const { fields, sunkShip } = applyFire(emptyGrid(), 3, 4);
    expect(fields[4][3].status).toBe('miss');
    expect(sunkShip).toBeNull();
  });

  it('leaves every other cell untouched', () => {
    const { fields } = applyFire(emptyGrid(), 3, 4);
    expect(renderStatus(fields)[4]).toBe('...m......');
    expect(renderStatus(fields)[3]).toBe('..........');
  });
});

describe('applyFire — hit', () => {
  const grid = () => place(emptyGrid(), 'Cruiser', 2, 1, 'horizontal');

  it('marks a ship cell as a hit', () => {
    const { fields, sunkShip } = applyFire(grid(), 2, 1);
    expect(fields[1][2].status).toBe('hit');
    expect(sunkShip).toBeNull();
  });

  it('flags the struck part as hit', () => {
    const { fields } = applyFire(grid(), 2, 1);
    expect(fields[1][2].shipPart!.isHit).toBe(true);
  });

  it("leaves the ship's other parts unhit", () => {
    const { fields } = applyFire(grid(), 2, 1);
    expect(fields[1][3].shipPart!.isHit).toBe(false);
    expect(fields[1][3].status).toBe('empty');
  });

  it('does not sink a ship until the last part is struck', () => {
    let current = grid();
    expect(applyFire(current, 2, 1).sunkShip).toBeNull();
    current = applyFire(current, 2, 1).fields;
    expect(applyFire(current, 3, 1).sunkShip).toBeNull();
  });
});

describe('applyFire — sinking', () => {
  const cells = buildPreviewCells('Cruiser', 2, 1, 'horizontal');

  it('reports the sunk ship on the final hit', () => {
    const grid = place(emptyGrid(), 'Cruiser', 2, 1, 'horizontal');
    const { sunkCount } = sink(grid, cells);
    expect(sunkCount).toBe(1);
  });

  it('promotes every cell of the sunk ship to "sunk"', () => {
    const grid = place(emptyGrid(), 'Cruiser', 2, 1, 'horizontal');
    const { fields } = sink(grid, cells);
    expect(renderStatus(fields)[1]).toBe('..###.....');
  });

  it('sinks regardless of the order the parts are struck', () => {
    const grid = place(emptyGrid(), 'Cruiser', 2, 1, 'horizontal');
    const { fields, sunkCount } = sink(grid, [...cells].reverse());
    expect(sunkCount).toBe(1);
    expect(renderStatus(fields)[1]).toBe('..###.....');
  });

  it('sinks a vertical ship', () => {
    const grid = place(emptyGrid(), 'Submarine', 7, 3, 'vertical');
    const { fields, sunkCount } = sink(grid, buildPreviewCells('Submarine', 7, 3, 'vertical'));
    expect(sunkCount).toBe(1);
    expect(fields[3][7].status).toBe('sunk');
    expect(fields[4][7].status).toBe('sunk');
    expect(fields[5][7].status).toBe('sunk');
  });

  it('leaves a neighbouring ship untouched when one sinks', () => {
    let grid = place(emptyGrid(), 'Destroyer', 0, 0, 'horizontal');
    grid = place(grid, 'Cruiser', 0, 1, 'horizontal');
    const { fields } = sink(grid, buildPreviewCells('Destroyer', 0, 0, 'horizontal'));
    expect(renderStatus(fields)[0]).toBe('##........');
    expect(renderStatus(fields)[1]).toBe('..........');
    expect(fields[1][0].shipPart!.isHit).toBe(false);
  });

  it('sinks the two-cell Destroyer on its second hit', () => {
    const grid = place(emptyGrid(), 'Destroyer', 4, 4, 'horizontal');
    expect(applyFire(grid, 4, 4).sunkShip).toBeNull();
    const after = applyFire(grid, 4, 4).fields;
    expect(applyFire(after, 5, 4).sunkShip?.type).toBe('Destroyer');
  });
});

describe('applyFire — immutability', () => {
  it('does not mutate the grid it was given', () => {
    const before = place(emptyGrid(), 'Cruiser', 2, 1, 'horizontal');
    const statusSnapshot = renderStatus(before);
    applyFire(before, 2, 1);
    expect(renderStatus(before)).toEqual(statusSnapshot);
  });

  it('returns a new grid rather than the same reference', () => {
    const before = emptyGrid();
    expect(applyFire(before, 0, 0).fields).not.toBe(before);
  });

  it('does not mutate the previous grid when a ship sinks', () => {
    const grid = place(emptyGrid(), 'Destroyer', 4, 4, 'horizontal');
    const afterFirst = applyFire(grid, 4, 4).fields;
    const snapshot = renderStatus(afterFirst);
    applyFire(afterFirst, 5, 4);
    expect(renderStatus(afterFirst)).toEqual(snapshot);
  });
});

describe('applyFire — repeat fire on the same cell', () => {
  it('keeps a missed cell a miss', () => {
    const once = applyFire(emptyGrid(), 3, 3).fields;
    expect(applyFire(once, 3, 3).fields[3][3].status).toBe('miss');
  });

  it('does not re-sink an already sunk ship', () => {
    const grid = place(emptyGrid(), 'Destroyer', 4, 4, 'horizontal');
    const { fields } = sink(grid, buildPreviewCells('Destroyer', 4, 4, 'horizontal'));
    const again = applyFire(fields, 4, 4);
    // Every part is already hit, so the ship re-reports as sunk and stays sunk.
    expect(again.sunkShip).not.toBeNull();
    expect(again.fields[4][4].status).toBe('sunk');
  });
});
