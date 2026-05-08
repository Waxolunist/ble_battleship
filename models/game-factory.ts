import type { Field, GameField, Player } from "./types";

export function createGameField(owner: Player): GameField {
  const fields: Field[][] = Array.from({ length: 10 }, (_, y) =>
    Array.from({ length: 10 }, (_, x) => ({
      x,
      y,
      status: "empty" as const,
      shipPart: null,
    }))
  );
  return { owner, fields, ships: [] };
}
