import { useCallback, useEffect } from 'react';
import { useBLEStore } from '@/store/useBLEStore';
import { useGameStore } from '@/store/useGameStore';

/**
 * Hook that bridges BLE events to game store actions.
 * Manages the multiplayer game lifecycle when in BLE mode.
 */
export function useBLEGame() {
  const { state: bleState, mode, localFleetReady, setLocalFleetReady } = useBLEStore();
  const { placedShips, setTurn } = useGameStore();

  // Initialize multiplayer game session
  const startMultiplayerGame = useCallback(() => {
    // Game mode is set to 'ble' in the store
    // useGameStore will render normally without AI fleet pre-placement
  }, []);

  // Listen for "Fire at Will" tap in placement phase
  const markFleetReady = useCallback(() => {
    setLocalFleetReady(true);
    // In Task 8, this will send FLEET_READY message
    // For now, just set the local flag
  }, [setLocalFleetReady]);

  // Handle opponent grid state
  const isOpponentGridActive = useCallback(() => {
    // Opponent grid is empty and untargetable until Task 8 (FLEET_READY exchange)
    return bleState === 'BATTLE';
  }, [bleState]);

  return {
    startMultiplayerGame,
    markFleetReady,
    isOpponentGridActive,
    isMultiplayerMode: mode === 'ble',
    localFleetReady,
  };
}
