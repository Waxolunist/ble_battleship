import { FadeIn } from "@/components/fade-in";
import { GameField } from "@/components/game-field";
import { HapticPressable } from "@/components/haptic-pressable";
import { ShipTray } from "@/components/ship-tray";
import type { Field, ShipType } from "@/models/types";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import type { AnimatedStyle, SharedValue } from "react-native-reanimated";

export type Orientation = "horizontal" | "vertical";

export type PlacementViewProps = {
  fireTopStyle: AnimatedStyle<ViewStyle>;
  fireBottomStyle: AnimatedStyle<ViewStyle>;
  playerFieldAnimStyle: AnimatedStyle<ViewStyle>;
  fields: Field[][];
  placedShips: Set<ShipType>;
  orientations: Record<ShipType, Orientation>;
  allShipsPlaced: boolean;
  draggingShip: ShipType | null;
  previewCells: Set<string>;
  isPreviewValid: boolean;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  gridBodyRef: React.RefObject<View | null>;
  trayRef: React.RefObject<View | null>;
  onGridShipDragStart: (shipType: ShipType, pageX: number, pageY: number) => void;
  onDragging: (pageX: number, pageY: number) => void;
  onDragEnd: (pageX: number, pageY: number) => void;
  onOrientationToggle: (shipType: ShipType) => void;
  onDragStart: (shipType: ShipType, pageX: number, pageY: number) => void;
  onFireAtWill: () => void;
  onRetreat: () => void;
};

export function PlacementView({
  fireTopStyle,
  fireBottomStyle,
  playerFieldAnimStyle,
  fields,
  placedShips,
  orientations,
  allShipsPlaced,
  draggingShip,
  previewCells,
  isPreviewValid,
  dragX,
  dragY,
  gridBodyRef,
  trayRef,
  onGridShipDragStart,
  onDragging,
  onDragEnd,
  onOrientationToggle,
  onDragStart,
  onFireAtWill,
  onRetreat,
}: PlacementViewProps) {
  return (
    <View style={styles.content}>
      {/* Top: Title & subtitle */}
      <Animated.View style={fireTopStyle}>
        <FadeIn translateY={-30}>
          <View style={styles.topSection}>
            <Text style={styles.title}>⚔ BATTLE STATION ⚔</Text>
            <Text style={styles.subtitle}>PLACE YOUR FLEET, CAPTAIN</Text>
          </View>
        </FadeIn>
      </Animated.View>

      {/* Center: Player grid + ship tray */}
      <FadeIn delay={250} scale={0.9}>
        <View style={styles.fieldSection}>
          <Animated.View style={playerFieldAnimStyle}>
            <GameField
              ref={gridBodyRef}
              fields={fields}
              previewCells={previewCells}
              isPreviewValid={isPreviewValid}
              draggingShip={draggingShip}
              onShipDragStart={onGridShipDragStart}
              onShipDragging={onDragging}
              onShipDragEnd={onDragEnd}
              dragX={dragX}
              dragY={dragY}
            />
          </Animated.View>
          <Animated.View style={fireBottomStyle}>
            <ShipTray
              ref={trayRef}
              placedShips={placedShips}
              orientations={orientations}
              onOrientationToggle={onOrientationToggle}
              onDragStart={onDragStart}
              onDragging={onDragging}
              onDragEnd={onDragEnd}
              dragX={dragX}
              dragY={dragY}
            />
          </Animated.View>
        </View>
      </FadeIn>

      {/* Bottom: Retreat + Fire at Will buttons */}
      <Animated.View style={[{ alignSelf: "stretch" }, fireBottomStyle]}>
        <FadeIn delay={500} translateY={30} style={{ alignSelf: "stretch" }}>
          <View style={styles.bottomButtons}>
            <HapticPressable
              onPress={onRetreat}
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && styles.cancelButtonPressed,
              ]}
            >
              <Text style={styles.cancelButtonText} numberOfLines={2}>
                ↩{"\n"}RETREAT
              </Text>
            </HapticPressable>
            <HapticPressable
              disabled={!allShipsPlaced}
              onPress={onFireAtWill}
              style={({ pressed }) => [
                styles.fireButton,
                !allShipsPlaced && styles.fireButtonDisabled,
                pressed && allShipsPlaced && styles.fireButtonPressed,
              ]}
            >
              <Text
                style={[
                  styles.fireButtonText,
                  !allShipsPlaced && styles.fireButtonTextDisabled,
                ]}
                numberOfLines={2}
              >
                 ⚡{"\n"}FIRE AT WILL
              </Text>
            </HapticPressable>
          </View>
        </FadeIn>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 64,
    paddingBottom: 48,
    paddingHorizontal: 32,
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
  fieldSection: {
    gap: 16,
    alignItems: "center",
  },
  bottomButtons: {
    flexDirection: "row",
    alignSelf: "stretch",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingHorizontal: 4,
    paddingVertical: 8,
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
    lineHeight: 26,
    textAlign: "center",
  },
  fireButton: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: "#e8c84a",
    borderRadius: 4,
    backgroundColor: "rgba(232,200,74,0.15)",
  },
  fireButtonDisabled: {
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  fireButtonPressed: {
    backgroundColor: "rgba(232,200,74,0.35)",
  },
  fireButtonText: {
    color: "#e8c84a",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 3,
    lineHeight: 26,
    textAlign: "center",
  },
  fireButtonTextDisabled: {
    color: "rgba(255,255,255,0.25)",
  },
});
