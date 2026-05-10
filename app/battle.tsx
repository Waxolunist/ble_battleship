import { DragPreview } from "@/components/drag-preview";
import { computeCell, LABEL_SIZE } from "@/components/game-field";
import { IMAGES } from "@/constants/assets";
import { createGameField } from "@/models/game-factory";
import type { Field, Ship, ShipPart, ShipType } from "@/models/types";
import { SHIP_FLEET, SHIP_SIZES } from "@/models/types";
import { useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ImageBackground, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { BattleView } from "@/components/views/battle-view";
import { PlacementView } from "@/components/views/placement-view";
import type { Orientation } from "@/components/views/placement-view";

const PLAYER = { id: "1", name: "CAPTAIN", isAI: false };
const AI_PLAYER = { id: "2", name: "ENEMY", isAI: true };
const GRID_SIZE = 10;
const GRID_PADDING = 32;
const DRAG_OFFSET_X = 24;
const DRAG_OFFSET_Y = 3 * 48;

function buildPreviewCells(
  shipType: ShipType,
  startX: number,
  startY: number,
  orientation: Orientation,
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
  excludeShipId?: string,
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
  orientation: Orientation,
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

  ship.parts = parts;

  return next;
}

export default function BattleScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();

  const cellSize = Math.floor(
    (width - GRID_PADDING * 2 - LABEL_SIZE) / GRID_SIZE,
  );

  // Game state
  const [fields, setFields] = useState<Field[][]>(
    () => createGameField(PLAYER).fields,
  );
  const [opponentFields] = useState<Field[][]>(
    () => createGameField(AI_PLAYER).fields,
  );
  const [placedShips, setPlacedShips] = useState<Set<ShipType>>(new Set());
  const [orientations, setOrientations] = useState<Record<ShipType, Orientation>>(
    () =>
      Object.fromEntries(SHIP_FLEET.map((t) => [t, "horizontal"])) as Record<
        ShipType,
        Orientation
      >,
  );

  // Drag state
  const [draggingShip, setDraggingShip] = useState<ShipType | null>(null);
  const draggingShipRef = useRef<ShipType | null>(null);
  const draggingFromGridRef = useRef<string | null>(null);
  const [previewCells, setPreviewCells] = useState<Set<string>>(new Set());
  const [isPreviewValid, setIsPreviewValid] = useState(true);

  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);

  const gridBodyRef = useRef<View>(null);
  const gridOriginRef = useRef<{ x: number; y: number } | null>(null);

  const trayRef = useRef<View>(null);
  const trayBoundsRef = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

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
      const { x: startX, y: startY } = computeCell(
        pageX + DRAG_OFFSET_X,
        pageY - DRAG_OFFSET_Y,
        origin.x,
        origin.y,
        cellSize,
      );
      const cells = buildPreviewCells(ship, startX, startY, orientation);
      const valid = isValidPlacement(
        cells,
        fields,
        draggingFromGridRef.current ?? undefined,
      );

      setPreviewCells(new Set(cells.map((c) => `${c.x}-${c.y}`)));
      setIsPreviewValid(valid);
    },
    [orientations, cellSize, fields],
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
    [updatePreview],
  );

  const handleDragStart = useCallback(
    (ship: ShipType, pageX: number, pageY: number) => {
      startDrag(ship, pageX, pageY);
    },
    [startDrag],
  );

  const handleGridShipDragStart = useCallback(
    (shipType: ShipType, pageX: number, pageY: number) => {
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
      trayRef.current?.measureInWindow((x, y, width, height) => {
        trayBoundsRef.current = { x, y, width, height };
      });
      startDrag(shipType, pageX, pageY);
    },
    [fields, startDrag],
  );

  const handleDragging = useCallback(
    (pageX: number, pageY: number) => {
      const ship = draggingShipRef.current;
      if (!ship) return;
      updatePreview(ship, pageX, pageY);
    },
    [updatePreview],
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
      const { x: startX, y: startY } = computeCell(
        pageX + DRAG_OFFSET_X,
        pageY - DRAG_OFFSET_Y,
        origin.x,
        origin.y,
        cellSize,
      );
      const cells = buildPreviewCells(ship, startX, startY, orientation);
      const valid = isValidPlacement(cells, fields, fromGridShipId ?? undefined);

      if (!valid && fromGridShipId) {
        const tray = trayBoundsRef.current;
        if (
          tray &&
          pageX >= tray.x &&
          pageX <= tray.x + tray.width &&
          pageY >= tray.y &&
          pageY <= tray.y + tray.height
        ) {
          setFields((prev) =>
            prev.map((row) =>
              row.map((f) =>
                f.shipPart?.ship.id === fromGridShipId
                  ? { ...f, shipPart: null }
                  : f,
              ),
            ),
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
          ? prev.map((row) =>
              row.map((f) =>
                f.shipPart?.ship.id === fromGridShipId
                  ? { ...f, shipPart: null }
                  : f,
              ),
            )
          : prev;
        return placeship(withoutOld, ship, cells, orientation);
      });
      setPlacedShips((prev) => new Set([...prev, ship]));
    },
    [orientations, cellSize, fields],
  );

  const handleOrientationToggle = useCallback((ship: ShipType) => {
    setOrientations((prev) => ({
      ...prev,
      [ship]: prev[ship] === "horizontal" ? "vertical" : "horizontal",
    }));
  }, []);

  // Screen exit animation
  const screenTranslateY = useSharedValue(0);

  // Placement phase fade-out animations
  const fireOpacity = useSharedValue(1);
  const fireTopTranslateY = useSharedValue(0);
  const fireBottomTranslateY = useSharedValue(0);
  const playerFieldTranslateY = useSharedValue(0);

  // Battle phase fade-in
  const battlePhaseOpacity = useSharedValue(0);
  const [showOpponentField, setShowOpponentField] = useState(false);

  const screenStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: screenTranslateY.value }],
  }));

  const placementPhaseStyle = useAnimatedStyle(() => ({
    opacity: fireOpacity.value,
  }));

  const fireTopStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: fireTopTranslateY.value }],
  }));

  const fireBottomStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: fireBottomTranslateY.value }],
  }));

  const playerFieldAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: playerFieldTranslateY.value }],
  }));

  const battlePhaseStyle = useAnimatedStyle(() => ({
    opacity: battlePhaseOpacity.value,
  }));

  const allShipsPlaced = placedShips.size === SHIP_FLEET.length;

  const handleFireAtWill = () => {
    const fadeConfig = { duration: 350, easing: Easing.in(Easing.cubic) };
    fireOpacity.value = withTiming(0, fadeConfig);
    fireTopTranslateY.value = withTiming(-60, fadeConfig);
    fireBottomTranslateY.value = withTiming(60, fadeConfig);
    playerFieldTranslateY.value = withTiming(-10, fadeConfig);

    battlePhaseOpacity.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) });
    setTimeout(() => setShowOpponentField(true), 350);
  };

  const handleRetreat = () => {
    navigation.setOptions({ animation: "none" });
    screenTranslateY.value = withTiming(-1000, {
      duration: 350,
      easing: Easing.in(Easing.cubic),
    });
    setTimeout(() => router.back(), 350);
  };

  return (
    <Animated.View style={[styles.background, screenStyle]}>
      <ImageBackground
        source={IMAGES.bg}
        style={styles.background}
        resizeMode="cover"
      >
        <View style={[StyleSheet.absoluteFill, styles.overlay]} />

        {/* Placement phase — fades out on Fire at Will */}
        <Animated.View
          style={[StyleSheet.absoluteFill, placementPhaseStyle]}
          pointerEvents={showOpponentField ? "none" : "auto"}
        >
          <PlacementView
            fireTopStyle={fireTopStyle}
            fireBottomStyle={fireBottomStyle}
            playerFieldAnimStyle={playerFieldAnimStyle}
            fields={fields}
            placedShips={placedShips}
            orientations={orientations}
            allShipsPlaced={allShipsPlaced}
            draggingShip={draggingShip}
            previewCells={previewCells}
            isPreviewValid={isPreviewValid}
            dragX={dragX}
            dragY={dragY}
            gridBodyRef={gridBodyRef}
            trayRef={trayRef}
            onGridShipDragStart={handleGridShipDragStart}
            onDragging={handleDragging}
            onDragEnd={handleDragEnd}
            onOrientationToggle={handleOrientationToggle}
            onDragStart={handleDragStart}
            onFireAtWill={handleFireAtWill}
            onRetreat={handleRetreat}
          />
        </Animated.View>

        {/* Battle phase — fades in on Fire at Will */}
        <Animated.View
          style={[StyleSheet.absoluteFill, battlePhaseStyle]}
          pointerEvents={showOpponentField ? "auto" : "none"}
        >
          <BattleView
            fields={fields}
            opponentFields={opponentFields}
            showOpponentField={showOpponentField}
          />
        </Animated.View>

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
});
