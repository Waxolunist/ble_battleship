export type ShipType = 'Carrier' | 'Battleship' | 'Cruiser' | 'Submarine' | 'Destroyer';

export type Orientation = 'horizontal' | 'vertical';

export const GRID_SIZE = 10;

export const SHIP_SIZES: Record<ShipType, number> = {
  Carrier: 5,
  Battleship: 4,
  Cruiser: 3,
  Submarine: 3,
  Destroyer: 2,
};

export const SHIP_FLEET: ShipType[] = [
  'Carrier',
  'Battleship',
  'Cruiser',
  'Submarine',
  'Destroyer',
];

export interface Player {
  id: string;
  name: string;
  isAI: boolean;
}

export interface Field {
  x: number;
  y: number;
  status: 'empty' | 'targeted' | 'hit' | 'miss' | 'sunk';
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
  orientation: 'horizontal' | 'vertical';
}

export interface GameField {
  owner: Player;
  fields: Field[][];
  ships: Ship[];
}

export interface Game {
  id: string;
  status: 'placement' | 'playing' | 'finished';
  currentTurn: Player;
  winner: Player | null;
  players: [Player, Player];
  gameFields: [GameField, GameField];
}

// ── Rank system ──────────────────────────────────────────────────────────────

export const RANK_TIERS = [
  { title: 'CADET', threshold: 0 },
  { title: 'ENSIGN', threshold: 30 },
  { title: 'CAPTAIN', threshold: 45 },
  { title: 'COMMODORE', threshold: 60 },
  { title: 'ADMIRAL', threshold: 70 },
] as const;

export function getRankTitle(gamesPlayed: number, winRate: number): string {
  if (gamesPlayed === 0) return 'UNPROVEN';
  if (gamesPlayed < 3) return 'RECRUIT';
  for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
    if (winRate >= RANK_TIERS[i].threshold) return RANK_TIERS[i].title;
  }
  return 'CADET';
}

export function translateRankTitle(rankTitle: string, t: any): string {
  return t(`rank.tiers.${rankTitle}`);
}

export function translateShipType(shipType: ShipType, t: any): string {
  return t(`ships.${shipType}`);
}

export type ShotPhase = {
  x: number;
  y: number;
  grid: 'player' | 'opponent';
  beat: 'locked' | 'impact' | 'verdict';
  result?: 'hit' | 'miss' | 'sunk';
  reticleColor: string;
} | null;
