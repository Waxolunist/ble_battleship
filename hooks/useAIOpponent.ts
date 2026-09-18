import { pickAiTarget } from '@/engine/ai';
import { tryRandomPlacement } from '@/engine/placement';
import { createGameField } from '@/models/game-factory';
import type { Opponent, PreparedBattle, ShotResult } from '@/models/opponent';
import type { Field } from '@/models/types';
import { useGameStore } from '@/store/useGameStore';
import { useCallback, useEffect, useMemo, useRef } from 'react';

const AI_PLAYER = { id: '2', name: 'ENEMY', isAI: true };

// A human opponent spends time choosing a cell, and the BLE round trip adds
// more on top. The AI decides instantly, so its shot would otherwise tread on
// the heels of the player's own verdict. This pause stands in for taking aim,
// and the spread keeps consecutive turns from feeling metronomic.
const AI_AIM_MIN_MS = 900;
const AI_AIM_MAX_MS = 1600;

function makeAIOpponentFields(): Field[][] {
  const result = tryRandomPlacement(createGameField(AI_PLAYER).fields);
  return result ? result.fields : createGameField(AI_PLAYER).fields;
}

export function useAIOpponent(): Opponent {
  const turn = useGameStore(s => s.turn);
  const enemyShotHandlerRef = useRef<((x: number, y: number) => void) | null>(null);

  // When turn flips to enemy, take aim for a beat, then pick a target and
  // dispatch it to the subscriber. Leaving the turn cancels the pending shot.
  useEffect(() => {
    if (turn !== 'enemy') return;
    const handler = enemyShotHandlerRef.current;
    if (!handler) return;

    const delay = AI_AIM_MIN_MS + Math.random() * (AI_AIM_MAX_MS - AI_AIM_MIN_MS);
    const timer = setTimeout(() => {
      const target = pickAiTarget(useGameStore.getState().fields);
      if (!target) return;
      handler(target.x, target.y);
    }, delay);

    return () => clearTimeout(timer);
  }, [turn]);

  const resolvePlayerShot = useCallback(async (x: number, y: number): Promise<ShotResult> => {
    useGameStore.getState().resolveShot('opponent', x, y);
    const field = useGameStore.getState().opponentFields[y][x];
    return field.status === 'sunk' ? 'sunk' : field.status === 'hit' ? 'hit' : 'miss';
  }, []);

  const onEnemyShot = useCallback((handler: (x: number, y: number) => void) => {
    enemyShotHandlerRef.current = handler;
    return () => {
      if (enemyShotHandlerRef.current === handler) {
        enemyShotHandlerRef.current = null;
      }
    };
  }, []);

  const reportEnemyShotResolution = useCallback(() => {
    // AI is authoritative locally; nothing to report upstream.
  }, []);

  const prepareBattle = useCallback(async (): Promise<PreparedBattle> => {
    return { opponentFields: makeAIOpponentFields(), firstTurn: 'player' };
  }, []);

  const notifyGameOver = useCallback(() => {
    // No remote peer to notify.
  }, []);

  const onGameOver = useCallback(() => {
    return () => {};
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
