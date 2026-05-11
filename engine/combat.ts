import type { Field, Ship } from "@/models/types";

export function applyFire(
  fields: Field[][],
  x: number,
  y: number,
): { fields: Field[][]; sunkShip: Ship | null } {
  const cell = fields[y][x];
  const isHit = !!cell.shipPart;

  let sunkShip: Ship | null = null;
  if (isHit && cell.shipPart) {
    const ship = cell.shipPart.ship;
    const allOtherPartsHit = ship.parts
      .filter(({ field: pf }) => !(pf.x === x && pf.y === y))
      .every(({ field: pf }) => fields[pf.y][pf.x].shipPart?.isHit === true);
    if (allOtherPartsHit) sunkShip = ship;
  }

  const withHit = fields.map((row) =>
    row.map((f) =>
      f.x === x && f.y === y
        ? {
            ...f,
            status: isHit ? ("hit" as const) : ("miss" as const),
            shipPart: f.shipPart ? { ...f.shipPart, isHit: true } : null,
          }
        : f,
    ),
  );

  if (!sunkShip) return { fields: withHit, sunkShip: null };

  return {
    fields: withHit.map((row) =>
      row.map((f) =>
        f.shipPart?.ship.id === sunkShip!.id ? { ...f, status: "sunk" as const } : f,
      ),
    ),
    sunkShip,
  };
}
