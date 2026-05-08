export type ShipType = "Carrier" | "Battleship" | "Cruiser" | "Submarine" | "Destroyer";

export const SHIP_SIZES: Record<ShipType, number> = {
  Carrier: 5,
  Battleship: 4,
  Cruiser: 3,
  Submarine: 3,
  Destroyer: 2,
};

export const SHIP_FLEET: ShipType[] = [
  "Carrier",
  "Battleship",
  "Cruiser",
  "Submarine",
  "Destroyer",
];

export interface Player {
  id: string;
  name: string;
  isAI: boolean;
}

export interface Field {
  x: number;
  y: number;
  status: "empty" | "miss" | "hit";
  shipPart: ShipPart | null;
}

export interface ShipPart {
  ship: Ship;
  field: Field;
  isHit: boolean;
}

export interface Ship {
  id: string;
  type: ShipType;
  parts: ShipPart[];
  orientation: "horizontal" | "vertical";
}

export interface GameField {
  owner: Player;
  fields: Field[][];
  ships: Ship[];
}

export interface Game {
  id: string;
  status: "placement" | "playing" | "finished";
  currentTurn: Player;
  winner: Player | null;
  players: [Player, Player];
  gameFields: [GameField, GameField];
}
