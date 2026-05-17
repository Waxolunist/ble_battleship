import type { Field, ShipType } from '@/models/types';
import type { FleetPlacement } from '@/store/useBLEStore';

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
