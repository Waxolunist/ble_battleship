import { fileSystemStorage } from '@/store/persistence';

const TOUR_KEYS = ['@tour_guide:placement', '@tour_guide:battle'];

export function resetTutorials(): void {
  for (const key of TOUR_KEYS) {
    fileSystemStorage.removeItem(key);
  }
}
