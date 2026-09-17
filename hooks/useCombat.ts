import { GameColors } from '@/constants/theme';
import type { Opponent } from '@/models/opponent';
import type { ShotPhase } from '@/models/types';
import { playSound, preloadSounds } from '@/services/audio';
import { useGameStore } from '@/store/useGameStore';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useCombat(opponent: Opponent): {
  onPlayerFire: (x: number, y: number) => void;
  shotPhase: ShotPhase;
} {
  const markTargeted = useGameStore(s => s.markTargeted);
  const resolveShot = useGameStore(s => s.resolveShot);
  const setTurn = useGameStore(s => s.setTurn);
  const [shotPhase, setShotPhase] = useState<ShotPhase>(null);
  const playerTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const enemyTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const isFiring = useRef(false);
  const isEnemyFiring = useRef(false);

  useEffect(() => {
    preloadSounds([
      'targetLock',
      'cannonFire',
      'incomingShell',
      'shotHit',
      'shotMiss',
      'shipSunk',
      'sonarPing',
    ]);
  }, []);

  const onPlayerFire = useCallback(
    (x: number, y: number) => {
      if (isFiring.current) return;
      if (useGameStore.getState().opponentFields[y][x].status !== 'empty') return;

      isFiring.current = true;
      playerTimers.current.forEach(clearTimeout);
      playerTimers.current = [];

      // Beat 1 — Locked (0 ms): targeting reticle + low haptic
      markTargeted('opponent', x, y);
      setShotPhase({ x, y, grid: 'opponent', beat: 'locked', reticleColor: GameColors.gold });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      playSound('targetLock');

      // Beat 2 — Impact (200 ms): screen shake + heavy haptic
      const t1 = setTimeout(() => {
        setShotPhase({ x, y, grid: 'opponent', beat: 'impact', reticleColor: GameColors.gold });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        playSound('cannonFire');
      }, 200);

      // Beat 3 — Verdict (450 ms): resolve via opponent, show result
      const t2 = setTimeout(async () => {
        const result = await opponent.resolvePlayerShot(x, y);
        setShotPhase({
          x,
          y,
          grid: 'opponent',
          beat: 'verdict',
          result,
          reticleColor: GameColors.gold,
        });
        const hapticStyle =
          result === 'sunk'
            ? Haptics.ImpactFeedbackStyle.Heavy
            : result === 'hit'
              ? Haptics.ImpactFeedbackStyle.Medium
              : Haptics.ImpactFeedbackStyle.Light;
        Haptics.impactAsync(hapticStyle).catch(() => {});
        playSound(result === 'sunk' ? 'shipSunk' : result === 'hit' ? 'shotHit' : 'shotMiss');
      }, 450);

      // Clear phase and hand off to enemy (900 ms total)
      const t3 = setTimeout(() => {
        setShotPhase(null);
        isFiring.current = false;
        setTurn('enemy');
      }, 900);

      playerTimers.current = [t1, t2, t3];
    },
    [markTargeted, setTurn, opponent],
  );

  // Enemy-shot subscription. The opponent invokes the handler when the enemy
  // takes a shot (AI: when turn flips; BLE: when a FIRE message arrives).
  useEffect(() => {
    const handler = (x: number, y: number) => {
      if (isEnemyFiring.current) return;
      isEnemyFiring.current = true;
      enemyTimers.current.forEach(clearTimeout);
      enemyTimers.current = [];

      // Beat 1 — Locked (400 ms delay, then reticle + light haptic)
      const t1 = setTimeout(() => {
        markTargeted('player', x, y);
        setShotPhase({ x, y, grid: 'player', beat: 'locked', reticleColor: GameColors.red });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        playSound('incomingShell');
      }, 400);

      // Beat 2 — Impact (550 ms)
      const t2 = setTimeout(() => {
        setShotPhase({ x, y, grid: 'player', beat: 'impact', reticleColor: GameColors.red });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      }, 550);

      // Beat 3 — Verdict (750 ms)
      const t3 = setTimeout(() => {
        resolveShot('player', x, y);
        const field = useGameStore.getState().fields[y][x];
        const result: 'hit' | 'miss' | 'sunk' =
          field.status === 'sunk' ? 'sunk' : field.status === 'hit' ? 'hit' : 'miss';
        setShotPhase({
          x,
          y,
          grid: 'player',
          beat: 'verdict',
          result,
          reticleColor: GameColors.red,
        });
        const hapticStyle =
          result === 'sunk'
            ? Haptics.ImpactFeedbackStyle.Heavy
            : result === 'hit'
              ? Haptics.ImpactFeedbackStyle.Medium
              : Haptics.ImpactFeedbackStyle.Light;
        Haptics.impactAsync(hapticStyle).catch(() => {});
        playSound(result === 'sunk' ? 'shipSunk' : result === 'hit' ? 'shotHit' : 'shotMiss');
        opponent.reportEnemyShotResolution(x, y, result);
      }, 750);

      // Clear phase and return turn to player (1100 ms total)
      const t4 = setTimeout(() => {
        setShotPhase(null);
        isEnemyFiring.current = false;
        setTurn('player');
        // Silence the hand-back ping once the fleet is gone — the defeat
        // sequence owns the audio from here.
        const fleetAlive = useGameStore
          .getState()
          .fields.some(row => row.some(f => f.shipPart && f.status !== 'sunk'));
        if (fleetAlive) playSound('sonarPing');
      }, 1100);

      enemyTimers.current = [t1, t2, t3, t4];
    };

    const unsubscribe = opponent.onEnemyShot(handler);
    return () => {
      unsubscribe();
      enemyTimers.current.forEach(clearTimeout);
      enemyTimers.current = [];
    };
  }, [opponent, markTargeted, resolveShot, setTurn]);

  return { onPlayerFire, shotPhase };
}
