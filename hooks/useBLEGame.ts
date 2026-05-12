import { useCallback, useEffect, useRef, useState } from 'react';
import { useBLEStore, type FleetPlacement } from '@/store/useBLEStore';
import { useGameStore } from '@/store/useGameStore';
import { useStatsStore, computeFieldShotStats, computeSunkShipTypes } from '@/store/useStatsStore';
import { applyFire } from '@/engine/combat';
import type { ShipType } from '@/models/types';

interface PendingShot {
  x: number;
  y: number;
}

/**
 * Hook that bridges BLE events to game store actions.
 * Manages the multiplayer game lifecycle when in BLE mode.
 */
export function useBLEGame() {
  const {
    state: bleState,
    mode,
    localFleetReady,
    remoteFleetReady,
    setLocalFleetReady,
    setRemoteFleetReady,
    connectedPeer,
    setState,
    setOpponentFleet,
  } = useBLEStore();
  const {
    fields,
    opponentFields,
    turn,
    setTurn,
    startBattle,
    markTargeted,
    resolveShot,
    setSunkEvent,
  } = useGameStore();
  const pendingShotRef = useRef<PendingShot | null>(null);
  const [awaitingShotResult, setAwaitingShotResult] = useState(false);

  // Serialize placed fleet into FleetPlacement[]
  const serializeFleet = useCallback((): FleetPlacement[] => {
    const placements: FleetPlacement[] = [];

    for (const row of fields) {
      for (const cell of row) {
        if (cell.shipPart && !placements.some(p => p.shipType === cell.shipPart?.ship.type)) {
          // Find the origin (top-left) of this ship
          const ship = cell.shipPart.ship;
          const shipParts = ship.parts;
          const firstPart = shipParts[0].field;

          placements.push({
            shipType: ship.type as ShipType,
            x: firstPart.x,
            y: firstPart.y,
            orientation: ship.orientation as 'horizontal' | 'vertical',
          });
        }
      }
    }

    return placements;
  }, [fields]);

  // Listen for "Fire at Will" tap in placement phase
  const handleFireAtWill = useCallback(() => {
    const fleet = serializeFleet();
    setLocalFleetReady(true);
    // TODO: Send FLEET_READY message over BLE with serialized fleet
    // fleet is ready to send: fleet satisfies FleetPlacement[]
  }, [serializeFleet, setLocalFleetReady]);

  // Called when opponent's FLEET_READY is received
  const handleRemoteFleetReady = useCallback(
    (opponentFleet: FleetPlacement[]) => {
      setOpponentFleet(opponentFleet);
      setRemoteFleetReady(true);
    },
    [setOpponentFleet, setRemoteFleetReady],
  );

  // When both fleets are ready, start battle
  useEffect(() => {
    if (localFleetReady && remoteFleetReady && bleState === 'PLACEMENT' && connectedPeer) {
      // Set turn: host fires first, joiner fires second
      const isHost = connectedPeer.id === connectedPeer.id; // Placeholder - needs actual host detection
      setTurn(isHost ? 'player' : 'enemy');
      startBattle();
      setState('BATTLE');
    }
  }, [localFleetReady, remoteFleetReady, bleState, connectedPeer, setTurn, startBattle, setState]);

  // Intercept player fire to send FIRE message at verdict beat
  const handlePlayerFire = useCallback(
    (x: number, y: number) => {
      if (turn !== 'player' || awaitingShotResult) return;

      // Store the shot to send when animation reaches verdict beat
      pendingShotRef.current = { x, y };
      setAwaitingShotResult(true);

      // TODO: At verdict beat (900ms), send FIRE message:
      // { type: 'FIRE', x, y }
      // Then wait for SHOT_RESULT response
    },
    [turn, awaitingShotResult],
  );

  // Handle incoming FIRE message from opponent
  const handleRemoteFire = useCallback(
    (x: number, y: number) => {
      // Ignore if not opponent's turn
      if (turn !== 'enemy') return;

      // Apply fire to local board
      const { fields: nextFields, sunkShip } = applyFire(fields, x, y);
      const field = nextFields[y][x];
      const result: 'hit' | 'miss' | 'sunk' =
        field.status === 'sunk' ? 'sunk' : field.status === 'hit' ? 'hit' : 'miss';

      // Update sunk event if applicable
      if (sunkShip) {
        setSunkEvent({ shipType: sunkShip.type, owner: 'enemy' });
      }

      // TODO: Send SHOT_RESULT message with result:
      // { type: 'SHOT_RESULT', x, y, result, shipType?: sunkShip?.type }

      // Trigger animation sequence (same as AI shot)
      markTargeted('player', x, y);
      // After animation completes, advance turn
      setTurn('player');
    },
    [turn, fields, markTargeted, setTurn, setSunkEvent],
  );

  // Handle incoming SHOT_RESULT message
  const handleShotResult = useCallback(
    (x: number, y: number, result: 'hit' | 'miss' | 'sunk', sunkShipType?: ShipType) => {
      if (turn !== 'player' || !awaitingShotResult) return;

      // Resolve the shot on opponent field
      resolveShot('opponent', x, y);

      // Update sunk event if applicable
      if (result === 'sunk' && sunkShipType) {
        setSunkEvent({ shipType: sunkShipType, owner: 'enemy' });
      }

      // Advance turn to opponent
      setAwaitingShotResult(false);
      setTurn('enemy');
    },
    [turn, awaitingShotResult, resolveShot, setSunkEvent, setTurn],
  );

  // Check if a fleet is completely sunk
  const isFleetSunk = useCallback((gridFields: typeof fields) => {
    return gridFields.every(row => row.every(cell => !cell.shipPart || cell.shipPart.isHit));
  }, []);

  // Handle game over: detect if opponent fleet is sunk
  const handleCheckGameOver = useCallback(() => {
    if (bleState !== 'BATTLE') return;

    const opponentFleetSunk = isFleetSunk(opponentFields);
    if (opponentFleetSunk) {
      // Player won - send GAME_OVER to opponent
      setState('GAME_OVER');
      // TODO: Send GAME_OVER message to opponent
      recordGame({
        outcome: 'victory',
        hits: 0,
        misses: 0,
        enemyShipsSunk: [],
        playerShipsLost: [],
      });
    }
  }, [bleState, opponentFields, isFleetSunk, setState]);

  // Handle incoming GAME_OVER message
  const handleRemoteGameOver = useCallback(() => {
    setState('GAME_OVER');
    // Player lost - record loss
    recordGame({ outcome: 'defeat', hits: 0, misses: 0, enemyShipsSunk: [], playerShipsLost: [] });
  }, [setState]);

  // Handle rematch request
  const [rematchSent, setRematchSent] = useState(false);

  const handleRematchRequest = useCallback(() => {
    setRematchSent(true);
    // TODO: Send REMATCH message to opponent
  }, []);

  // Handle incoming REMATCH message
  const handleRemoteRematch = useCallback(() => {
    if (rematchSent) {
      // Both players requested rematch - transition to PLACEMENT
      setRematchSent(false);
      setLocalFleetReady(false);
      setRemoteFleetReady(false);
      setState('PLACEMENT');
    }
  }, [rematchSent, setState, setLocalFleetReady, setRemoteFleetReady]);

  // Handle disconnect/BYE message
  const handleDisconnect = useCallback(() => {
    setState('IDLE');
    setRematchSent(false);
    setLocalFleetReady(false);
    setRemoteFleetReady(false);
  }, [setState, setLocalFleetReady, setRemoteFleetReady]);

  // Handle opponent grid state
  const isOpponentGridActive = useCallback(() => {
    // Opponent grid is active and targetable only in BATTLE state on player's turn
    return bleState === 'BATTLE' && remoteFleetReady && turn === 'player' && !awaitingShotResult;
  }, [bleState, remoteFleetReady, turn, awaitingShotResult]);

  const recordGame = useStatsStore(s => s.recordGame);

  return {
    handleFireAtWill,
    handleRemoteFleetReady,
    handlePlayerFire,
    handleRemoteFire,
    handleShotResult,
    handleCheckGameOver,
    handleRemoteGameOver,
    handleRematchRequest,
    handleRemoteRematch,
    handleDisconnect,
    isOpponentGridActive,
    isMultiplayerMode: mode === 'ble',
    localFleetReady,
    remoteFleetReady,
    awaitingShotResult,
    rematchSent,
    serializeFleet,
  };
}
