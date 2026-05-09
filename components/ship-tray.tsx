import type { ShipType } from "@/models/types";
import { SHIP_FLEET, SHIP_SIZES } from "@/models/types";
import {
  Image,
  ImageSourcePropType,
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

function ShipRow({ type }: { type: ShipType }) {
  const size = SHIP_SIZES[type];
  const image = SHIP_IMAGES[type];
  return (
    <View style={styles.shipRow}>
      <Text style={styles.shipLabel}>{type.toUpperCase()}</Text>
      <View style={styles.cells}>
        {Array.from({ length: size }).map((_, i) =>
          image ? (
            <SpriteCell key={i} image={image} index={i} totalCells={size} />
          ) : (
            <View key={i} style={[styles.cell, styles.cellSolid]} />
          ),
        )}
      </View>
    </View>
  );
}

export function ShipTray() {
  return (
    <View style={styles.tray}>
      <Text style={styles.trayTitle}>FLEET</Text>
      <View style={styles.shipList}>
        {SHIP_FLEET.map((type) => (
          <ShipRow key={type} type={type} />
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
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
    gap: 12,
  },
  shipLabel: {
    color: "rgba(180, 210, 255, 0.65)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    width: 76,
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
  spriteImage: {
    position: "absolute",
    top: 0,
    height: CELL_SIZE,
  },
  cellTileOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(30, 60, 130, 0.25)",
  },
});
