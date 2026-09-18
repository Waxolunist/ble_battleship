import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { fileSystemStorage } from './persistence';

/**
 * A stable identity for this install, generated once and kept forever.
 *
 * Captain names are not identities: two players can both be CHRIS, and a
 * player can rename mid-session. mDNS makes that worse — publishing a service
 * whose name is already taken gets it silently renamed to "CHRIS (2)", so the
 * same phone can appear several times under different names. Keying on this id
 * instead makes a peer one peer, whatever it calls itself.
 *
 * Not a secret and not an account: it identifies a device to other players on
 * the same network, nothing more.
 */
interface PlayerState {
  playerId: string;
}

function generatePlayerId(): string {
  let id = '';
  for (let i = 0; i < 16; i++) id += Math.floor(Math.random() * 16).toString(16);
  return id;
}

export const usePlayerStore = create<PlayerState>()(
  persist(() => ({ playerId: '' }), {
    name: 'player',
    storage: createJSONStorage(() => fileSystemStorage),
    // Minted on the first launch that finds nothing stored, then persisted.
    onRehydrateStorage: () => state => {
      if (!state?.playerId) usePlayerStore.setState({ playerId: generatePlayerId() });
    },
  }),
);

/** Read the id outside React — services have no hooks. */
export function getPlayerId(): string {
  const { playerId } = usePlayerStore.getState();
  if (playerId) return playerId;
  const id = generatePlayerId();
  usePlayerStore.setState({ playerId: id });
  return id;
}
