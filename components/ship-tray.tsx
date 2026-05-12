import { HapticPressable } from '@/components/haptic-pressable';
import { IMAGES } from '@/constants/assets';
import { GameColors } from '@/constants/theme';
import type { ShipType } from '@/models/types';
import { SHIP_FLEET, SHIP_SIZES } from '@/models/types';
import { forwardRef } from 'react';
import { Image, ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';
import Animated, { runOnJS } from 'react-native-reanimated';

const CELL_SIZE = 28;
const CELL_GAP = 2;

const SHIP_IMAGES: Partial<Record<ShipType, ImageSourcePropType>> = {
  Carrier: IMAGES.carrier,
  Submarine: IMAGES.submarine,
  Destroyer: IMAGES.destroyer,
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
  orientation: 'horizontal' | 'vertical';
  onOrientationToggle: () => void;
  onDragStart: (x: number, y: number) => void;
  onDragging: (x: number, y: number) => void;
  onDragEnd: (x: number, y: number) => void;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  rotateRef?: React.RefObject<View | null>;
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
  rotateRef,
}: ShipRowProps) {
  const size = SHIP_SIZES[type];
  const image = SHIP_IMAGES[type];

  const pan = Gesture.Pan()
    .enabled(!isPlaced)
    .minDistance(4)
    .onStart(e => {
      dragX.value = e.absoluteX;
      dragY.value = e.absoluteY;
      runOnJS(onDragStart)(e.absoluteX, e.absoluteY);
    })
    .onUpdate(e => {
      dragX.value = e.absoluteX;
      dragY.value = e.absoluteY;
      runOnJS(onDragging)(e.absoluteX, e.absoluteY);
    })
    .onEnd(e => {
      runOnJS(onDragEnd)(e.absoluteX, e.absoluteY);
    });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.shipRow, isPlaced && styles.shipRowPlaced]}>
        {/* Orientation toggle */}
        <Pressable
          ref={rotateRef}
          onPress={isPlaced ? undefined : onOrientationToggle}
          style={[styles.rotateButton, isPlaced && styles.rotateButtonPlaced]}
          hitSlop={6}>
          <Text style={styles.rotateIcon}>{orientation === 'horizontal' ? '↔' : '↕'}</Text>
        </Pressable>

        <Text numberOfLines={1} style={[styles.shipLabel, isPlaced && styles.shipLabelPlaced]}>
          {type.toUpperCase()}
        </Text>

        <View style={styles.cells}>
          {Array.from({ length: size }).map((_, i) =>
            image ? (
              <SpriteCell key={i} image={image} index={i} totalCells={size} />
            ) : (
              <View
                key={i}
                style={[styles.cell, styles.cellSolid, isPlaced && styles.cellPlaced]}
              />
            ),
          )}
        </View>

        <Text style={[styles.placedBadge, !isPlaced && styles.placedBadgeHidden]}>✓</Text>
      </Animated.View>
    </GestureDetector>
  );
}

export interface ShipTrayProps {
  placedShips: Set<ShipType>;
  orientations: Record<ShipType, 'horizontal' | 'vertical'>;
  onOrientationToggle: (ship: ShipType) => void;
  onDragStart: (ship: ShipType, x: number, y: number) => void;
  onDragging: (x: number, y: number) => void;
  onDragEnd: (x: number, y: number) => void;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  onRandomize: () => void;
  rotateRef?: React.RefObject<View | null>;
  shuffleRef?: React.RefObject<View | null>;
}

export const ShipTray = forwardRef<View, ShipTrayProps>(function ShipTray(
  {
    placedShips,
    orientations,
    onOrientationToggle,
    onDragStart,
    onDragging,
    onDragEnd,
    dragX,
    dragY,
    onRandomize,
    rotateRef,
    shuffleRef,
  }: ShipTrayProps,
  ref,
) {
  return (
    <View ref={ref} style={styles.tray}>
      <Text style={styles.trayTitle}>FLEET</Text>
      <View style={styles.shipList}>
        {SHIP_FLEET.map((type, index) => (
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
            rotateRef={index === 0 ? rotateRef : undefined}
          />
        ))}
      </View>
      <HapticPressable
        ref={shuffleRef}
        onPress={onRandomize}
        style={({ pressed }) => [styles.shuffleButton, pressed && styles.shuffleButtonPressed]}>
        <Text style={styles.shuffleIcon}>⇄</Text>
      </HapticPressable>
    </View>
  );
});

const styles = StyleSheet.create({
  tray: {
    borderWidth: 1,
    borderColor: GameColors.blueTint,
    borderRadius: 4,
    backgroundColor: GameColors.trayBg,
    paddingHorizontal: 12,
    paddingVertical: 16,
    gap: 10,
  },
  trayTitle: {
    color: GameColors.label,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    textAlign: 'center',
  },
  shipList: {
    gap: 8,
  },
  shipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shipRowPlaced: {
    opacity: 0.45,
  },
  rotateButton: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: GameColors.blueBorder,
    backgroundColor: GameColors.blueButton,
  },
  rotateButtonPlaced: {
    borderColor: GameColors.blueBorderDim,
  },
  rotateIcon: {
    color: GameColors.labelBright,
    fontSize: 11,
    lineHeight: 14,
  },
  shipLabel: {
    color: GameColors.labelDim,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    width: 100,
  },
  shipLabelPlaced: {
    color: GameColors.labelFaded,
  },
  cells: {
    flexDirection: 'row',
    gap: CELL_GAP,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: GameColors.blueBorder,
    overflow: 'hidden',
  },
  cellSolid: {
    backgroundColor: GameColors.shipCellBg,
  },
  cellPlaced: {
    backgroundColor: GameColors.shipCellPlaced,
  },
  spriteImage: {
    position: 'absolute',
    top: 0,
    height: CELL_SIZE,
  },
  cellTileOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: GameColors.shipCellOverlay,
  },
  shuffleButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 32,
    height: 32,
    backgroundColor: '#000',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shuffleButtonPressed: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  shuffleIcon: {
    color: '#fff',
    fontSize: 22,
    lineHeight: 26,
    textAlign: 'center',
    includeFontPadding: false,
    width: '100%',
    height: '100%',
  },
  placedBadge: {
    color: GameColors.placedBadge,
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 4,
    width: 18,
  },
  placedBadgeHidden: {
    opacity: 0,
  },
});
