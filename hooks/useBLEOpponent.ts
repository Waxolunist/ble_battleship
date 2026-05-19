import { placeFleet } from '@/engine/fleet-conversion';
import type { GameOutcome, Opponent, PreparedBattle, ShotResult } from '@/models/opponent';
import { GRID_SIZE, SHIP_FLEET, type ShipType } from '@/models/types';
import { multiplayerService } from '@/services/multiplayer';
import { useMultiplayerStore, type FleetPlacement } from '@/store/useMultiplayerStore';
import { useGameStore } from '@/store/useGameStore';
import { useCallback, useEffect, useMemo, useRef } from 'react';

interface PendingShot {
  x: number;
  y: number;
  resolve: (result: ShotResult) => void;
  reject: (err: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

// If the peer doesn't respond within this window, fall back to a locally
// computed verdict (our mirror of the peer's fleet) so the UI never freezes.
const SHOT_RESPONSE_TIMEOUT_MS = 10_000;

const SHIP_TYPES = new Set<string>(SHIP_FLEET);

function isCoord(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < GRID_SIZE;
}

function isShotResult(value: unknown): value is ShotResult {
  return value === 'hit' || value === 'miss' || value === 'sunk';
}

function isShipType(value: unknown): value is ShipType {
  return typeof value === 'string' && SHIP_TYPES.has(value);
}

function parseFleetPayload(value: unknown): FleetPlacement[] | null {
  if (!Array.isArray(value)) return null;
  const result: FleetPlacement[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') return null;
    const e = entry as Record<string, unknown>;
    if (!isShipType(e.shipType)) return null;
    if (!isCoord(e.x) || !isCoord(e.y)) return null;
    if (e.orientation !== 'horizontal' && e.orientation !== 'vertical') return null;
    result.push({ shipType: e.shipType, x: e.x, y: e.y, orientation: e.orientation });
  }
  return result;
}

function computeLocalShotResult(x: number, y: number): ShotResult {
  useGameStore.getState().resolveShot('opponent', x, y);
  const field = useGameStore.getState().opponentFields[y][x];
  return field.status === 'sunk' ? 'sunk' : field.status === 'hit' ? 'hit' : 'miss';
}

export function useBLEOpponent(): Opponent {
  const setOpponentFleet = useMultiplayerStore(s => s.setOpponentFleet);
  const setLocalFleetReady = useMultiplayerStore(s => s.setLocalFleetReady);
  const setRemoteFleetReady = useMultiplayerStore(s => s.setRemoteFleetReady);
  const setBLEState = useMultiplayerStore(s => s.setState);

  const pendingShotRef = useRef<PendingShot | null>(null);
  const enemyShotHandlerRef = useRef<((x: number, y: number) => void) | null>(null);
  const gameOverHandlerRef = useRef<((outcome: GameOutcome) => void) | null>(null);
  const fleetReadyResolverRef = useRef<((fleet: FleetPlacement[]) => void) | null>(null);

  useEffect(() => {
    const unsubscribe = multiplayerService.onMessage(message => {
      switch (message.type) {
        case 'FLEET_READY': {
          const fleet = parseFleetPayload(message.data?.fleet);
          if (!fleet) {
            console.warn('[useBLEOpponent] dropped malformed FLEET_READY');
            break;
          }
          setOpponentFleet(fleet);
          setRemoteFleetReady(true);
          fleetReadyResolverRef.current?.(fleet);
          fleetReadyResolverRef.current = null;
          break;
        }
        case 'FIRE': {
          const x = message.data?.x;
          const y = message.data?.y;
          if (!isCoord(x) || !isCoord(y)) {
            console.warn('[useBLEOpponent] dropped malformed FIRE');
            break;
          }
          enemyShotHandlerRef.current?.(x, y);
          break;
        }
        case 'SHOT_RESULT': {
          const x = message.data?.x;
          const y = message.data?.y;
          const result = message.data?.result;
          if (!isCoord(x) || !isCoord(y) || !isShotResult(result)) {
            console.warn('[useBLEOpponent] dropped malformed SHOT_RESULT');
            break;
          }
          const pending = pendingShotRef.current;
          if (!pending || pending.x !== x || pending.y !== y) break;
          // Our opponent grid mirrors the peer's fleet (delivered via
          // FLEET_READY), so applyFire against it is the source of truth.
          // The peer's reported result is treated as a round-trip ack; if it
          // ever diverges from local, that's a sync bug worth logging.
          const localResult = computeLocalShotResult(x, y);
          if (localResult !== result) {
            console.warn(
              `[useBLEOpponent] SHOT_RESULT divergence at (${x},${y}): local=${localResult} peer=${result}`,
            );
          }
          pendingShotRef.current = null;
          pending.resolve(localResult);
          break;
        }
        case 'GAME_OVER': {
          setBLEState('GAME_OVER');
          gameOverHandlerRef.current?.('defeat');
          break;
        }
        case 'REMATCH': {
          // Phase 3: BLEConnectionGuard owns the rematch UI/state.
          break;
        }
        case 'BYE': {
          if (pendingShotRef.current) {
            clearTimeout(pendingShotRef.current.timeoutId);
            pendingShotRef.current.reject(new Error('Peer disconnected'));
            pendingShotRef.current = null;
          }
          fleetReadyResolverRef.current = null;
          setBLEState('IDLE');
          break;
        }
      }
    });
    return unsubscribe;
  }, [setOpponentFleet, setRemoteFleetReady, setBLEState]);

  const resolvePlayerShot = useCallback((x: number, y: number): Promise<ShotResult> => {
    return new Promise<ShotResult>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (pendingShotRef.current?.timeoutId !== timeoutId) return;
        console.warn(
          `[useBLEOpponent] SHOT_RESULT timeout at (${x},${y}); falling back to local verdict`,
        );
        pendingShotRef.current = null;
        resolve(computeLocalShotResult(x, y));
      }, SHOT_RESPONSE_TIMEOUT_MS);

      pendingShotRef.current = { x, y, resolve, reject, timeoutId };

      multiplayerService.sendMessage({ type: 'FIRE', data: { x, y } }).catch(err => {
        if (pendingShotRef.current?.timeoutId !== timeoutId) return;
        clearTimeout(timeoutId);
        pendingShotRef.current = null;
        reject(err instanceof Error ? err : new Error(String(err)));
      });
    });
  }, []);

  const onEnemyShot = useCallback((handler: (x: number, y: number) => void) => {
    enemyShotHandlerRef.current = handler;
    return () => {
      if (enemyShotHandlerRef.current === handler) {
        enemyShotHandlerRef.current = null;
      }
    };
  }, []);

  const reportEnemyShotResolution = useCallback((x: number, y: number, result: ShotResult) => {
    let shipType: ShipType | undefined;
    if (result === 'sunk') {
      const fields = useGameStore.getState().fields;
      const ship = fields[y][x].shipPart?.ship;
      shipType = ship?.type as ShipType | undefined;
    }
    multiplayerService
      .sendMessage({ type: 'SHOT_RESULT', data: { x, y, result, shipType } })
      .catch(err => console.error('[useBLEOpponent] Failed to send SHOT_RESULT:', err));
  }, []);

  const prepareBattle = useCallback(
    async (localFleet: FleetPlacement[]): Promise<PreparedBattle> => {
      setBLEState('PLACEMENT');
      setLocalFleetReady(true);
      await multiplayerService.sendMessage({ type: 'FLEET_READY', data: { fleet: localFleet } });

      // Peer may have already sent FLEET_READY before our prepare started.
      const existing = useMultiplayerStore.getState().opponentFleet;
      const opponentFleet =
        existing ??
        (await new Promise<FleetPlacement[]>(resolve => {
          fleetReadyResolverRef.current = resolve;
        }));

      const opponentFields = placeFleet(opponentFleet);
      const firstTurn = multiplayerService.getRole() === 'host' ? 'player' : 'enemy';
      setBLEState('BATTLE');
      return { opponentFields, firstTurn };
    },
    [setBLEState, setLocalFleetReady],
  );

  const notifyGameOver = useCallback(
    (outcome: GameOutcome) => {
      setBLEState('GAME_OVER');
      if (outcome === 'victory') {
        multiplayerService
          .sendMessage({ type: 'GAME_OVER' })
          .catch(err => console.error('[useBLEOpponent] Failed to send GAME_OVER:', err));
      }
    },
    [setBLEState],
  );

  const onGameOver = useCallback((handler: (outcome: GameOutcome) => void) => {
    gameOverHandlerRef.current = handler;
    return () => {
      if (gameOverHandlerRef.current === handler) {
        gameOverHandlerRef.current = null;
      }
    };
  }, []);

  return useMemo(
    () => ({
      resolvePlayerShot,
      onEnemyShot,
      reportEnemyShotResolution,
      prepareBattle,
      notifyGameOver,
      onGameOver,
    }),
    [
      resolvePlayerShot,
      onEnemyShot,
      reportEnemyShotResolution,
      prepareBattle,
      notifyGameOver,
      onGameOver,
    ],
  );
}
