import type { NetworkPath } from '@/services/network-detector';
import type { ShipType } from '@/models/types';
import { create } from 'zustand';

export type MultiplayerState =
  | 'IDLE'
  | 'HOST_ADVERTISING'
  | 'SCANNING'
  | 'CONNECTING'
  | 'HANDSHAKING'
  | 'LOBBY'
  | 'PLACEMENT'
  | 'BATTLE'
  | 'GAME_OVER';

export type GameMode = 'ai' | 'multiplayer';

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

interface MultiplayerStoreState {
  state: MultiplayerState;
  mode: GameMode;
  /** The transport path chosen for the current session, or null when idle. */
  connectionPath: NetworkPath | null;
  connectedPeer: PeerInfo | null;
  discoveredPeers: DiscoveredPeer[];
  opponentFleet: FleetPlacement[] | null;
  localFleetReady: boolean;
  remoteFleetReady: boolean;
}

interface MultiplayerStoreActions {
  setState: (state: MultiplayerState) => void;
  setMode: (mode: GameMode) => void;
  setConnectionPath: (path: NetworkPath | null) => void;
  setConnectedPeer: (peer: PeerInfo | null) => void;
  setDiscoveredPeers: (peers: DiscoveredPeer[]) => void;
  addDiscoveredPeer: (peer: DiscoveredPeer) => void;
  removeDiscoveredPeer: (peerId: string) => void;
  setOpponentFleet: (fleet: FleetPlacement[] | null) => void;
  setLocalFleetReady: (ready: boolean) => void;
  setRemoteFleetReady: (ready: boolean) => void;
  reset: () => void;
}

export const useMultiplayerStore = create<MultiplayerStoreState & MultiplayerStoreActions>(set => ({
  state: 'IDLE',
  mode: 'ai',
  connectionPath: null,
  connectedPeer: null,
  discoveredPeers: [],
  opponentFleet: null,
  localFleetReady: false,
  remoteFleetReady: false,

  setState: (state: MultiplayerState) => set({ state }),

  setMode: (mode: GameMode) => set({ mode }),

  setConnectionPath: (connectionPath: NetworkPath | null) => set({ connectionPath }),

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
      connectionPath: null,
      connectedPeer: null,
      discoveredPeers: [],
      opponentFleet: null,
      localFleetReady: false,
      remoteFleetReady: false,
    });
  },
}));
