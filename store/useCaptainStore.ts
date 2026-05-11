import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { fileSystemStorage } from './persistence';

interface CaptainState {
  captainName: string;
  setCaptainName: (name: string) => void;
  clearCaptainName: () => void;
}

export const useCaptainStore = create<CaptainState>()(
  persist(
    set => ({
      captainName: '',
      setCaptainName: (name: string) => set({ captainName: name }),
      clearCaptainName: () => set({ captainName: '' }),
    }),
    {
      name: 'captain',
      storage: createJSONStorage(() => fileSystemStorage),
    },
  ),
);
