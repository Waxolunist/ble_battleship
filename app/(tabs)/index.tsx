import { Image } from "expo-image";
import { useRef, useState } from "react";
import {
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { HapticPressable } from "@/components/haptic-pressable";

export default function HomeScreen() {
  const [name, setName] = useState("");
  const inputRef = useRef<TextInput>(null);

  const handleConfirm = () => {
    inputRef.current?.blur();
    Keyboard.dismiss();
  };

  return (
    <ImageBackground
      source={require("@/assets/images/bg.jpeg")}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        <Image
          source={require("@/assets/images/title.webp")}
          style={styles.title}
          contentFit="contain"
        />
        <View style={styles.nameContainer}>
          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={name}
              onChangeText={(text) => setName(text.toUpperCase())}
              autoCapitalize="characters"
              placeholder="ENTER YOUR NAME"
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
            />
            <HapticPressable
              onPress={handleConfirm}
              style={({ pressed }) => [
                styles.confirmButton,
                pressed && styles.confirmButtonPressed,
              ]}
            >
              <Text style={styles.checkmark}>✓</Text>
            </HapticPressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  content: {
    flex: 1,
    alignItems: "center",
    paddingTop: "15%",
    justifyContent: "space-between",
    paddingBottom: 60,
  },
  title: {
    width: "80%",
    aspectRatio: 0.8,
  },
  nameContainer: {
    width: "80%",
    alignItems: "center",
    gap: 8,
  },
  label: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  inputRow: {
    flexDirection: "row",
    width: "100%",
    gap: 8,
  },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.5)",
    borderRadius: 8,
    paddingHorizontal: 16,
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: 2,
    textAlign: "center",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  confirmButtonPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  confirmButton: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.5)",
    borderRadius: 8,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  checkmark: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
  },
});
