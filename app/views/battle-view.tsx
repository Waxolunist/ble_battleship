import { GameField } from "@/components/game-field";
import type { Field } from "@/models/types";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, FadeInDown, LinearTransition } from "react-native-reanimated";

export type BattleViewProps = {
  fields: Field[][];
  opponentFields: Field[][];
  showOpponentField: boolean;
};

export function BattleView({ fields, opponentFields, showOpponentField }: BattleViewProps) {
  return (
    <View style={styles.battleContent}>
      <Animated.View style={styles.fieldSection} layout={LinearTransition.duration(500).easing(Easing.out(Easing.cubic))}>
        <GameField fields={fields} />
        {showOpponentField && (
          <Animated.View
            entering={FadeInDown.duration(500).easing(Easing.out(Easing.cubic))}
          >
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ENEMY WATERS</Text>
              <View style={styles.dividerLine} />
            </View>
            <GameField fields={opponentFields} tint="rgba(255, 80, 80, 0.35)" />
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
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  dividerText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 3,
  },
});
