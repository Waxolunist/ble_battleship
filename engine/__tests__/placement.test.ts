import {
  buildPreviewCells,
  isValidPlacement,
  placeShip,
  tryRandomPlacement,
} from '@/engine/placement';
import { GRID_SIZE, SHIP_FLEET, SHIP_SIZES } from '@/models/types';
import { emptyGrid, place, renderShips } from './helpers';

describe('buildPreviewCells', () => {
  it('lays a horizontal ship out along +x', () => {
    expect(buildPreviewCells('Destroyer', 3, 4, 'horizontal')).toEqual([
      { x: 3, y: 4 },
      { x: 4, y: 4 },
    ]);
  });

  it('lays a vertical ship out along +y', () => {
    expect(buildPreviewCells('Cruiser', 3, 4, 'vertical')).toEqual([
      { x: 3, y: 4 },
      { x: 3, y: 5 },
      { x: 3, y: 6 },
    ]);
  });

  it('produces one cell per ship size', () => {
    for (const shipType of SHIP_FLEET) {
      expect(buildPreviewCells(shipType, 0, 0, 'horizontal')).toHaveLength(SHIP_SIZES[shipType]);
    }
  });
});

describe('isValidPlacement', () => {
  it('accepts a ship fully inside the grid', () => {
    expect(isValidPlacement(buildPreviewCells('Carrier', 0, 0, 'horizontal'), emptyGrid())).toBe(
      true,
    );
  });

  it('rejects a ship running off the right edge', () => {
    const cells = buildPreviewCells('Carrier', GRID_SIZE - 4, 0, 'horizontal');
    expect(isValidPlacement(cells, emptyGrid())).toBe(false);
  });

  it('rejects a ship running off the bottom edge', () => {
    const cells = buildPreviewCells('Carrier', 0, GRID_SIZE - 4, 'vertical');
    expect(isValidPlacement(cells, emptyGrid())).toBe(false);
  });

  it('rejects negative origins', () => {
    expect(isValidPlacement([{ x: -1, y: 0 }], emptyGrid())).toBe(false);
    expect(isValidPlacement([{ x: 0, y: -1 }], emptyGrid())).toBe(false);
  });

  it('accepts a ship touching the last legal cell', () => {
    const cells = buildPreviewCells('Destroyer', GRID_SIZE - 2, GRID_SIZE - 1, 'horizontal');
    expect(isValidPlacement(cells, emptyGrid())).toBe(true);
  });

  it('rejects overlap with an existing ship', () => {
    const grid = place(emptyGrid(), 'Destroyer', 5, 5, 'horizontal');
    expect(isValidPlacement(buildPreviewCells('Cruiser', 5, 5, 'vertical'), grid)).toBe(false);
  });

  it('allows a ship to overlap itself when excludeShipId matches', () => {
    const grid = place(emptyGrid(), 'Destroyer', 5, 5, 'horizontal');
    const shipId = grid[5][5].shipPart!.ship.id;
    const cells = buildPreviewCells('Destroyer', 5, 5, 'vertical');
    expect(isValidPlacement(cells, grid)).toBe(false);
    expect(isValidPlacement(cells, grid, shipId)).toBe(true);
  });

  it('still rejects an excluded ship that leaves the grid', () => {
    const grid = place(emptyGrid(), 'Destroyer', 5, 5, 'horizontal');
    const shipId = grid[5][5].shipPart!.ship.id;
    expect(
      isValidPlacement(
        [
          { x: 5, y: 5 },
          { x: 10, y: 5 },
        ],
        grid,
        shipId,
      ),
    ).toBe(false);
  });

  it('allows adjacent ships (this game permits touching hulls)', () => {
    const grid = place(emptyGrid(), 'Destroyer', 5, 5, 'horizontal');
    expect(isValidPlacement(buildPreviewCells('Cruiser', 5, 6, 'horizontal'), grid)).toBe(true);
  });
});

describe('placeShip', () => {
  it('marks exactly the ship cells and leaves the rest empty', () => {
    const grid = place(emptyGrid(), 'Cruiser', 2, 1, 'horizontal');
    expect(renderShips(grid)[1]).toBe('..SSS.....');
    expect(renderShips(grid)[0]).toBe('..........');
  });

  it('does not mutate the input grid', () => {
    const before = emptyGrid();
    const snapshot = renderShips(before);
    place(before, 'Cruiser', 2, 1, 'horizontal');
    expect(renderShips(before)).toEqual(snapshot);
  });

  it('links every part back to one shared ship object', () => {
    const grid = place(emptyGrid(), 'Cruiser', 2, 1, 'horizontal');
    const ship = grid[1][2].shipPart!.ship;
    expect(ship.parts).toHaveLength(3);
    expect(grid[1][3].shipPart!.ship).toBe(ship);
    expect(grid[1][4].shipPart!.ship).toBe(ship);
  });

  it('records the orientation and type on the ship', () => {
    const grid = place(emptyGrid(), 'Submarine', 0, 0, 'vertical');
    const ship = grid[0][0].shipPart!.ship;
    expect(ship.type).toBe('Submarine');
    expect(ship.orientation).toBe('vertical');
  });

  it('starts every part unhit', () => {
    const grid = place(emptyGrid(), 'Battleship', 0, 0, 'horizontal');
    expect(grid[0][0].shipPart!.ship.parts.every(p => !p.isHit)).toBe(true);
  });
});

describe('tryRandomPlacement', () => {
  const origRandom = Math.random;
  afterEach(() => {
    Math.random = origRandom;
  });

  it('places the whole fleet without overlap', () => {
    for (let seed = 0; seed < 50; seed++) {
      const result = tryRandomPlacement(emptyGrid());
      expect(result).not.toBeNull();
      const occupied = result!.fields.flat().filter(f => f.shipPart);
      const totalCells = SHIP_FLEET.reduce((sum, s) => sum + SHIP_SIZES[s], 0);
      expect(occupied).toHaveLength(totalCells);
    }
  });

  it('returns an orientation for every ship in the fleet', () => {
    const result = tryRandomPlacement(emptyGrid())!;
    expect(Object.keys(result.orientations).sort()).toEqual([...SHIP_FLEET].sort());
  });

  it('keeps every ship inside the grid', () => {
    for (let seed = 0; seed < 20; seed++) {
      const result = tryRandomPlacement(emptyGrid())!;
      for (const row of result.fields) {
        for (const f of row) {
          if (!f.shipPart) continue;
          expect(f.x).toBeGreaterThanOrEqual(0);
          expect(f.x).toBeLessThan(GRID_SIZE);
          expect(f.y).toBeGreaterThanOrEqual(0);
          expect(f.y).toBeLessThan(GRID_SIZE);
        }
      }
    }
  });

  it('returns null when no legal square remains for a ship', () => {
    // Fill the board so the first ship has nowhere to go.
    let grid = emptyGrid();
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x += 2) {
        grid = placeShip(
          grid,
          'Destroyer',
          [
            { x, y },
            { x: x + 1, y },
          ],
          'horizontal',
        );
      }
    }
    expect(tryRandomPlacement(grid)).toBeNull();
  });

  it('does not mutate the grid it was given', () => {
    const before = emptyGrid();
    const snapshot = renderShips(before);
    tryRandomPlacement(before);
    expect(renderShips(before)).toEqual(snapshot);
  });
});
