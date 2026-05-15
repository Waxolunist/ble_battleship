import { useWindowDimensions } from 'react-native';

const BASE_WIDTH = 412; // Pixel 7 reference width

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const scale = width / BASE_WIDTH; // ~0.874 on S22, 1.0 on Pixel 7, ~1.087 on Pixel 9 Pro Max

  /** Scale a pixel value relative to the base width */
  const s = (size: number) => Math.round(size * scale);

  /** Scale font size (clamped: floor at 80% to stay legible, cap at 120% to stay balanced) */
  const fs = (size: number) => Math.round(Math.min(Math.max(size * scale, size * 0.8), size * 1.2));

  return { width, height, scale, s, fs };
}
