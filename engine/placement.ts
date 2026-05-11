import type { Field, Orientation, ShipType } from "@/models/types";
import { GRID_SIZE, SHIP_FLEET, SHIP_SIZES } from "@/models/types";
import type { Ship, ShipPart } from "@/models/types";

export function buildPreviewCells(
  shipType: ShipType,
  startX: number,
  startY: number,
  orientation: Orientation,
): { x: number; y: number }[] {
  const size = SHIP_SIZES[shipType];
  return Array.from({ length: size }, (_, i) => ({
    x: orientation === "horizontal" ? startX + i : startX,
    y: orientation === "vertical" ? startY + i : startY,
  }));
}

export function isValidPlacement(
  cells: { x: number; y: number }[],
  fields: Field[][],
  excludeShipId?: string,
): boolean {
  return cells.every(({ x, y }) => {
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return false;
    const part = fields[y][x].shipPart;
    if (!part) return true;
    return !!excludeShipId && part.ship.id === excludeShipId;
  });
}

export function placeShip(
  fields: Field[][],
  shipType: ShipType,
  cells: { x: number; y: number }[],
  orientation: Orientation,
): Field[][] {
  const ship: Ship = {
    id: `${shipType}-${Date.now()}`,
    type: shipType,
    parts: [],
    orientation,
  };

  const next = fields.map((row) => row.map((f) => ({ ...f })));

  const parts: ShipPart[] = cells.map(({ x, y }) => {
    const part: ShipPart = { ship, field: next[y][x], isHit: false };
    next[y][x] = { ...next[y][x], shipPart: part };
    return part;
  });

  ship.parts = parts;

  return next;
}

export function tryRandomPlacement(emptyFields: Field[][]): {
  fields: Field[][];
  orientations: Record<ShipType, Orientation>;
} | null {
  let current = emptyFields;
  const orientations: Record<ShipType, Orientation> = {} as Record<ShipType, Orientation>;

  for (const shipType of SHIP_FLEET) {
    const orientation: Orientation = Math.random() < 0.5 ? "horizontal" : "vertical";
    orientations[shipType] = orientation;

    const valid: { x: number; y: number }[] = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const cells = buildPreviewCells(shipType, x, y, orientation);
        if (isValidPlacement(cells, current)) valid.push({ x, y });
      }
    }

    if (valid.length === 0) return null;

    const { x, y } = valid[Math.floor(Math.random() * valid.length)];
    const cells = buildPreviewCells(shipType, x, y, orientation);
    current = placeShip(current, shipType, cells, orientation);
  }

  return { fields: current, orientations };
}
