import { applyFire } from '@/engine/combat';
import { buildPreviewCells, placeShip } from '@/engine/placement';
import { createGameField } from '@/models/game-factory';
import type { Field, Orientation, Player, ShipType } from '@/models/types';

export const TEST_PLAYER: Player = { id: 'test', name: 'TEST', isAI: false };

export function emptyGrid(): Field[][] {
  return createGameField(TEST_PLAYER).fields;
}

/** Place a ship by type/origin/orientation onto a grid. */
export function place(
  fields: Field[][],
  shipType: ShipType,
  x: number,
  y: number,
  orientation: Orientation,
): Field[][] {
  return placeShip(fields, shipType, buildPreviewCells(shipType, x, y, orientation), orientation);
}

/** Fire at every cell a ship occupies, returning the final grid. */
export function sink(
  fields: Field[][],
  cells: { x: number; y: number }[],
): { fields: Field[][]; sunkCount: number } {
  let current = fields;
  let sunkCount = 0;
  for (const { x, y } of cells) {
    const res = applyFire(current, x, y);
    current = res.fields;
    if (res.sunkShip) sunkCount++;
  }
  return { fields: current, sunkCount };
}

/** Render a grid's statuses as rows of chars, for readable assertions. */
export function renderStatus(fields: Field[][]): string[] {
  const glyph = { empty: '.', targeted: 'o', hit: 'X', miss: 'm', sunk: '#' } as const;
  return fields.map(row => row.map(f => glyph[f.status]).join(''));
}

/** Render which cells hold a ship part. */
export function renderShips(fields: Field[][]): string[] {
  return fields.map(row => row.map(f => (f.shipPart ? 'S' : '.')).join(''));
}
