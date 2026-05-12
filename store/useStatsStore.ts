import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Field, ShipType } from '@/models/types';
import { SHIP_FLEET } from '@/models/types';
import { fileSystemStorage } from './persistence';

export interface GameResult {
  outcome: 'victory' | 'defeat';
  hits: number;
  misses: number;
  enemyShipsSunk: ShipType[];
  playerShipsLost: ShipType[];
}

export type ShipCounts = Record<ShipType, number>;

function zeroShipCounts(): ShipCounts {
  return Object.fromEntries(SHIP_FLEET.map(t => [t, 0])) as ShipCounts;
}

interface StatsState {
  gamesPlayed: number;
  wins: number;
  losses: number;
  currentStreak: number;
  bestWinStreak: number;
  totalShots: number;
  totalHits: number;
  totalMisses: number;
  enemyShipsSunkByType: ShipCounts;
  playerShipsLostByType: ShipCounts;
  recordGame: (result: GameResult) => void;
  resetStats: () => void;
}

export const useStatsStore = create<StatsState>()(
  persist(
    set => ({
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      currentStreak: 0,
      bestWinStreak: 0,
      totalShots: 0,
      totalHits: 0,
      totalMisses: 0,
      enemyShipsSunkByType: zeroShipCounts(),
      playerShipsLostByType: zeroShipCounts(),
      resetStats: () =>
        set({
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
          currentStreak: 0,
          bestWinStreak: 0,
          totalShots: 0,
          totalHits: 0,
          totalMisses: 0,
          enemyShipsSunkByType: zeroShipCounts(),
          playerShipsLostByType: zeroShipCounts(),
        }),
      recordGame: (result: GameResult) =>
        set(s => {
          const isWin = result.outcome === 'victory';
          const newStreak = isWin ? s.currentStreak + 1 : 0;
          const enemySunk = { ...s.enemyShipsSunkByType };
          for (const type of result.enemyShipsSunk) enemySunk[type]++;
          const playerLost = { ...s.playerShipsLostByType };
          for (const type of result.playerShipsLost) playerLost[type]++;
          return {
            gamesPlayed: s.gamesPlayed + 1,
            wins: s.wins + (isWin ? 1 : 0),
            losses: s.losses + (isWin ? 0 : 1),
            currentStreak: newStreak,
            bestWinStreak: Math.max(s.bestWinStreak, newStreak),
            totalShots: s.totalShots + result.hits + result.misses,
            totalHits: s.totalHits + result.hits,
            totalMisses: s.totalMisses + result.misses,
            enemyShipsSunkByType: enemySunk,
            playerShipsLostByType: playerLost,
          };
        }),
    }),
    {
      name: 'stats',
      storage: createJSONStorage(() => fileSystemStorage),
    },
  ),
);

export function computeFieldShotStats(fields: Field[][]): { hits: number; misses: number } {
  let hits = 0;
  let misses = 0;
  for (const row of fields) {
    for (const cell of row) {
      if (cell.status === 'hit' || cell.status === 'sunk') hits++;
      else if (cell.status === 'miss') misses++;
    }
  }
  return { hits, misses };
}

export function computeSunkShipTypes(fields: Field[][]): ShipType[] {
  const shipMap = new Map<string, { type: ShipType; allSunk: boolean }>();
  for (const row of fields) {
    for (const cell of row) {
      if (!cell.shipPart) continue;
      const id = cell.shipPart.ship.id;
      const type = cell.shipPart.ship.type;
      if (!shipMap.has(id)) shipMap.set(id, { type, allSunk: true });
      if (cell.status !== 'sunk') shipMap.get(id)!.allSunk = false;
    }
  }
  return [...shipMap.values()].filter(s => s.allSunk).map(s => s.type);
}
