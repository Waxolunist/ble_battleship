import { computeCell } from '@/components/game-field';
import { buildPreviewCells, isValidPlacement } from '@/engine/placement';
import type { ShipType } from '@/models/types';
import { useGameStore } from '@/store/useGameStore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

const DRAG_OFFSET_X = 24;
const DRAG_OFFSET_Y = 3 * 48;

export interface PlacementGestureHandlers {
  draggingShip: ShipType | null;
  previewCells: Set<string>;
  isPreviewValid: boolean;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  gridBodyRef: React.RefObject<View | null>;
  trayRef: React.RefObject<View | null>;
  onDragStart: (ship: ShipType, pageX: number, pageY: number) => void;
  onGridShipDragStart: (shipType: ShipType, pageX: number, pageY: number) => void;
  onDragging: (pageX: number, pageY: number) => void;
  onDragEnd: (pageX: number, pageY: number) => void;
  onOrientationToggle: (ship: ShipType) => void;
  onRandomize: () => void;
}

export function usePlacementGestures(cellSize: number): PlacementGestureHandlers {
  const fields = useGameStore(s => s.fields);
  const orientations = useGameStore(s => s.orientations);
  const placeShipOnBoard = useGameStore(s => s.placeShipOnBoard);
  const removeShipFromBoard = useGameStore(s => s.removeShipFromBoard);
  const toggleOrientation = useGameStore(s => s.toggleOrientation);
  const randomizeFleet = useGameStore(s => s.randomizeFleet);

  const [draggingShip, setDraggingShip] = useState<ShipType | null>(null);
  const [previewCells, setPreviewCells] = useState<Set<string>>(new Set());
  const [isPreviewValid, setIsPreviewValid] = useState(true);

  const draggingShipRef = useRef<ShipType | null>(null);
  const draggingFromGridRef = useRef<string | null>(null);
  const gridBodyRef = useRef<View>(null);
  const gridOriginRef = useRef<{ x: number; y: number } | null>(null);
  const trayRef = useRef<View>(null);
  const trayBoundsRef = useRef<{ x: number; y: number; width: number; height: number } | null>(
    null,
  );

  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);

  useEffect(() => {
    const id = setTimeout(() => {
      gridBodyRef.current?.measureInWindow((x, y) => {
        gridOriginRef.current = { x, y };
      });
    }, 150);
    return () => clearTimeout(id);
  }, [cellSize]);

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
      const valid = isValidPlacement(cells, fields, draggingFromGridRef.current ?? undefined);
      setPreviewCells(new Set(cells.map(c => `${c.x}-${c.y}`)));
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

  const onDragStart = useCallback(
    (ship: ShipType, pageX: number, pageY: number) => startDrag(ship, pageX, pageY),
    [startDrag],
  );

  const onGridShipDragStart = useCallback(
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

  const onDragging = useCallback(
    (pageX: number, pageY: number) => {
      const ship = draggingShipRef.current;
      if (!ship) return;
      updatePreview(ship, pageX, pageY);
    },
    [updatePreview],
  );

  const onDragEnd = useCallback(
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
          removeShipFromBoard(ship, fromGridShipId);
          return;
        }
      }

      if (!valid) return;
      placeShipOnBoard(ship, cells, orientation, fromGridShipId);
    },
    [orientations, cellSize, fields, placeShipOnBoard, removeShipFromBoard],
  );

  const onOrientationToggle = useCallback(
    (ship: ShipType) => toggleOrientation(ship),
    [toggleOrientation],
  );

  const onRandomize = useCallback(() => randomizeFleet(), [randomizeFleet]);

  return {
    draggingShip,
    previewCells,
    isPreviewValid,
    dragX,
    dragY,
    gridBodyRef,
    trayRef,
    onDragStart,
    onGridShipDragStart,
    onDragging,
    onDragEnd,
    onOrientationToggle,
    onRandomize,
  };
}
