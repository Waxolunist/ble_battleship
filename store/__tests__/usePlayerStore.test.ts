jest.mock('@/store/persistence', () => ({
  fileSystemStorage: { getItem: async () => null, setItem: () => {}, removeItem: () => {} },
}));

import { getPlayerId, usePlayerStore } from '@/store/usePlayerStore';

describe('player identity', () => {
  beforeEach(() => usePlayerStore.setState({ playerId: '' }));

  it('mints an id on first use', () => {
    expect(usePlayerStore.getState().playerId).toBe('');
    expect(getPlayerId()).toMatch(/^[0-9a-f]{16}$/);
  });

  it('keeps returning the same id once minted', () => {
    const first = getPlayerId();
    expect(getPlayerId()).toBe(first);
    expect(getPlayerId()).toBe(first);
  });

  it('persists the minted id into the store', () => {
    const id = getPlayerId();
    expect(usePlayerStore.getState().playerId).toBe(id);
  });

  it('gives different installs different ids', () => {
    const a = getPlayerId();
    usePlayerStore.setState({ playerId: '' });
    expect(getPlayerId()).not.toBe(a);
  });
});
