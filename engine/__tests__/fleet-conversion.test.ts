import { isCompleteFleet, placeFleet, serializeFleet } from '@/engine/fleet-conversion';
import { GRID_SIZE, SHIP_FLEET, SHIP_SIZES } from '@/models/types';
import type { FleetPlacement } from '@/store/useMultiplayerStore';
import { tryRandomPlacement } from '@/engine/placement';
import { emptyGrid, place, renderShips, renderStatus, sink } from './helpers';

const FULL_FLEET: FleetPlacement[] = [
  { shipType: 'Carrier', x: 0, y: 0, orientation: 'horizontal' },
  { shipType: 'Battleship', x: 0, y: 2, orientation: 'horizontal' },
  { shipType: 'Cruiser', x: 0, y: 4, orientation: 'horizontal' },
  { shipType: 'Submarine', x: 0, y: 6, orientation: 'vertical' },
  { shipType: 'Destroyer', x: 5, y: 8, orientation: 'horizontal' },
];

/** Swap one ship's placement in an otherwise complete fleet. */
function withShipAt(fleet: FleetPlacement[], replacement: FleetPlacement): FleetPlacement[] {
  return fleet.map(p => (p.shipType === replacement.shipType ? replacement : p));
}

describe('serializeFleet', () => {
  it('returns an empty list for an empty grid', () => {
    expect(serializeFleet(emptyGrid())).toEqual([]);
  });

  it('emits one entry per ship, not per occupied cell', () => {
    const grid = place(emptyGrid(), 'Carrier', 0, 0, 'horizontal');
    expect(serializeFleet(grid)).toEqual([
      { shipType: 'Carrier', x: 0, y: 0, orientation: 'horizontal' },
    ]);
  });

  it('reports the origin as the first part, for both orientations', () => {
    const horizontal = serializeFleet(place(emptyGrid(), 'Cruiser', 4, 6, 'horizontal'))[0];
    expect(horizontal).toEqual({ shipType: 'Cruiser', x: 4, y: 6, orientation: 'horizontal' });

    const vertical = serializeFleet(place(emptyGrid(), 'Cruiser', 4, 6, 'vertical'))[0];
    expect(vertical).toEqual({ shipType: 'Cruiser', x: 4, y: 6, orientation: 'vertical' });
  });

  it('serializes a full fleet as five entries', () => {
    expect(serializeFleet(placeFleet(FULL_FLEET))).toHaveLength(SHIP_FLEET.length);
  });
});

describe('placeFleet', () => {
  it('materialises every ship at the requested origin', () => {
    const grid = placeFleet(
      withShipAt(FULL_FLEET, { shipType: 'Battleship', x: 3, y: 3, orientation: 'horizontal' }),
    );
    expect(renderShips(grid)[3]).toBe('...SSSS...');
  });

  it("occupies exactly the fleet's total cell count", () => {
    const occupied = placeFleet(FULL_FLEET)
      .flat()
      .filter(f => f.shipPart);
    const expected = SHIP_FLEET.reduce((sum, s) => sum + SHIP_SIZES[s], 0);
    expect(occupied).toHaveLength(expected);
  });

  it('leaves every cell in "empty" status — placement is not combat state', () => {
    expect(
      placeFleet(FULL_FLEET)
        .flat()
        .every(f => f.status === 'empty'),
    ).toBe(true);
  });
});

describe('placeFleet — rejecting malformed peer payloads', () => {
  it('throws when a ship runs off the right edge', () => {
    const fleet = withShipAt(FULL_FLEET, {
      shipType: 'Carrier',
      x: GRID_SIZE - 4,
      y: 0,
      orientation: 'horizontal',
    });
    expect(() => placeFleet(fleet)).toThrow(/Invalid peer placement/);
  });

  it('throws when a ship runs off the bottom edge', () => {
    const fleet = withShipAt(FULL_FLEET, {
      shipType: 'Carrier',
      x: 0,
      y: GRID_SIZE - 4,
      orientation: 'vertical',
    });
    expect(() => placeFleet(fleet)).toThrow(/Invalid peer placement/);
  });

  it('throws on a negative origin', () => {
    const fleet = withShipAt(FULL_FLEET, {
      shipType: 'Destroyer',
      x: -1,
      y: 0,
      orientation: 'horizontal',
    });
    expect(() => placeFleet(fleet)).toThrow(/Invalid peer placement/);
  });

  it('throws when two ships overlap', () => {
    const fleet = withShipAt(FULL_FLEET, {
      shipType: 'Cruiser',
      x: 2,
      y: 0,
      orientation: 'horizontal',
    });
    expect(() => placeFleet(fleet)).toThrow(/Invalid peer placement/);
  });

  it('names the offending ship and square in the error', () => {
    const fleet = withShipAt(FULL_FLEET, {
      shipType: 'Carrier',
      x: 8,
      y: 1,
      orientation: 'horizontal',
    });
    expect(() => placeFleet(fleet)).toThrow('Invalid peer placement: Carrier @ (8,1) horizontal');
  });
});

describe('round-trip: serializeFleet ∘ placeFleet', () => {
  it('survives a full fleet unchanged', () => {
    expect(serializeFleet(placeFleet(FULL_FLEET))).toEqual(expect.arrayContaining(FULL_FLEET));
  });

  it('is stable across a second round-trip', () => {
    const once = serializeFleet(placeFleet(FULL_FLEET));
    expect(serializeFleet(placeFleet(once))).toEqual(once);
  });

  it('reproduces the same occupied squares', () => {
    const original = placeFleet(FULL_FLEET);
    const reconstructed = placeFleet(serializeFleet(original));
    expect(renderShips(reconstructed)).toEqual(renderShips(original));
  });

  it('round-trips a randomly built grid', () => {
    const grid = placeFleet(FULL_FLEET);
    const reconstructed = placeFleet(serializeFleet(grid));
    expect(serializeFleet(reconstructed)).toEqual(serializeFleet(grid));
  });
});

describe('unique ship ids', () => {
  // Regression: ids were `${shipType}-${Date.now()}`, so a fleet placed inside
  // one millisecond produced colliding ids — sinking one hull sank its twin,
  // and serializeFleet deduped the twin away entirely.
  it('gives every ship in a full fleet a distinct id', () => {
    const ids = new Set(
      placeFleet(FULL_FLEET)
        .flat()
        .filter(f => f.shipPart)
        .map(f => f.shipPart!.ship.id),
    );
    expect(ids.size).toBe(SHIP_FLEET.length);
  });

  it('gives distinct ids to ships of the same type', () => {
    const a = place(emptyGrid(), 'Destroyer', 0, 0, 'horizontal');
    const b = place(a, 'Destroyer', 0, 5, 'horizontal');
    expect(b[0][0].shipPart!.ship.id).not.toBe(b[5][0].shipPart!.ship.id);
  });

  it('does not reuse an id across separately built grids', () => {
    const first = placeFleet(FULL_FLEET)[0][0].shipPart!.ship.id;
    const second = placeFleet(FULL_FLEET)[0][0].shipPart!.ship.id;
    expect(first).not.toBe(second);
  });

  it('sinks only the struck hull when two ships share a type', () => {
    const grid = place(
      place(emptyGrid(), 'Destroyer', 0, 0, 'horizontal'),
      'Destroyer',
      0,
      5,
      'horizontal',
    );
    const { fields } = sink(grid, [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
    expect(renderStatus(fields)[0]).toBe('##........');
    expect(renderStatus(fields)[5]).toBe('..........');
  });

  it('serializes both ships when two share a type', () => {
    const grid = place(
      place(emptyGrid(), 'Destroyer', 0, 0, 'horizontal'),
      'Destroyer',
      0,
      5,
      'horizontal',
    );
    expect(serializeFleet(grid)).toHaveLength(2);
  });
});

describe('isCompleteFleet', () => {
  it('accepts exactly one of each ship in the fleet', () => {
    expect(isCompleteFleet(FULL_FLEET)).toBe(true);
  });

  it('ignores ordering', () => {
    expect(isCompleteFleet([...FULL_FLEET].reverse())).toBe(true);
  });

  it('rejects an empty fleet', () => {
    expect(isCompleteFleet([])).toBe(false);
  });

  it('rejects a fleet missing a ship', () => {
    expect(isCompleteFleet(FULL_FLEET.slice(0, 4))).toBe(false);
  });

  it('rejects a fleet with an extra ship', () => {
    expect(
      isCompleteFleet([
        ...FULL_FLEET,
        { shipType: 'Destroyer', x: 0, y: 9, orientation: 'horizontal' },
      ]),
    ).toBe(false);
  });

  it('rejects a fleet that swaps one type for a duplicate of another', () => {
    const noCarrier = FULL_FLEET.filter(p => p.shipType !== 'Carrier');
    expect(
      isCompleteFleet([
        ...noCarrier,
        { shipType: 'Destroyer', x: 0, y: 9, orientation: 'horizontal' },
      ]),
    ).toBe(false);
  });
});

describe('placeFleet — fleet composition', () => {
  it('rejects an empty fleet', () => {
    expect(() => placeFleet([])).toThrow(/Invalid peer fleet/);
  });

  it('rejects a fleet missing a ship', () => {
    expect(() => placeFleet(FULL_FLEET.slice(0, 4))).toThrow(/Invalid peer fleet/);
  });

  it('rejects a fleet with a repeated ship type', () => {
    const noCarrier = FULL_FLEET.filter(p => p.shipType !== 'Carrier');
    expect(() =>
      placeFleet([...noCarrier, { shipType: 'Destroyer', x: 0, y: 9, orientation: 'horizontal' }]),
    ).toThrow(/Invalid peer fleet/);
  });

  it('rejects an over-long fleet even when every type is present', () => {
    expect(() =>
      placeFleet([...FULL_FLEET, { shipType: 'Destroyer', x: 0, y: 9, orientation: 'horizontal' }]),
    ).toThrow(/Invalid peer fleet/);
  });

  it('lists the expected and received ships in the error', () => {
    expect(() => placeFleet([])).toThrow(
      'Invalid peer fleet: expected exactly one of each of Carrier, Battleship, Cruiser, Submarine, Destroyer, got []',
    );
  });

  it('checks composition before placement, so a short fleet is not a placement error', () => {
    expect(() =>
      placeFleet([{ shipType: 'Carrier', x: 8, y: 1, orientation: 'horizontal' }]),
    ).toThrow(/Invalid peer fleet/);
  });
});

describe('the local fleet we put on the wire is always one a peer will accept', () => {
  it('serializes a randomly placed fleet into a complete fleet', () => {
    for (let i = 0; i < 50; i++) {
      const grid = tryRandomPlacement(emptyGrid())!.fields;
      expect(isCompleteFleet(serializeFleet(grid))).toBe(true);
    }
  });

  it('round-trips a randomly placed fleet through placeFleet without throwing', () => {
    for (let i = 0; i < 50; i++) {
      const grid = tryRandomPlacement(emptyGrid())!.fields;
      expect(() => placeFleet(serializeFleet(grid))).not.toThrow();
    }
  });

  it('rebuilds the same occupied squares from a randomly placed fleet', () => {
    const grid = tryRandomPlacement(emptyGrid())!.fields;
    expect(renderShips(placeFleet(serializeFleet(grid)))).toEqual(renderShips(grid));
  });
});
