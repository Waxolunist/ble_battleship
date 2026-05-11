import { GameField } from "@/components/game-field";
import type { Field } from "@/models/types";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  LinearTransition,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

export type BattleViewProps = {
  fields: Field[][];
  opponentFields: Field[][];
  showOpponentField: boolean;
  turn: "player" | "enemy";
  onEnemyCellPress?: (x: number, y: number) => void;
};

export function BattleView({
  fields,
  opponentFields,
  showOpponentField,
  turn,
  onEnemyCellPress,
}: BattleViewProps) {
  // 0 = player's turn, 1 = enemy's turn — transitions smoothly on change
  const turnSV = useSharedValue(0);
  // Shared pulse oscillator for the glow borders and divider lines
  const glowPulse = useSharedValue(0.4);
  const dividerPulse = useSharedValue(0.25);

  useEffect(() => {
    glowPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.35, { duration: 800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    dividerPulse.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 700, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.2, { duration: 700, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, []);

  useEffect(() => {
    turnSV.value = withTiming(turn === "player" ? 0 : 1, { duration: 400 });
  }, [turn]);

  // Active grid is full opacity; inactive grid dims
  const playerFieldStyle = useAnimatedStyle(() => ({
    opacity: interpolate(turnSV.value, [0, 1], [0.55, 1]),
  }));
  const enemyFieldStyle = useAnimatedStyle(() => ({
    opacity: interpolate(turnSV.value, [0, 1], [1, 0.55]),
  }));

  // Gold glow on enemy grid (player's turn), red glow on player grid (enemy's turn)
  const enemyGlowStyle = useAnimatedStyle(() => ({
    opacity: (1 - turnSV.value) * glowPulse.value,
  }));
  const playerGlowStyle = useAnimatedStyle(() => ({
    opacity: turnSV.value * glowPulse.value,
  }));

  const dividerLineStyle = useAnimatedStyle(() => ({
    opacity: dividerPulse.value,
  }));

  const isPlayerTurn = turn === "player";
  const dividerText = isPlayerTurn ? "SELECT TARGET" : "INCOMING FIRE";
  const dividerColor = isPlayerTurn ? "#FFC832" : "#FF5050";

  return (
    <View style={styles.battleContent}>
      <Animated.View
        style={styles.fieldSection}
        layout={LinearTransition.duration(500).easing(Easing.out(Easing.cubic))}
      >
        {/* Player grid — dims on player's turn, glows red on enemy's turn */}
        <Animated.View style={[styles.gridWrapper, playerFieldStyle]}>
          <GameField fields={fields} />
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.glowBorder,
              { borderColor: "#FF5050" },
              playerGlowStyle,
            ]}
            pointerEvents="none"
          />
        </Animated.View>

        {showOpponentField && (
          <Animated.View
            entering={FadeInDown.duration(500).easing(Easing.out(Easing.cubic))}
          >
            {/* Divider — swaps text and color with each turn */}
            <View style={styles.divider}>
              <Animated.View
                style={[
                  styles.dividerLine,
                  dividerLineStyle,
                  { backgroundColor: dividerColor },
                ]}
              />
              <Text style={[styles.dividerText, { color: dividerColor }]}>
                {dividerText}
              </Text>
              <Animated.View
                style={[
                  styles.dividerLine,
                  dividerLineStyle,
                  { backgroundColor: dividerColor },
                ]}
              />
            </View>

            {/* Enemy grid — glows gold on player's turn, dims on enemy's turn */}
            <Animated.View style={[styles.gridWrapper, enemyFieldStyle]}>
              <GameField
                fields={opponentFields}
                tint="rgba(255, 80, 80, 0.35)"
                hideShips
                onCellPress={turn === "player" ? onEnemyCellPress : undefined}
              />
              <Animated.View
                style={[
                  StyleSheet.absoluteFill,
                  styles.glowBorder,
                  { borderColor: "#FFC832" },
                  enemyGlowStyle,
                ]}
                pointerEvents="none"
              />
            </Animated.View>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  battleContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  fieldSection: {
    gap: 16,
    alignItems: "center",
  },
  gridWrapper: {
    alignSelf: "center",
  },
  glowBorder: {
    borderWidth: 2,
    borderRadius: 4,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 3,
  },
});
