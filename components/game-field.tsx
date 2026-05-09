import { forwardRef } from "react";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS } from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { Image, ImageSourcePropType, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { Field, ShipPart, ShipType } from "@/models/types";
import { IMAGES } from "@/constants/assets";

const ROW_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
const COL_LABELS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
const GRID_SIZE = 10;
export const LABEL_SIZE = 22;
const GRID_PADDING = 32;
const GRID_CELL_GAP = 1; // gap between cells in the grid body

const SHIP_IMAGES: Partial<Record<ShipType, ImageSourcePropType>> = {
  Carrier: IMAGES.carrier,
  Submarine: IMAGES.submarine,
  Destroyer: IMAGES.destroyer,
};

// Within the grid body (padding:1, gap:1 between rows), field (x,y) starts at:
//   left = 1 (padding) + LABEL_SIZE + 1 (gap after label) + x*(cellSize+1)
//   top  = 1 (padding) + y*(cellSize+1)
export function computeCell(
  pageX: number,
  pageY: number,
  gridBodyAbsX: number,
  gridBodyAbsY: number,
  cellSize: number
): { x: number; y: number } {
  const relX = pageX - gridBodyAbsX - LABEL_SIZE - 2;
  const relY = pageY - gridBodyAbsY - 1;
  return {
    x: Math.floor(relX / (cellSize + 1)),
    y: Math.floor(relY / (cellSize + 1)),
  };
}

// Renders the ship sprite image clipped to a single grid cell.
// Horizontal: shifts the image left so the correct column shows.
// Vertical: rotates 90° and translates so the correct row shows.
function ShipCellSprite({ part, cellSize }: { part: ShipPart; cellSize: number }) {
  const { ship } = part;
  const image = SHIP_IMAGES[ship.type];
  if (!image) return null;

  const size = ship.parts.length;
  const totalSpriteWidth = size * cellSize + (size - 1) * GRID_CELL_GAP;

  const index = ship.parts.findIndex(
    (p) => p.field.x === part.field.x && p.field.y === part.field.y
  );
  if (index === -1) return null;

  if (ship.orientation === "horizontal") {
    return (
      <Image
        source={image}
        style={{
          position: "absolute",
          top: 0,
          left: -index * (cellSize + GRID_CELL_GAP),
          width: totalSpriteWidth,
          height: cellSize,
        }}
        resizeMode="stretch"
      />
    );
  }

  // Vertical: rotate the sprite 90° CW.
  // The full image (totalSpriteWidth × cellSize) is rotated around its own center.
  // topOffset/leftOffset position the image so that after rotation, the slice
  // corresponding to `index` aligns with the cell bounds (overflow:hidden clips the rest).
  const topOffset = totalSpriteWidth / 2 - cellSize / 2 - index * (cellSize + GRID_CELL_GAP);
  const leftOffset = cellSize / 2 - totalSpriteWidth / 2;
  return (
    <Image
      source={image}
      style={{
        position: "absolute",
        top: topOffset,
        left: leftOffset,
        width: totalSpriteWidth,
        height: cellSize,
        transform: [{ rotate: "90deg" }],
      }}
      resizeMode="stretch"
    />
  );
}

interface GameFieldProps {
  fields: Field[][];
  onCellPress?: (x: number, y: number) => void;
  previewCells?: Set<string>;
  isPreviewValid?: boolean;
  draggingShip?: ShipType | null;
  onShipDragStart?: (shipType: ShipType, pageX: number, pageY: number) => void;
  onShipDragging?: (pageX: number, pageY: number) => void;
  onShipDragEnd?: (pageX: number, pageY: number) => void;
  dragX?: SharedValue<number>;
  dragY?: SharedValue<number>;
}

function DraggableShipCell({
  field,
  cellSize,
  bgColor,
  dimmed,
  onShipDragStart,
  onShipDragging,
  onShipDragEnd,
  dragX,
  dragY,
}: {
  field: Field;
  cellSize: number;
  bgColor: string;
  dimmed: boolean;
  onShipDragStart: (shipType: ShipType, pageX: number, pageY: number) => void;
  onShipDragging: (pageX: number, pageY: number) => void;
  onShipDragEnd: (pageX: number, pageY: number) => void;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
}) {
  const shipType = field.shipPart!.ship.type;
  const pan = Gesture.Pan()
    .minDistance(6)
    .onStart((e) => {
      dragX.value = e.absoluteX;
      dragY.value = e.absoluteY;
      runOnJS(onShipDragStart)(shipType, e.absoluteX, e.absoluteY);
    })
    .onUpdate((e) => {
      dragX.value = e.absoluteX;
      dragY.value = e.absoluteY;
      runOnJS(onShipDragging)(e.absoluteX, e.absoluteY);
    })
    .onEnd((e) => {
      runOnJS(onShipDragEnd)(e.absoluteX, e.absoluteY);
    });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.cell, { width: cellSize, height: cellSize, backgroundColor: bgColor, opacity: dimmed ? 0.35 : 1 }]}>
        <ShipCellSprite part={field.shipPart!} cellSize={cellSize} />
      </Animated.View>
    </GestureDetector>
  );
}

function cellColor(field: Field, previewCells: Set<string>, isPreviewValid: boolean): string {
  const key = `${field.x}-${field.y}`;
  if (previewCells.has(key)) {
    return isPreviewValid ? "rgba(80, 210, 120, 0.8)" : "rgba(210, 60, 60, 0.8)";
  }
  if (field.status === "hit") return "rgba(210, 45, 45, 0.9)";
  if (field.status === "miss") return "rgba(160, 210, 255, 0.25)";
  if (field.shipPart) return "rgba(60, 110, 210, 0.75)";
  return "rgba(8, 25, 70, 0.85)";
}

export const GameField = forwardRef<View, GameFieldProps>(
  function GameField(
    {
      fields,
      onCellPress,
      previewCells = new Set(),
      isPreviewValid = true,
      draggingShip,
      onShipDragStart,
      onShipDragging,
      onShipDragEnd,
      dragX,
      dragY,
    },
    ref
  ) {
    const { width } = useWindowDimensions();
    const cellSize = Math.floor((width - GRID_PADDING * 2 - LABEL_SIZE) / GRID_SIZE);
    const canDragFromGrid = !!(onShipDragStart && onShipDragging && onShipDragEnd && dragX && dragY);

    return (
      <View style={styles.wrapper}>
        {/* Column header row — paddingLeft:1 + gap:1 mirrors the grid body's padding and cell gap */}
        <View style={[styles.headerRow, { paddingLeft: 1, gap: 1 }]}>
          <View style={[styles.cornerCell, { width: LABEL_SIZE, height: LABEL_SIZE }]} />
          {COL_LABELS.map((label) => (
            <View key={label} style={[styles.headerCell, { width: cellSize, height: LABEL_SIZE }]}>
              <Text style={styles.labelText}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Grid body — ref used to measure absolute position for drag-drop */}
        <View
          ref={ref}
          style={[styles.gridBody, { gap: 1, backgroundColor: "rgba(80, 160, 255, 0.35)", padding: 1 }]}
        >
          {fields.map((row, rowIndex) => (
            <View key={rowIndex} style={[styles.row, { gap: 1 }]}>
              <View style={[styles.rowLabelCell, { width: LABEL_SIZE, height: cellSize }]}>
                <Text style={styles.labelText}>{ROW_LABELS[rowIndex]}</Text>
              </View>
              {row.map((field) => {
                const bg = cellColor(field, previewCells, isPreviewValid);
                if (field.shipPart && canDragFromGrid) {
                  return (
                    <DraggableShipCell
                      key={`${field.x}-${field.y}`}
                      field={field}
                      cellSize={cellSize}
                      bgColor={bg}
                      dimmed={draggingShip === field.shipPart.ship.type}
                      onShipDragStart={onShipDragStart!}
                      onShipDragging={onShipDragging!}
                      onShipDragEnd={onShipDragEnd!}
                      dragX={dragX!}
                      dragY={dragY!}
                    />
                  );
                }
                return (
                  <Pressable
                    key={`${field.x}-${field.y}`}
                    style={({ pressed }) => [
                      styles.cell,
                      { width: cellSize, height: cellSize, backgroundColor: bg },
                      pressed && styles.cellPressed,
                    ]}
                    onPress={() => onCellPress?.(field.x, field.y)}
                  >
                    {field.shipPart && (
                      <ShipCellSprite part={field.shipPart} cellSize={cellSize} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  cornerCell: {},
  headerCell: {
    alignItems: "center",
    justifyContent: "center",
  },
  gridBody: {
    borderRadius: 2,
  },
  row: {
    flexDirection: "row",
  },
  rowLabelCell: {
    alignItems: "center",
    justifyContent: "center",
  },
  cell: {
    borderRadius: 1,
    overflow: "hidden",
  },
  cellPressed: {
    backgroundColor: "rgba(100, 180, 255, 0.6)",
  },
  labelText: {
    color: "rgba(180, 210, 255, 0.8)",
    textAlign: "center",
    width: "100%",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
