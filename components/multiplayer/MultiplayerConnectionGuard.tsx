import { multiplayerService } from '@/services/multiplayer';
import { useMultiplayerStore } from '@/store/useMultiplayerStore';
import { useGameStore } from '@/store/useGameStore';
import { useRouter } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

interface GuardContext {
  requestRematch: () => void;
  rematchPending: boolean;
}

const MultiplayerGuardContext = createContext<GuardContext | null>(null);

export function useMultiplayerGuard(): GuardContext {
  const ctx = useContext(MultiplayerGuardContext);
  if (!ctx) throw new Error('useMultiplayerGuard must be used inside MultiplayerConnectionGuard');
  return ctx;
}

export function MultiplayerConnectionGuard({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation('common');
  const router = useRouter();
  const reset = useMultiplayerStore(s => s.reset);
  const setState = useMultiplayerStore(s => s.setState);
  const setLocalFleetReady = useMultiplayerStore(s => s.setLocalFleetReady);
  const setRemoteFleetReady = useMultiplayerStore(s => s.setRemoteFleetReady);
  const setOpponentFleet = useMultiplayerStore(s => s.setOpponentFleet);
  const resetGame = useGameStore(s => s.resetGame);

  const [rematchPending, setRematchPending] = useState(false);

  // Refs track which side has already sent REMATCH — avoids a state-render race.
  const peerRequestedRef = useRef(false);
  const localRequestedRef = useRef(false);

  const startNewBattle = useCallback(() => {
    peerRequestedRef.current = false;
    localRequestedRef.current = false;
    setRematchPending(false);
    // Clear fleet state so prepareBattle starts fresh on the next round.
    setState('PLACEMENT');
    setLocalFleetReady(false);
    setRemoteFleetReady(false);
    setOpponentFleet(null);
    resetGame();
    router.replace('/battle');
  }, [resetGame, router, setState, setLocalFleetReady, setRemoteFleetReady, setOpponentFleet]);

  // Disconnect / out-of-range: alert then home.
  useEffect(() => {
    multiplayerService.setOnDisconnect(() => {
      setRematchPending(false);
      peerRequestedRef.current = false;
      localRequestedRef.current = false;
      Alert.alert(t('ble.connectionLost'), t('ble.connectionLostMessage'));
      reset();
      router.replace('/');
    });
    return () => multiplayerService.setOnDisconnect(null);
  }, [t, reset, router]);

  // REMATCH from peer: if we already sent ours, kick off the new battle.
  useEffect(() => {
    return multiplayerService.onMessage(message => {
      if (message.type !== 'REMATCH') return;
      peerRequestedRef.current = true;
      if (localRequestedRef.current) {
        startNewBattle();
      }
    });
  }, [startNewBattle]);

  const requestRematch = useCallback(() => {
    localRequestedRef.current = true;
    setRematchPending(true);
    multiplayerService.sendMessage({ type: 'REMATCH' }).catch(err => {
      // Clear pending so the UI doesn't stay stuck on the waiting overlay.
      console.error('[MultiplayerConnectionGuard] REMATCH send failed:', err);
      localRequestedRef.current = false;
      setRematchPending(false);
    });
    // Peer may have already sent their REMATCH before we pressed Play Again.
    if (peerRequestedRef.current) {
      startNewBattle();
    }
  }, [startNewBattle]);

  return (
    <MultiplayerGuardContext.Provider value={{ requestRematch, rematchPending }}>
      {children}
    </MultiplayerGuardContext.Provider>
  );
}
