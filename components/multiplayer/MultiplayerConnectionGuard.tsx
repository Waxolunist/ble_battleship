import { multiplayerService } from '@/services/multiplayer';
import { useMultiplayerStore } from '@/store/useMultiplayerStore';
import { useGameStore } from '@/store/useGameStore';
import { useRouter } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

interface GuardContext {
  requestRematch: () => void;
  cancelRematch: () => void;
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

  // Peer is gone — either deliberately (BYE) or by losing the link. Alert once
  // and head home; the ref keeps the socket close that follows a BYE from
  // raising a second, misleading "connection lost".
  const peerGoneRef = useRef(false);

  const leaveMatch = useCallback(
    (title: string, message: string) => {
      if (peerGoneRef.current) return;
      peerGoneRef.current = true;
      setRematchPending(false);
      peerRequestedRef.current = false;
      localRequestedRef.current = false;
      Alert.alert(title, message);
      reset();
      router.replace('/');
    },
    [reset, router],
  );

  // Disconnect / out-of-range: alert then home.
  useEffect(() => {
    multiplayerService.setOnDisconnect(() => {
      leaveMatch(t('multiplayer.connectionLost'), t('multiplayer.connectionLostMessage'));
    });
    return () => multiplayerService.setOnDisconnect(null);
  }, [t, leaveMatch]);

  // Peer left deliberately — retreated during placement, or made port after
  // the game ended.
  useEffect(() => {
    return multiplayerService.onMessage(message => {
      if (message.type !== 'BYE') return;
      leaveMatch(t('multiplayer.opponentLeft'), t('multiplayer.opponentLeftMessage'));
    });
  }, [t, leaveMatch]);

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

  // Peer withdrew. Forgetting their request is the whole point: leave it
  // standing and our own Play Again would satisfy a pairing of one and drop us
  // into a battle the peer is not in.
  useEffect(() => {
    return multiplayerService.onMessage(message => {
      if (message.type !== 'REMATCH_CANCEL') return;
      peerRequestedRef.current = false;
    });
  }, []);

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

  const cancelRematch = useCallback(() => {
    localRequestedRef.current = false;
    setRematchPending(false);
    multiplayerService.sendMessage({ type: 'REMATCH_CANCEL' }).catch(err => {
      // Nothing to roll back: we are out of the pairing either way, and a peer
      // that missed this still cannot start a battle without our REMATCH.
      console.error('[MultiplayerConnectionGuard] REMATCH_CANCEL send failed:', err);
    });
  }, []);

  return (
    <MultiplayerGuardContext.Provider value={{ requestRematch, cancelRematch, rematchPending }}>
      {children}
    </MultiplayerGuardContext.Provider>
  );
}
