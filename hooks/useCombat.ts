import { pickAiTarget } from "@/engine/ai";
import { useGameStore } from "@/store/useGameStore";
import { useCallback, useEffect } from "react";

export function useCombat(): { onPlayerFire: (x: number, y: number) => void } {
  const turn = useGameStore((s) => s.turn);
  const markTargeted = useGameStore((s) => s.markTargeted);
  const resolveShot = useGameStore((s) => s.resolveShot);
  const setTurn = useGameStore((s) => s.setTurn);

  const onPlayerFire = useCallback(
    (x: number, y: number) => {
      if (useGameStore.getState().opponentFields[y][x].status !== "empty") return;

      markTargeted("opponent", x, y);
      setTimeout(() => {
        resolveShot("opponent", x, y);
        setTurn("enemy");
      }, 500);
    },
    [markTargeted, resolveShot, setTurn],
  );

  useEffect(() => {
    if (turn !== "enemy") return;

    const target = pickAiTarget(useGameStore.getState().fields);
    if (!target) return;

    const { x, y } = target;

    const t1 = setTimeout(() => {
      markTargeted("player", x, y);

      const t2 = setTimeout(() => {
        resolveShot("player", x, y);
        setTurn("player");
      }, 500);

      return () => clearTimeout(t2);
    }, 800);

    return () => clearTimeout(t1);
  }, [turn, markTargeted, resolveShot, setTurn]);

  return { onPlayerFire };
}
