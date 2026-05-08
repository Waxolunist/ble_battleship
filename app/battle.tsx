import { useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { ImageBackground, StyleSheet, Text } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from "react-native-reanimated";
import { FadeIn } from "@/components/fade-in";
import { HapticPressable } from "@/components/haptic-pressable";

export default function BattleScreen() {
  const router = useRouter();
  const navigation = useNavigation();

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
        <Animated.View style={styles.content}>
          <FadeIn translateY={-40}>
            <Animated.Text style={styles.title}>⚔ BATTLE STATION ⚔</Animated.Text>
          </FadeIn>
          <FadeIn delay={300} scale={0.85}>
            <Animated.Text style={styles.subtitle}>
              HOLD THE LINE, CAPTAIN.{"\n"}THE ENEMY APPROACHES.
            </Animated.Text>
          </FadeIn>
          <FadeIn delay={600} translateY={30}>
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
        </Animated.View>
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
    justifyContent: "center",
    gap: 24,
    paddingHorizontal: 32,
  },
  title: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 4,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: 2,
    textAlign: "center",
    lineHeight: 28,
  },
  cancelButton: {
    marginTop: 48,
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
