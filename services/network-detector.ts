import NetInfo from '@react-native-community/netinfo';

export type NetworkPath = 'lan' | 'nfc-webrtc';

function toPath(type: string): NetworkPath {
  return type === 'wifi' || type === 'other' ? 'lan' : 'nfc-webrtc';
}

/** Returns the best connection path for the current network state. */
export async function getNetworkPath(): Promise<NetworkPath> {
  const state = await NetInfo.fetch();
  return toPath(state.type);
}

/**
 * Subscribes to network changes. Calls handler immediately with the current
 * path, then again on every network-type transition. Returns an unsubscribe
 * function.
 */
export function onNetworkChange(handler: (path: NetworkPath) => void): () => void {
  return NetInfo.addEventListener(state => handler(toPath(state.type)));
}
