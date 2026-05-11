import { forwardRef, useEffect } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type { Field, ShipPart, ShotPhase, ShipType } from '@/models/types';
import { IMAGES } from '@/constants/assets';
import { GameColors } from '@/constants/theme';

const ROW_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const COL_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
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
  cellSize: number,
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
function ShipCellSprite({
  part,
  cellSize,
  opacity = 1,
}: {
  part: ShipPart;
  cellSize: number;
  opacity?: number;
}) {
  const { ship } = part;
  const image = SHIP_IMAGES[ship.type];
  if (!image) return null;

  const size = ship.parts.length;
  const totalSpriteWidth = size * cellSize + (size - 1) * GRID_CELL_GAP;

  const index = ship.parts.findIndex(p => p.field.x === part.field.x && p.field.y === part.field.y);
  if (index === -1) return null;

  if (ship.orientation === 'horizontal') {
    return (
      <Image
        source={image}
        style={{
          position: 'absolute',
          top: 0,
          left: -index * (cellSize + GRID_CELL_GAP),
          width: totalSpriteWidth,
          height: cellSize,
          opacity,
        }}
        resizeMode="stretch"
      />
    );
  }

  // Vertical: rotate the sprite 90° CW.
  const topOffset = totalSpriteWidth / 2 - cellSize / 2 - index * (cellSize + GRID_CELL_GAP);
  const leftOffset = cellSize / 2 - totalSpriteWidth / 2;
  return (
    <Image
      source={image}
      style={{
        position: 'absolute',
        top: topOffset,
        left: leftOffset,
        width: totalSpriteWidth,
        height: cellSize,
        transform: [{ rotate: '90deg' }],
        opacity,
      }}
      resizeMode="stretch"
    />
  );
}

interface GameFieldProps {
  fields: Field[][];
  tint?: string;
  hideShips?: boolean;
  onCellPress?: (x: number, y: number) => void;
  previewCells?: Set<string>;
  isPreviewValid?: boolean;
  draggingShip?: ShipType | null;
  onShipDragStart?: (shipType: ShipType, pageX: number, pageY: number) => void;
  onShipDragging?: (pageX: number, pageY: number) => void;
  onShipDragEnd?: (pageX: number, pageY: number) => void;
  dragX?: SharedValue<number>;
  dragY?: SharedValue<number>;
  shotAnim?: ShotPhase;
}

// Animated overlay that plays the three-beat shot resolution effects over the targeted cell.
// Rendered absolutely inside the wrapper so effects can extend beyond cell bounds.
function ShotAnimationOverlay({
  shotAnim,
  cellSize,
}: {
  shotAnim: NonNullable<ShotPhase>;
  cellSize: number;
}) {
  const { x, y, beat, result, reticleColor } = shotAnim;

  // Cell origin within wrapper (header row height + gridBody padding offsets)
  const cellLeft = LABEL_SIZE + 2 + x * (cellSize + GRID_CELL_GAP);
  const cellTop = LABEL_SIZE + 3 + y * (cellSize + GRID_CELL_GAP); // 3 = marginBottom(2) + padding(1)

  const reticleScale = useSharedValue(1.8);
  const reticleOpacity = useSharedValue(0);
  const flashOpacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(1);
  const rippleScale = useSharedValue(1);
  const rippleOpacity = useSharedValue(0);

  useEffect(() => {
    if (beat === 'locked') {
      reticleScale.value = 1.8;
      reticleOpacity.value = 1;
      flashOpacity.value = 0;
      glowOpacity.value = 0;
      rippleOpacity.value = 0;
      reticleScale.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });
    } else if (beat === 'impact') {
      reticleOpacity.value = withTiming(0, { duration: 80 });
      flashOpacity.value = 1;
      flashOpacity.value = withTiming(0, { duration: 80 });
    } else if (beat === 'verdict') {
      if (result === 'hit' || result === 'sunk') {
        glowOpacity.value = 0.7;
        glowScale.value = 1;
        glowScale.value = withTiming(2.5, { duration: 500, easing: Easing.out(Easing.quad) });
        glowOpacity.value = withTiming(0, { duration: 500, easing: Easing.out(Easing.quad) });
      } else if (result === 'miss') {
        rippleScale.value = 1;
        rippleOpacity.value = 0.35;
        rippleScale.value = withTiming(3, { duration: 400, easing: Easing.out(Easing.quad) });
        rippleOpacity.value = withTiming(0, { duration: 400 });
      }
    }
  }, [
    beat,
    result,
    reticleScale,
    reticleOpacity,
    flashOpacity,
    glowOpacity,
    glowScale,
    rippleScale,
    rippleOpacity,
  ]);

  const reticleStyle = useAnimatedStyle(() => ({
    opacity: reticleOpacity.value,
    transform: [{ scale: reticleScale.value }],
  }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flashOpacity.value }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: rippleOpacity.value,
    transform: [{ scale: rippleScale.value }],
  }));

  // Glow circle: 2-cell radius on each side of the targeted cell
  const glowSize = cellSize * 5;
  const glowOffset = (glowSize - cellSize) / 2;

  return (
    <>
      {/* Targeting reticle — gold (player shot) or red (enemy shot), shrinks 1.8x → 1x */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: cellTop,
            left: cellLeft,
            width: cellSize,
            height: cellSize,
            borderWidth: 1.5,
            borderColor: reticleColor,
            borderRadius: 2,
          },
          reticleStyle,
        ]}
      />
      {/* Impact flash — white overlay, 80 ms */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: cellTop,
            left: cellLeft,
            width: cellSize,
            height: cellSize,
            backgroundColor: 'white',
            borderRadius: 1,
          },
          flashStyle,
        ]}
      />
      {/* Fire glow — orange radial bloom for hit / sunk, fades over 500 ms */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: cellTop - glowOffset,
            left: cellLeft - glowOffset,
            width: glowSize,
            height: glowSize,
            borderRadius: glowSize / 2,
            backgroundColor: GameColors.fireGlow,
          },
          glowStyle,
        ]}
      />
      {/* Ripple ring — expanding circle for miss, fades over 400 ms */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: cellTop,
            left: cellLeft,
            width: cellSize,
            height: cellSize,
            borderWidth: 1.5,
            borderColor: GameColors.missRipple,
            borderRadius: cellSize / 2,
          },
          rippleStyle,
        ]}
      />
    </>
  );
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
    .onStart(e => {
      dragX.value = e.absoluteX;
      dragY.value = e.absoluteY;
      runOnJS(onShipDragStart)(shipType, e.absoluteX, e.absoluteY);
    })
    .onUpdate(e => {
      dragX.value = e.absoluteX;
      dragY.value = e.absoluteY;
      runOnJS(onShipDragging)(e.absoluteX, e.absoluteY);
    })
    .onEnd(e => {
      runOnJS(onShipDragEnd)(e.absoluteX, e.absoluteY);
    });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          styles.cell,
          {
            width: cellSize,
            height: cellSize,
            backgroundColor: bgColor,
            opacity: dimmed ? 0.35 : 1,
          },
        ]}>
        <ShipCellSprite part={field.shipPart!} cellSize={cellSize} />
      </Animated.View>
    </GestureDetector>
  );
}

function cellColor(
  field: Field,
  previewCells: Set<string>,
  isPreviewValid: boolean,
  hideShips: boolean,
): string {
  const key = `${field.x}-${field.y}`;
  if (previewCells.has(key)) {
    return isPreviewValid ? GameColors.previewValid : GameColors.previewInvalid;
  }
  if (field.status === 'targeted') return GameColors.cellTargeted;
  if (field.status === 'sunk') return GameColors.cellSunk;
  if (field.status === 'hit') return GameColors.cellHit;
  if (field.status === 'miss') return GameColors.cellMiss;
  if (field.shipPart && !hideShips) return GameColors.cellShip;
  return GameColors.cellEmpty;
}

export const GameField = forwardRef<View, GameFieldProps>(function GameField(
  {
    fields,
    tint = GameColors.blueTint,
    hideShips = false,
    onCellPress,
    previewCells = new Set(),
    isPreviewValid = true,
    draggingShip,
    onShipDragStart,
    onShipDragging,
    onShipDragEnd,
    dragX,
    dragY,
    shotAnim,
  },
  ref,
) {
  const { width } = useWindowDimensions();
  const cellSize = Math.floor((width - GRID_PADDING * 2 - LABEL_SIZE) / GRID_SIZE);
  const canDragFromGrid = !!(onShipDragStart && onShipDragging && onShipDragEnd && dragX && dragY);

  return (
    <View style={styles.wrapper}>
      {/* Column header row — paddingLeft:1 + gap:1 mirrors the grid body's padding and cell gap */}
      <View style={[styles.headerRow, { paddingLeft: 1, gap: 1 }]}>
        <View style={[styles.cornerCell, { width: LABEL_SIZE, height: LABEL_SIZE }]} />
        {COL_LABELS.map(label => (
          <View key={label} style={[styles.headerCell, { width: cellSize, height: LABEL_SIZE }]}>
            <Text style={styles.labelText}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Grid body — ref used to measure absolute position for drag-drop */}
      <View ref={ref} style={[styles.gridBody, { gap: 1, backgroundColor: tint, padding: 1 }]}>
        {fields.map((row, rowIndex) => (
          <View key={rowIndex} style={[styles.row, { gap: 1 }]}>
            <View style={[styles.rowLabelCell, { width: LABEL_SIZE, height: cellSize }]}>
              <Text style={styles.labelText}>{ROW_LABELS[rowIndex]}</Text>
            </View>
            {row.map(field => {
              const bg = cellColor(field, previewCells, isPreviewValid, hideShips);
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
                  onPress={() => onCellPress?.(field.x, field.y)}>
                  {field.shipPart && !hideShips && field.status !== 'sunk' && (
                    <ShipCellSprite part={field.shipPart} cellSize={cellSize} />
                  )}
                  {field.shipPart && field.status === 'sunk' && (
                    <ShipCellSprite part={field.shipPart} cellSize={cellSize} />
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {/* Shot animation overlay — absolutely positioned so effects can extend beyond cell bounds */}
      {shotAnim && (
        <ShotAnimationOverlay
          key={`${shotAnim.x}-${shotAnim.y}`}
          shotAnim={shotAnim}
          cellSize={cellSize}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  cornerCell: {},
  headerCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridBody: {
    borderRadius: 2,
  },
  row: {
    flexDirection: 'row',
  },
  rowLabelCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cell: {
    borderRadius: 1,
    overflow: 'hidden',
  },
  cellPressed: {
    backgroundColor: GameColors.cellPressed,
  },
  labelText: {
    color: GameColors.label,
    textAlign: 'center',
    width: '100%',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
