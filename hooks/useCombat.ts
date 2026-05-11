import { pickAiTarget } from '@/engine/ai';
import type { ShotPhase } from '@/models/types';
import { useGameStore } from '@/store/useGameStore';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useCombat(): {
  onPlayerFire: (x: number, y: number) => void;
  shotPhase: ShotPhase;
} {
  const turn = useGameStore(s => s.turn);
  const markTargeted = useGameStore(s => s.markTargeted);
  const resolveShot = useGameStore(s => s.resolveShot);
  const setTurn = useGameStore(s => s.setTurn);
  const [shotPhase, setShotPhase] = useState<ShotPhase>(null);
  const playerTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const isFiring = useRef(false);

  const onPlayerFire = useCallback(
    (x: number, y: number) => {
      if (isFiring.current) return;
      if (useGameStore.getState().opponentFields[y][x].status !== 'empty') return;

      isFiring.current = true;
      playerTimers.current.forEach(clearTimeout);
      playerTimers.current = [];

      // Beat 1 — Locked (0 ms): targeting reticle + low haptic
      markTargeted('opponent', x, y);
      setShotPhase({ x, y, grid: 'opponent', beat: 'locked', reticleColor: '#FFC832' });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      // Beat 2 — Impact (400 ms): screen shake + heavy haptic
      const t1 = setTimeout(() => {
        setShotPhase({ x, y, grid: 'opponent', beat: 'impact', reticleColor: '#FFC832' });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      }, 400);

      // Beat 3 — Verdict (900 ms): resolve shot, show result
      const t2 = setTimeout(() => {
        resolveShot('opponent', x, y);
        const field = useGameStore.getState().opponentFields[y][x];
        const result: 'hit' | 'miss' | 'sunk' =
          field.status === 'sunk' ? 'sunk' : field.status === 'hit' ? 'hit' : 'miss';
        setShotPhase({ x, y, grid: 'opponent', beat: 'verdict', result, reticleColor: '#FFC832' });
        const hapticStyle =
          result === 'sunk'
            ? Haptics.ImpactFeedbackStyle.Heavy
            : result === 'hit'
              ? Haptics.ImpactFeedbackStyle.Medium
              : Haptics.ImpactFeedbackStyle.Light;
        Haptics.impactAsync(hapticStyle).catch(() => {});
      }, 900);

      // Clear phase and hand off to enemy (1800 ms total)
      const t3 = setTimeout(() => {
        setShotPhase(null);
        isFiring.current = false;
        setTurn('enemy');
      }, 1800);

      playerTimers.current = [t1, t2, t3];
    },
    [markTargeted, resolveShot, setTurn],
  );

  useEffect(() => {
    if (turn !== 'enemy') return;

    const target = pickAiTarget(useGameStore.getState().fields);
    if (!target) return;

    const { x, y } = target;

    // Beat 1 — Locked (800 ms delay, then reticle + light haptic)
    const t1 = setTimeout(() => {
      markTargeted('player', x, y);
      setShotPhase({ x, y, grid: 'player', beat: 'locked', reticleColor: '#FF5050' });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }, 800);

    // Beat 2 — Impact (800 + 300 = 1100 ms)
    const t2 = setTimeout(() => {
      setShotPhase({ x, y, grid: 'player', beat: 'impact', reticleColor: '#FF5050' });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }, 1100);

    // Beat 3 — Verdict (800 + 300 + 400 = 1500 ms)
    const t3 = setTimeout(() => {
      resolveShot('player', x, y);
      const field = useGameStore.getState().fields[y][x];
      const result: 'hit' | 'miss' | 'sunk' =
        field.status === 'sunk' ? 'sunk' : field.status === 'hit' ? 'hit' : 'miss';
      setShotPhase({ x, y, grid: 'player', beat: 'verdict', result, reticleColor: '#FF5050' });
      const hapticStyle =
        result === 'sunk'
          ? Haptics.ImpactFeedbackStyle.Heavy
          : result === 'hit'
            ? Haptics.ImpactFeedbackStyle.Medium
            : Haptics.ImpactFeedbackStyle.Light;
      Haptics.impactAsync(hapticStyle).catch(() => {});
    }, 1500);

    // Clear phase and return turn to player (1500 + 700 = 2200 ms total)
    const t4 = setTimeout(() => {
      setShotPhase(null);
      setTurn('player');
    }, 2200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [turn, markTargeted, resolveShot, setTurn]);

  return { onPlayerFire, shotPhase };
}
