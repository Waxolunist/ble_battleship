import type { ShipType } from '@/models/types';
import { create } from 'zustand';

export type BLEState =
  | 'IDLE'
  | 'HOST_ADVERTISING'
  | 'SCANNING'
  | 'CONNECTING'
  | 'HANDSHAKING'
  | 'LOBBY'
  | 'PLACEMENT'
  | 'BATTLE'
  | 'GAME_OVER';

export type GameMode = 'ai' | 'ble';

export type FleetPlacement = {
  shipType: ShipType;
  x: number; // origin column (0–9)
  y: number; // origin row (0–9)
  orientation: 'horizontal' | 'vertical';
};

export interface PeerInfo {
  id: string;
  name: string;
  version: string;
}

export interface DiscoveredPeer {
  id: string;
  name: string;
}

interface BLEStoreState {
  state: BLEState;
  mode: GameMode;
  connectedPeer: PeerInfo | null;
  discoveredPeers: DiscoveredPeer[];
  opponentFleet: FleetPlacement[] | null;
  localFleetReady: boolean;
  remoteFleetReady: boolean;
}

interface BLEStoreActions {
  setState: (state: BLEState) => void;
  setMode: (mode: GameMode) => void;
  setConnectedPeer: (peer: PeerInfo | null) => void;
  setDiscoveredPeers: (peers: DiscoveredPeer[]) => void;
  addDiscoveredPeer: (peer: DiscoveredPeer) => void;
  removeDiscoveredPeer: (peerId: string) => void;
  setOpponentFleet: (fleet: FleetPlacement[] | null) => void;
  setLocalFleetReady: (ready: boolean) => void;
  setRemoteFleetReady: (ready: boolean) => void;
  reset: () => void;
}

export const useBLEStore = create<BLEStoreState & BLEStoreActions>(set => ({
  state: 'IDLE',
  mode: 'ai',
  connectedPeer: null,
  discoveredPeers: [],
  opponentFleet: null,
  localFleetReady: false,
  remoteFleetReady: false,

  setState: (state: BLEState) => set({ state }),

  setMode: (mode: GameMode) => set({ mode }),

  setConnectedPeer: (peer: PeerInfo | null) => set({ connectedPeer: peer }),

  setDiscoveredPeers: (peers: DiscoveredPeer[]) => set({ discoveredPeers: peers }),

  addDiscoveredPeer: (peer: DiscoveredPeer) => {
    set(s => {
      const exists = s.discoveredPeers.some(p => p.id === peer.id);
      if (exists) return {};
      return { discoveredPeers: [...s.discoveredPeers, peer] };
    });
  },

  removeDiscoveredPeer: (peerId: string) => {
    set(s => ({
      discoveredPeers: s.discoveredPeers.filter(p => p.id !== peerId),
    }));
  },

  setOpponentFleet: (fleet: FleetPlacement[] | null) => set({ opponentFleet: fleet }),

  setLocalFleetReady: (ready: boolean) => set({ localFleetReady: ready }),

  setRemoteFleetReady: (ready: boolean) => set({ remoteFleetReady: ready }),

  reset: () => {
    set({
      state: 'IDLE',
      mode: 'ai',
      connectedPeer: null,
      discoveredPeers: [],
      opponentFleet: null,
      localFleetReady: false,
      remoteFleetReady: false,
    });
  },
}));
