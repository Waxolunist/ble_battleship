import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { Field } from "@/models/types";

const ROW_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
const COL_LABELS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
const GRID_SIZE = 10;
const LABEL_SIZE = 22;
const GRID_PADDING = 32;

interface GameFieldProps {
  fields: Field[][];
  onCellPress?: (x: number, y: number) => void;
}

function cellColor(field: Field): string {
  if (field.status === "hit") return "rgba(210, 45, 45, 0.9)";
  if (field.status === "miss") return "rgba(160, 210, 255, 0.25)";
  if (field.shipPart) return "rgba(60, 110, 210, 0.75)";
  return "rgba(8, 25, 70, 0.85)";
}

export function GameField({ fields, onCellPress }: GameFieldProps) {
  const { width } = useWindowDimensions();
  const cellSize = Math.floor((width - GRID_PADDING * 2 - LABEL_SIZE) / GRID_SIZE);

  return (
    <View style={styles.wrapper}>
      {/* Column header row */}
      <View style={styles.headerRow}>
        <View style={[styles.cornerCell, { width: LABEL_SIZE, height: LABEL_SIZE }]} />
        {COL_LABELS.map((label) => (
          <View key={label} style={[styles.headerCell, { width: cellSize, height: LABEL_SIZE }]}>
            <Text style={styles.labelText}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Grid body */}
      <View style={[styles.gridBody, { gap: 1, backgroundColor: "rgba(80, 160, 255, 0.35)", padding: 1 }]}>
        {fields.map((row, rowIndex) => (
          <View key={rowIndex} style={[styles.row, { gap: 1 }]}>
            <View style={[styles.rowLabelCell, { width: LABEL_SIZE, height: cellSize }]}>
              <Text style={styles.labelText}>{ROW_LABELS[rowIndex]}</Text>
            </View>
            {row.map((field) => (
              <Pressable
                key={`${field.x}-${field.y}`}
                style={({ pressed }) => [
                  styles.cell,
                  { width: cellSize, height: cellSize, backgroundColor: cellColor(field) },
                  pressed && styles.cellPressed,
                ]}
                onPress={() => onCellPress?.(field.x, field.y)}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

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
  },
  cellPressed: {
    backgroundColor: "rgba(100, 180, 255, 0.6)",
  },
  labelText: {
    color: "rgba(180, 210, 255, 0.8)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
