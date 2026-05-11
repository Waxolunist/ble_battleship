import { DragPreview } from "@/components/drag-preview";
import { computeCell, LABEL_SIZE } from "@/components/game-field";
import { BattleView } from "@/components/views/battle-view";
import { PlacementView } from "@/components/views/placement-view";
import { IMAGES } from "@/constants/assets";
import { pickAiTarget } from "@/engine/ai";
import { applyFire } from "@/engine/combat";
import { buildPreviewCells, isValidPlacement, placeShip, tryRandomPlacement } from "@/engine/placement";
import { createGameField } from "@/models/game-factory";
import type { Field, Orientation, ShipType } from "@/models/types";
import { SHIP_FLEET } from "@/models/types";
import { useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Image,
  ImageBackground,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const PLAYER = { id: "1", name: "CAPTAIN", isAI: false };
const AI_PLAYER = { id: "2", name: "ENEMY", isAI: true };
const GRID_PADDING = 32;
const DRAG_OFFSET_X = 24;
const DRAG_OFFSET_Y = 3 * 48;

export default function BattleScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();

  const cellSize = Math.floor(
    (width - GRID_PADDING * 2 - LABEL_SIZE) / 10,
  );

  // Game state
  const [fields, setFields] = useState<Field[][]>(
    () => createGameField(PLAYER).fields,
  );
  const [opponentFields, setOpponentFields] = useState<Field[][]>(() => {
    const result = tryRandomPlacement(createGameField(AI_PLAYER).fields);
    return result ? result.fields : createGameField(AI_PLAYER).fields;
  });
  const [placedShips, setPlacedShips] = useState<Set<ShipType>>(new Set());
  const [orientations, setOrientations] = useState<
    Record<ShipType, Orientation>
  >(
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
      const valid = isValidPlacement(
        cells,
        fields,
        fromGridShipId ?? undefined,
      );

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
        return placeShip(withoutOld, ship, cells, orientation);
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

  const handleRandomize = useCallback(() => {
    const result = tryRandomPlacement(createGameField(PLAYER).fields);
    if (!result) return;
    setFields(result.fields);
    setOrientations(result.orientations);
    setPlacedShips(new Set(SHIP_FLEET));
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
  const [turn, setTurn] = useState<"player" | "enemy">("player");

  // Ref so AI effect always reads latest player fields without stale closure
  const fieldsRef = useRef(fields);
  useEffect(() => { fieldsRef.current = fields; }, [fields]);

  // Fired when a ship is sunk — consumed by BattleView to show floating label
  const [sunkEvent, setSunkEvent] = useState<{ shipType: ShipType; owner: "player" | "enemy" } | null>(null);

  // Player fires at an enemy cell
  const handlePlayerFire = useCallback((x: number, y: number) => {
    if (opponentFields[y][x].status !== "empty") return;

    setOpponentFields((prev) =>
      prev.map((row) =>
        row.map((f) => (f.x === x && f.y === y ? { ...f, status: "targeted" as const } : f)),
      ),
    );
    setTimeout(() => {
      const { fields: next, sunkShip } = applyFire(opponentFields, x, y);
      setOpponentFields(next);
      if (sunkShip) setSunkEvent({ shipType: sunkShip.type, owner: "enemy" });
      setTurn("enemy");
    }, 500);
  }, [opponentFields]);

  // Enemy AI turn
  useEffect(() => {
    if (turn !== "enemy") return;

    const target = pickAiTarget(fieldsRef.current);
    if (!target) return;

    const { x, y } = target;

    const t1 = setTimeout(() => {
      setFields((prev) =>
        prev.map((row) =>
          row.map((f) => (f.x === x && f.y === y ? { ...f, status: "targeted" as const } : f)),
        ),
      );

      const t2 = setTimeout(() => {
        const { fields: next, sunkShip } = applyFire(fieldsRef.current, x, y);
        setFields(next);
        if (sunkShip) setSunkEvent({ shipType: sunkShip.type, owner: "player" });
        setTurn("player");
      }, 500);

      return () => clearTimeout(t2);
    }, 800);

    return () => clearTimeout(t1);
  }, [turn]);

  // Commence firing flash
  const flashOpacity = useSharedValue(0);
  const flashScale = useSharedValue(0.2);

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

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
    transform: [{ scale: flashScale.value }],
  }));

  const allShipsPlaced = placedShips.size === SHIP_FLEET.length;

  const handleFireAtWill = () => {
    const fadeConfig = { duration: 350, easing: Easing.in(Easing.cubic) };
    fireOpacity.value = withTiming(0, fadeConfig);
    fireTopTranslateY.value = withTiming(-60, fadeConfig);
    fireBottomTranslateY.value = withTiming(60, fadeConfig);
    playerFieldTranslateY.value = withTiming(-10, fadeConfig);

    battlePhaseOpacity.value = withTiming(1, {
      duration: 350,
      easing: Easing.out(Easing.cubic),
    });
    setTimeout(() => {
      setShowOpponentField(true);
      flashScale.value = 0.2;
      flashOpacity.value = withSequence(
        withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 1500 }),
        withTiming(0, { duration: 450, easing: Easing.in(Easing.cubic) }),
      );
      flashScale.value = withSequence(
        withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 1500 }),
        withTiming(1.7, { duration: 450, easing: Easing.in(Easing.cubic) }),
      );
    }, 350);
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
            onRandomize={handleRandomize}
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
            turn={turn}
            sunkEvent={sunkEvent}
            onEnemyCellPress={handlePlayerFire}
          />
        </Animated.View>

        {/* Commence firing flash — centered overlay, z-axis punch animation */}
        <Animated.View
          style={[styles.flashOverlay, flashStyle]}
          pointerEvents="none"
        >
          <Image
            source={IMAGES.commenceFiring}
            style={styles.flashImage}
            resizeMode="contain"
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
  flashOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  flashImage: {
    width: "80%",
    height: undefined,
    aspectRatio: 1,
  },
});
