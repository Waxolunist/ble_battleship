import { useCallback, useEffect } from 'react';
import { useBLEStore, type FleetPlacement } from '@/store/useBLEStore';
import { useGameStore } from '@/store/useGameStore';
import type { ShipType } from '@/models/types';

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
  const { fields, setTurn, startBattle } = useGameStore();

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

  // Handle opponent grid state
  const isOpponentGridActive = useCallback(() => {
    // Opponent grid is active and targetable only in BATTLE state
    return bleState === 'BATTLE' && remoteFleetReady;
  }, [bleState, remoteFleetReady]);

  return {
    handleFireAtWill,
    handleRemoteFleetReady,
    isOpponentGridActive,
    isMultiplayerMode: mode === 'ble',
    localFleetReady,
    remoteFleetReady,
    serializeFleet,
  };
}
