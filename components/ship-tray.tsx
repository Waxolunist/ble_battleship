import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS } from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import type { ShipType } from "@/models/types";
import { SHIP_FLEET, SHIP_SIZES } from "@/models/types";
import {
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const CELL_SIZE = 28;
const CELL_GAP = 2;

const SHIP_IMAGES: Partial<Record<ShipType, ImageSourcePropType>> = {
  Carrier: require("@/assets/images/carrier.png"),
  Submarine: require("@/assets/images/submarine.png"),
  Destroyer: require("@/assets/images/destroyer.png"),
};

function SpriteCell({
  image,
  index,
  totalCells,
}: {
  image: ImageSourcePropType;
  index: number;
  totalCells: number;
}) {
  const totalWidth = totalCells * CELL_SIZE + (totalCells - 1) * CELL_GAP;
  const offsetX = index * (CELL_SIZE + CELL_GAP);
  return (
    <View style={styles.cell}>
      <Image
        source={image}
        style={[styles.spriteImage, { width: totalWidth, left: -offsetX }]}
        resizeMode="stretch"
      />
      <View style={styles.cellTileOverlay} />
    </View>
  );
}

interface ShipRowProps {
  type: ShipType;
  isPlaced: boolean;
  orientation: "horizontal" | "vertical";
  onOrientationToggle: () => void;
  onDragStart: (x: number, y: number) => void;
  onDragging: (x: number, y: number) => void;
  onDragEnd: (x: number, y: number) => void;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
}

function ShipRow({
  type,
  isPlaced,
  orientation,
  onOrientationToggle,
  onDragStart,
  onDragging,
  onDragEnd,
  dragX,
  dragY,
}: ShipRowProps) {
  const size = SHIP_SIZES[type];
  const image = SHIP_IMAGES[type];

  const pan = Gesture.Pan()
    .enabled(!isPlaced)
    .minDistance(4)
    .onStart((e) => {
      dragX.value = e.absoluteX;
      dragY.value = e.absoluteY;
      runOnJS(onDragStart)(e.absoluteX, e.absoluteY);
    })
    .onUpdate((e) => {
      dragX.value = e.absoluteX;
      dragY.value = e.absoluteY;
      runOnJS(onDragging)(e.absoluteX, e.absoluteY);
    })
    .onEnd((e) => {
      runOnJS(onDragEnd)(e.absoluteX, e.absoluteY);
    });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.shipRow, isPlaced && styles.shipRowPlaced]}>
        {/* Orientation toggle */}
        <Pressable
          onPress={isPlaced ? undefined : onOrientationToggle}
          style={[styles.rotateButton, isPlaced && styles.rotateButtonPlaced]}
          hitSlop={6}
        >
          <Text style={styles.rotateIcon}>{orientation === "horizontal" ? "↔" : "↕"}</Text>
        </Pressable>

        <Text numberOfLines={1} style={[styles.shipLabel, isPlaced && styles.shipLabelPlaced]}>
          {type.toUpperCase()}
        </Text>

        <View style={styles.cells}>
          {Array.from({ length: size }).map((_, i) =>
            image ? (
              <SpriteCell key={i} image={image} index={i} totalCells={size} />
            ) : (
              <View key={i} style={[styles.cell, styles.cellSolid, isPlaced && styles.cellPlaced]} />
            )
          )}
        </View>

        <Text style={[styles.placedBadge, !isPlaced && styles.placedBadgeHidden]}>✓</Text>
      </Animated.View>
    </GestureDetector>
  );
}

export interface ShipTrayProps {
  placedShips: Set<ShipType>;
  orientations: Record<ShipType, "horizontal" | "vertical">;
  onOrientationToggle: (ship: ShipType) => void;
  onDragStart: (ship: ShipType, x: number, y: number) => void;
  onDragging: (x: number, y: number) => void;
  onDragEnd: (x: number, y: number) => void;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
}

export function ShipTray({
  placedShips,
  orientations,
  onOrientationToggle,
  onDragStart,
  onDragging,
  onDragEnd,
  dragX,
  dragY,
}: ShipTrayProps) {
  return (
    <View style={styles.tray}>
      <Text style={styles.trayTitle}>FLEET</Text>
      <View style={styles.shipList}>
        {SHIP_FLEET.map((type) => (
          <ShipRow
            key={type}
            type={type}
            isPlaced={placedShips.has(type)}
            orientation={orientations[type]}
            onOrientationToggle={() => onOrientationToggle(type)}
            onDragStart={(x, y) => onDragStart(type, x, y)}
            onDragging={onDragging}
            onDragEnd={onDragEnd}
            dragX={dragX}
            dragY={dragY}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tray: {
    borderWidth: 1,
    borderColor: "rgba(80, 160, 255, 0.35)",
    borderRadius: 4,
    backgroundColor: "rgba(8, 25, 70, 0.75)",
    paddingHorizontal: 12,
    paddingVertical: 16,
    gap: 10,
  },
  trayTitle: {
    color: "rgba(180, 210, 255, 0.8)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 3,
    textAlign: "center",
  },
  shipList: {
    gap: 8,
  },
  shipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  shipRowPlaced: {
    opacity: 0.45,
  },
  rotateButton: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "rgba(80, 160, 255, 0.5)",
    backgroundColor: "rgba(30, 60, 140, 0.6)",
  },
  rotateButtonPlaced: {
    borderColor: "rgba(80, 160, 255, 0.2)",
  },
  rotateIcon: {
    color: "rgba(180, 210, 255, 0.9)",
    fontSize: 11,
    lineHeight: 14,
  },
  shipLabel: {
    color: "rgba(180, 210, 255, 0.65)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    width: 100,
  },
  shipLabelPlaced: {
    color: "rgba(180, 210, 255, 0.35)",
  },
  cells: {
    flexDirection: "row",
    gap: CELL_GAP,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "rgba(80, 160, 255, 0.5)",
    overflow: "hidden",
  },
  cellSolid: {
    backgroundColor: "rgba(80, 140, 240, 0.75)",
  },
  cellPlaced: {
    backgroundColor: "rgba(60, 110, 180, 0.4)",
  },
  spriteImage: {
    position: "absolute",
    top: 0,
    height: CELL_SIZE,
  },
  cellTileOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(30, 60, 130, 0.25)",
  },
  placedBadge: {
    color: "rgba(80, 210, 120, 0.9)",
    fontSize: 14,
    fontWeight: "800",
    marginLeft: 4,
    width: 18,
  },
  placedBadgeHidden: {
    opacity: 0,
  },
});
