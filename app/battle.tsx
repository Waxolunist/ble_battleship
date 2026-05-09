import { useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ImageBackground, StyleSheet, Text, View } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from "react-native-reanimated";
import { FadeIn } from "@/components/fade-in";
import { GameField } from "@/components/game-field";
import { HapticPressable } from "@/components/haptic-pressable";
import { ShipTray } from "@/components/ship-tray";
import { createGameField } from "@/models/game-factory";
import type { Player } from "@/models/types";

const PLAYER: Player = { id: "1", name: "CAPTAIN", isAI: false };

export default function BattleScreen() {
  const router = useRouter();
  const navigation = useNavigation();

  const [gameField] = useState(() => createGameField(PLAYER));

  const screenTranslateY = useSharedValue(0);

  const handleRetreat = () => {
    navigation.setOptions({ animation: "none" });
    screenTranslateY.value = withTiming(-1000, { duration: 350, easing: Easing.in(Easing.cubic) });
    setTimeout(() => router.back(), 350);
  };

  const screenStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: screenTranslateY.value }],
  }));

  return (
    <Animated.View style={[styles.background, screenStyle]}>
      <ImageBackground
        source={require("@/assets/images/bg.jpeg")}
        style={styles.background}
        resizeMode="cover"
      >
        <Animated.View style={[StyleSheet.absoluteFill, styles.overlay]} />

        <View style={styles.content}>
          {/* Top: Title & subtitle */}
          <FadeIn translateY={-30}>
            <View style={styles.topSection}>
              <Text style={styles.title}>⚔ BATTLE STATION ⚔</Text>
              <Text style={styles.subtitle}>PLACE YOUR FLEET, CAPTAIN</Text>
            </View>
          </FadeIn>

          {/* Center: Game field + ship tray */}
          <FadeIn delay={250} scale={0.9}>
            <View style={styles.fieldSection}>
              <GameField fields={gameField.fields} />
              <ShipTray />
            </View>
          </FadeIn>

          {/* Bottom: Retreat button */}
          <FadeIn delay={500} translateY={30}>
            <HapticPressable
              onPress={handleRetreat}
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && styles.cancelButtonPressed,
              ]}
            >
              <Text style={styles.cancelButtonText}>↩ RETREAT</Text>
            </HapticPressable>
          </FadeIn>
        </View>
      </ImageBackground>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  overlay: {
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 64,
    paddingBottom: 48,
    paddingHorizontal: 32,
  },
  fieldSection: {
    gap: 16,
    alignItems: "center",
  },
  topSection: {
    alignItems: "center",
    gap: 8,
  },
  title: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 4,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 3,
    textAlign: "center",
  },
  cancelButton: {
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  cancelButtonPressed: {
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  cancelButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 3,
    textAlign: "center",
  },
});
