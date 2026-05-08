import { PropsWithChildren, useEffect } from "react";
import { StyleProp, ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  Easing,
} from "react-native-reanimated";

type Props = PropsWithChildren<{
  delay?: number;
  translateY?: number;
  scale?: number;
  style?: StyleProp<ViewStyle>;
}>;

export function FadeIn({ children, delay = 0, translateY, scale, style }: Props) {
  const opacity = useSharedValue(0);
  const animTranslateY = useSharedValue(translateY ?? 0);
  const animScale = useSharedValue(scale ?? 1);

  useEffect(() => {
    const easing = Easing.out(Easing.cubic);
    opacity.value = withDelay(delay, withTiming(1, { duration: 500, easing }));
    if (translateY !== undefined) {
      animTranslateY.value = withDelay(delay, withSpring(0, { damping: 10, stiffness: 80 }));
    }
    if (scale !== undefined) {
      animScale.value = withDelay(delay, withSpring(1, { damping: 12, stiffness: 100 }));
    }
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: animTranslateY.value },
      { scale: animScale.value },
    ],
  }));

  return <Animated.View style={[animStyle, style]}>{children}</Animated.View>;
}
