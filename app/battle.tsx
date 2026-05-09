import { useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ImageBackground, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from "react-native-reanimated";
import { DragPreview } from "@/components/drag-preview";
import { FadeIn } from "@/components/fade-in";
import { GameField, computeCell, LABEL_SIZE } from "@/components/game-field";
import { HapticPressable } from "@/components/haptic-pressable";
import { ShipTray } from "@/components/ship-tray";
import { createGameField } from "@/models/game-factory";
import type { Field, Ship, ShipPart, ShipType } from "@/models/types";
import { SHIP_FLEET, SHIP_SIZES } from "@/models/types";
import { IMAGES } from "@/constants/assets";

const PLAYER = { id: "1", name: "CAPTAIN", isAI: false };
const GRID_SIZE = 10;
const GRID_PADDING = 32;
const DRAG_OFFSET_X = 48;
const DRAG_OFFSET_Y = 3 * 48;

type Orientation = "horizontal" | "vertical";

function buildPreviewCells(
  shipType: ShipType,
  startX: number,
  startY: number,
  orientation: Orientation
): { x: number; y: number }[] {
  const size = SHIP_SIZES[shipType];
  return Array.from({ length: size }, (_, i) => ({
    x: orientation === "horizontal" ? startX + i : startX,
    y: orientation === "vertical" ? startY + i : startY,
  }));
}

function isValidPlacement(
  cells: { x: number; y: number }[],
  fields: Field[][],
  excludeShipId?: string
): boolean {
  return cells.every(({ x, y }) => {
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return false;
    const part = fields[y][x].shipPart;
    if (!part) return true;
    return !!excludeShipId && part.ship.id === excludeShipId;
  });
}

function placeship(
  fields: Field[][],
  shipType: ShipType,
  cells: { x: number; y: number }[],
  orientation: Orientation
): Field[][] {
  const ship: Ship = {
    id: `${shipType}-${Date.now()}`,
    type: shipType,
    parts: [],
    orientation,
  };

  const next = fields.map((row) => row.map((f) => ({ ...f })));

  const parts: ShipPart[] = cells.map(({ x, y }) => {
    const part: ShipPart = { ship, field: next[y][x], isHit: false };
    next[y][x] = { ...next[y][x], shipPart: part };
    return part;
  });

  // Patch ship reference into all parts (circular ref via object mutation after creation)
  ship.parts = parts;

  return next;
}

export default function BattleScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();

  const cellSize = Math.floor((width - GRID_PADDING * 2 - LABEL_SIZE) / GRID_SIZE);

  // Game state
  const [fields, setFields] = useState<Field[][]>(() => createGameField(PLAYER).fields);
  const [placedShips, setPlacedShips] = useState<Set<ShipType>>(new Set());
  const [orientations, setOrientations] = useState<Record<ShipType, Orientation>>(
    () => Object.fromEntries(SHIP_FLEET.map((t) => [t, "horizontal"])) as Record<ShipType, Orientation>
  );

  // Drag state
  const [draggingShip, setDraggingShip] = useState<ShipType | null>(null);
  const draggingShipRef = useRef<ShipType | null>(null);
  const draggingFromGridRef = useRef<string | null>(null); // ship ID when re-dragging from grid
  const [previewCells, setPreviewCells] = useState<Set<string>>(new Set());
  const [isPreviewValid, setIsPreviewValid] = useState(true);

  // Shared values for smooth floating preview animation
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);

  // Cached grid body absolute position (measured after layout)
  const gridBodyRef = useRef<View>(null);
  const gridOriginRef = useRef<{ x: number; y: number } | null>(null);

  // Cached ship tray bounds (measured on grid-ship drag start)
  const trayRef = useRef<View>(null);
  const trayBoundsRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  // Measure grid position after layout and on width changes
  useEffect(() => {
    const id = setTimeout(() => {
      gridBodyRef.current?.measureInWindow((x, y) => {
        gridOriginRef.current = { x, y };
      });
    }, 150);
    return () => clearTimeout(id);
  }, [width]);

  const updatePreview = useCallback(
    (ship: ShipType, pageX: number, pageY: number) => {
      const origin = gridOriginRef.current;
      if (!origin) return;

      const orientation = orientations[ship];
      const { x: startX, y: startY } = computeCell(pageX + DRAG_OFFSET_X, pageY - DRAG_OFFSET_Y, origin.x, origin.y, cellSize);
      const cells = buildPreviewCells(ship, startX, startY, orientation);
      const valid = isValidPlacement(cells, fields, draggingFromGridRef.current ?? undefined);

      setPreviewCells(new Set(cells.map((c) => `${c.x}-${c.y}`)));
      setIsPreviewValid(valid);
    },
    [orientations, cellSize, fields]
  );

  const startDrag = useCallback(
    (ship: ShipType, pageX: number, pageY: number) => {
      gridBodyRef.current?.measureInWindow((x, y) => {
        gridOriginRef.current = { x, y };
      });
      draggingShipRef.current = ship;
      setDraggingShip(ship);
      updatePreview(ship, pageX, pageY);
    },
    [updatePreview]
  );

  const handleDragStart = useCallback(
    (ship: ShipType, pageX: number, pageY: number) => {
      startDrag(ship, pageX, pageY);
    },
    [startDrag]
  );

  const handleGridShipDragStart = useCallback(
    (shipType: ShipType, pageX: number, pageY: number) => {
      // Find and record the ship ID — ship stays in fields until drop so gesture stays alive
      let shipId: string | null = null;
      for (const row of fields) {
        for (const f of row) {
          if (f.shipPart?.ship.type === shipType) {
            shipId = f.shipPart.ship.id;
            break;
          }
        }
        if (shipId) break;
      }
      draggingFromGridRef.current = shipId;
      // Cache tray bounds so we can detect drops over it in handleDragEnd
      trayRef.current?.measureInWindow((x, y, width, height) => {
        trayBoundsRef.current = { x, y, width, height };
      });
      startDrag(shipType, pageX, pageY);
    },
    [fields, startDrag]
  );

  const handleDragging = useCallback(
    (pageX: number, pageY: number) => {
      const ship = draggingShipRef.current;
      if (!ship) return;
      updatePreview(ship, pageX, pageY);
    },
    [updatePreview]
  );

  const handleDragEnd = useCallback(
    (pageX: number, pageY: number) => {
      const ship = draggingShipRef.current;
      const fromGridShipId = draggingFromGridRef.current;
      draggingShipRef.current = null;
      draggingFromGridRef.current = null;
      setDraggingShip(null);
      setPreviewCells(new Set());

      if (!ship) return;

      const origin = gridOriginRef.current;
      if (!origin) return;

      const orientation = orientations[ship];
      const { x: startX, y: startY } = computeCell(pageX + DRAG_OFFSET_X, pageY - DRAG_OFFSET_Y, origin.x, origin.y, cellSize);
      const cells = buildPreviewCells(ship, startX, startY, orientation);
      const valid = isValidPlacement(cells, fields, fromGridShipId ?? undefined);

      // If dragged from the grid and dropped over the tray without a valid placement, remove the ship
      if (!valid && fromGridShipId) {
        const tray = trayBoundsRef.current;
        if (
          tray &&
          pageX >= tray.x && pageX <= tray.x + tray.width &&
          pageY >= tray.y && pageY <= tray.y + tray.height
        ) {
          setFields((prev) =>
            prev.map((row) => row.map((f) => (f.shipPart?.ship.id === fromGridShipId ? { ...f, shipPart: null } : f)))
          );
          setPlacedShips((prev) => {
            const next = new Set(prev);
            next.delete(ship);
            return next;
          });
          return;
        }
      }

      if (!valid) return;

      setFields((prev) => {
        const withoutOld = fromGridShipId
          ? prev.map((row) => row.map((f) => (f.shipPart?.ship.id === fromGridShipId ? { ...f, shipPart: null } : f)))
          : prev;
        return placeship(withoutOld, ship, cells, orientation);
      });
      setPlacedShips((prev) => new Set([...prev, ship]));
    },
    [orientations, cellSize, fields]
  );

  const handleOrientationToggle = useCallback((ship: ShipType) => {
    setOrientations((prev) => ({
      ...prev,
      [ship]: prev[ship] === "horizontal" ? "vertical" : "horizontal",
    }));
  }, []);

  // Screen exit animation
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
        source={IMAGES.bg}
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
              <GameField
                ref={gridBodyRef}
                fields={fields}
                previewCells={previewCells}
                isPreviewValid={isPreviewValid}
                draggingShip={draggingShip}
                onShipDragStart={handleGridShipDragStart}
                onShipDragging={handleDragging}
                onShipDragEnd={handleDragEnd}
                dragX={dragX}
                dragY={dragY}
              />
              <ShipTray
                ref={trayRef}
                placedShips={placedShips}
                orientations={orientations}
                onOrientationToggle={handleOrientationToggle}
                onDragStart={handleDragStart}
                onDragging={handleDragging}
                onDragEnd={handleDragEnd}
                dragX={dragX}
                dragY={dragY}
              />
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

        {/* Floating drag preview — rendered last so it draws on top */}
        {draggingShip && (
          <DragPreview
            ship={draggingShip}
            orientation={orientations[draggingShip]}
            dragX={dragX}
            dragY={dragY}
          />
        )}
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
