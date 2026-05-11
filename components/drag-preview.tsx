import { Image, ImageSourcePropType, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import type { ShipType } from '@/models/types';
import { SHIP_SIZES } from '@/models/types';
import { IMAGES } from '@/constants/assets';

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
    <View style={[styles.cell, index < totalCells - 1 && styles.gapH]}>
      <Image
        source={image}
        style={{
          position: 'absolute',
          top: 0,
          height: CELL_SIZE,
          width: totalWidth,
          left: -offsetX,
        }}
        resizeMode="stretch"
      />
      <View style={styles.cellTileOverlay} />
    </View>
  );
}

interface DragPreviewProps {
  ship: ShipType | null;
  orientation: 'horizontal' | 'vertical';
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
}

export function DragPreview({ ship, orientation, dragX, dragY }: DragPreviewProps) {
  const size = ship ? SHIP_SIZES[ship] : 1;
  const image = ship ? SHIP_IMAGES[ship] : undefined;

  // Always lay out horizontally; rotate 90° for vertical so the sprite stays intact.
  const totalWidth = size * CELL_SIZE + (size - 1) * CELL_GAP;
  const totalHeight = CELL_SIZE;

  // Rotating around the element center keeps (dragX, dragY) at the visual center.
  const animStyle = useAnimatedStyle(() => ({
    left: dragX.value - totalWidth / 2,
    top: dragY.value - totalHeight / 2 - 48,
    opacity: ship ? 0.88 : 0,
    transform: [{ rotate: orientation === 'vertical' ? '90deg' : '0deg' }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.container, { width: totalWidth, height: totalHeight }, animStyle]}>
      {Array.from({ length: size }).map((_, i) =>
        image ? (
          <SpriteCell key={i} image={image} index={i} totalCells={size} />
        ) : (
          <View key={i} style={[styles.cell, i < size - 1 && styles.gapH]} />
        ),
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 999,
    flexDirection: 'row',
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(120, 200, 255, 0.9)',
    backgroundColor: 'rgba(60, 130, 220, 0.85)',
    overflow: 'hidden',
  },
  gapH: {
    marginRight: CELL_GAP,
  },
  cellTileOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(30, 60, 130, 0.2)',
  },
});
