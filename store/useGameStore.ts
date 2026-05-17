import { applyFire } from '@/engine/combat';
import { placeShip, tryRandomPlacement } from '@/engine/placement';
import { createGameField } from '@/models/game-factory';
import type { Field, Orientation, ShipType } from '@/models/types';
import { SHIP_FLEET } from '@/models/types';
import { create } from 'zustand';

const PLAYER = { id: '1', name: 'CAPTAIN', isAI: false };
const AI_PLAYER = { id: '2', name: 'ENEMY', isAI: true };

function makeInitialOpponentFields(): Field[][] {
  const result = tryRandomPlacement(createGameField(AI_PLAYER).fields);
  return result ? result.fields : createGameField(AI_PLAYER).fields;
}

export interface StartBattleArgs {
  opponentFields: Field[][];
  firstTurn: 'player' | 'enemy';
}

function makeInitialOrientations(): Record<ShipType, Orientation> {
  return Object.fromEntries(SHIP_FLEET.map(t => [t, 'horizontal'])) as Record<
    ShipType,
    Orientation
  >;
}

interface GameState {
  fields: Field[][];
  opponentFields: Field[][];
  placedShips: Set<ShipType>;
  orientations: Record<ShipType, Orientation>;
  turn: 'player' | 'enemy';
  showOpponentField: boolean;
  sunkEvent: { shipType: ShipType; owner: 'player' | 'enemy' } | null;
}

interface GameActions {
  placeShipOnBoard: (
    ship: ShipType,
    cells: { x: number; y: number }[],
    orientation: Orientation,
    fromGridShipId?: string | null,
  ) => void;
  removeShipFromBoard: (ship: ShipType, shipId: string) => void;
  toggleOrientation: (ship: ShipType) => void;
  randomizeFleet: () => void;
  markTargeted: (grid: 'player' | 'opponent', x: number, y: number) => void;
  resolveShot: (grid: 'player' | 'opponent', x: number, y: number) => void;
  setTurn: (turn: 'player' | 'enemy') => void;
  setSunkEvent: (event: { shipType: ShipType; owner: 'player' | 'enemy' } | null) => void;
  startBattle: (args: StartBattleArgs) => void;
  resetGame: () => void;
  sinkAllOpponentShips: () => void;
  sinkAllPlayerShips: () => void;
}

export const useGameStore = create<GameState & GameActions>((set, get) => ({
  fields: createGameField(PLAYER).fields,
  opponentFields: makeInitialOpponentFields(),
  placedShips: new Set(),
  orientations: makeInitialOrientations(),
  turn: 'player',
  showOpponentField: false,
  sunkEvent: null,

  placeShipOnBoard(ship, cells, orientation, fromGridShipId) {
    set(s => {
      const withoutOld = fromGridShipId
        ? s.fields.map(row =>
            row.map(f => (f.shipPart?.ship.id === fromGridShipId ? { ...f, shipPart: null } : f)),
          )
        : s.fields;
      return {
        fields: placeShip(withoutOld, ship, cells, orientation),
        placedShips: new Set([...s.placedShips, ship]),
      };
    });
  },

  removeShipFromBoard(ship, shipId) {
    set(s => {
      const next = new Set(s.placedShips);
      next.delete(ship);
      return {
        fields: s.fields.map(row =>
          row.map(f => (f.shipPart?.ship.id === shipId ? { ...f, shipPart: null } : f)),
        ),
        placedShips: next,
      };
    });
  },

  toggleOrientation(ship) {
    set(s => ({
      orientations: {
        ...s.orientations,
        [ship]: s.orientations[ship] === 'horizontal' ? 'vertical' : 'horizontal',
      },
    }));
  },

  randomizeFleet() {
    const result = tryRandomPlacement(createGameField(PLAYER).fields);
    if (!result) return;
    set({
      fields: result.fields,
      orientations: result.orientations,
      placedShips: new Set(SHIP_FLEET),
    });
  },

  markTargeted(grid, x, y) {
    const key = grid === 'player' ? 'fields' : 'opponentFields';
    set(s => ({
      [key]: s[key].map(row =>
        row.map(f => (f.x === x && f.y === y ? { ...f, status: 'targeted' as const } : f)),
      ),
    }));
  },

  resolveShot(grid, x, y) {
    const key = grid === 'player' ? 'fields' : 'opponentFields';
    const owner = grid === 'player' ? 'player' : 'enemy';
    const currentFields = get()[key];
    const { fields: next, sunkShip } = applyFire(currentFields, x, y);
    set({
      [key]: next,
      ...(sunkShip ? { sunkEvent: { shipType: sunkShip.type, owner } } : {}),
    });
  },

  setTurn(turn) {
    set({ turn });
  },

  setSunkEvent(event) {
    set({ sunkEvent: event });
  },

  resetGame() {
    set({
      fields: createGameField(PLAYER).fields,
      opponentFields: makeInitialOpponentFields(),
      placedShips: new Set(),
      orientations: makeInitialOrientations(),
      turn: 'player',
      showOpponentField: false,
      sunkEvent: null,
    });
  },

  sinkAllOpponentShips() {
    set(s => ({
      opponentFields: s.opponentFields.map(row =>
        row.map(f =>
          f.shipPart
            ? { ...f, status: 'sunk' as const, shipPart: { ...f.shipPart, isHit: true } }
            : f,
        ),
      ),
    }));
  },

  sinkAllPlayerShips() {
    set(s => ({
      fields: s.fields.map(row =>
        row.map(f =>
          f.shipPart
            ? { ...f, status: 'sunk' as const, shipPart: { ...f.shipPart, isHit: true } }
            : f,
        ),
      ),
    }));
  },

  startBattle({ opponentFields, firstTurn }) {
    set(s => ({
      showOpponentField: true,
      opponentFields,
      fields: s.fields.map(row => row.map(f => ({ ...f, status: 'empty' as const }))),
      turn: firstTurn,
      sunkEvent: null,
    }));
  },
}));
