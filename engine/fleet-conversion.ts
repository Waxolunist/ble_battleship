import { buildPreviewCells, isValidPlacement, placeShip } from '@/engine/placement';
import { createGameField } from '@/models/game-factory';
import type { Field, ShipType } from '@/models/types';
import type { FleetPlacement } from '@/store/useBLEStore';

const REMOTE_PLAYER = { id: 'remote', name: 'OPPONENT', isAI: false };

export function serializeFleet(fields: Field[][]): FleetPlacement[] {
  const placements: FleetPlacement[] = [];
  const seen = new Set<string>();

  for (const row of fields) {
    for (const cell of row) {
      const ship = cell.shipPart?.ship;
      if (!ship || seen.has(ship.id)) continue;
      seen.add(ship.id);
      const firstPart = ship.parts[0].field;
      placements.push({
        shipType: ship.type as ShipType,
        x: firstPart.x,
        y: firstPart.y,
        orientation: ship.orientation,
      });
    }
  }

  return placements;
}

/**
 * Build a populated grid from a peer's FLEET_READY payload. Used by the BLE
 * opponent to materialise the remote fleet so the local combat hook can apply
 * shots against it. Throws on out-of-bounds or overlapping placements so a
 * malformed peer payload surfaces immediately instead of corrupting the grid.
 */
export function placeFleet(fleet: FleetPlacement[]): Field[][] {
  let current = createGameField(REMOTE_PLAYER).fields;
  for (const placement of fleet) {
    const cells = buildPreviewCells(
      placement.shipType,
      placement.x,
      placement.y,
      placement.orientation,
    );
    if (!isValidPlacement(cells, current)) {
      throw new Error(
        `Invalid peer placement: ${placement.shipType} @ (${placement.x},${placement.y}) ${placement.orientation}`,
      );
    }
    current = placeShip(current, placement.shipType, cells, placement.orientation);
  }
  return current;
}
