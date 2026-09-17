import NetInfo from '@react-native-community/netinfo';
import { getNetworkPath, onNetworkChange, toPath } from '@/services/network-detector';

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: jest.fn(), addEventListener: jest.fn() },
}));

const mockNetInfo = NetInfo as jest.Mocked<typeof NetInfo>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('toPath', () => {
  it.each(['wifi', 'other'])('routes %s to the LAN transport', type => {
    expect(toPath(type)).toBe('lan');
  });

  it.each(['cellular', 'none', 'unknown', 'bluetooth', 'ethernet', 'wimax', 'vpn'])(
    'routes %s to the NFC+WebRTC transport',
    type => {
      expect(toPath(type)).toBe('nfc-webrtc');
    },
  );

  it('is case sensitive — an unexpected casing does not reach LAN', () => {
    expect(toPath('WiFi')).toBe('nfc-webrtc');
  });

  it('routes an empty type to NFC+WebRTC rather than throwing', () => {
    expect(toPath('')).toBe('nfc-webrtc');
  });
});

describe('getNetworkPath', () => {
  it('resolves to the path for the current connection type', async () => {
    mockNetInfo.fetch.mockResolvedValue({ type: 'wifi' } as never);
    await expect(getNetworkPath()).resolves.toBe('lan');
  });

  it('falls back to NFC+WebRTC off-wifi', async () => {
    mockNetInfo.fetch.mockResolvedValue({ type: 'cellular' } as never);
    await expect(getNetworkPath()).resolves.toBe('nfc-webrtc');
  });

  it('queries NetInfo once per call', async () => {
    mockNetInfo.fetch.mockResolvedValue({ type: 'wifi' } as never);
    await getNetworkPath();
    expect(mockNetInfo.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('onNetworkChange', () => {
  it('maps each NetInfo event to a path before calling the handler', () => {
    let emit!: (state: { type: string }) => void;
    mockNetInfo.addEventListener.mockImplementation(cb => {
      emit = cb as unknown as (state: { type: string }) => void;
      return jest.fn();
    });

    const handler = jest.fn();
    onNetworkChange(handler);

    emit({ type: 'wifi' });
    emit({ type: 'cellular' });
    emit({ type: 'other' });

    expect(handler.mock.calls.map(c => c[0])).toEqual(['lan', 'nfc-webrtc', 'lan']);
  });

  it("returns NetInfo's unsubscribe function to the caller", () => {
    const unsubscribe = jest.fn();
    mockNetInfo.addEventListener.mockReturnValue(unsubscribe as never);
    expect(onNetworkChange(jest.fn())).toBe(unsubscribe);
  });
});
