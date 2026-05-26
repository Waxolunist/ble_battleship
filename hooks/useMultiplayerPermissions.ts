import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import NfcManager from 'react-native-nfc-manager';
import { getNetworkPath } from '@/services/network-detector';

export interface MultiplayerPermissionStatus {
  /** False only on web — both LAN and NFC paths require native. */
  available: boolean;
  /**
   * On Android: NFC is enabled in device settings (required for the
   * NFC+WebRTC path). On iOS: NFC hardware is present (no runtime permission
   * needed beyond the entitlement). Always true on the LAN path.
   */
  permissionsGranted: boolean;
  isChecking: boolean;
}

export function useMultiplayerPermissions() {
  const [status, setStatus] = useState<MultiplayerPermissionStatus>({
    available: true,
    permissionsGranted: false,
    isChecking: false,
  });

  useEffect(() => {
    void checkPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkPermissions = useCallback(async () => {
    if (Platform.OS === 'web') {
      setStatus({ available: false, permissionsGranted: false, isChecking: false });
      return;
    }

    // Buttons are usable immediately — don't block on the NFC probe.
    setStatus({ available: true, permissionsGranted: false, isChecking: false });

    // Update permissionsGranted in the background (used for display only).
    try {
      let nfcSupported = false;
      let nfcEnabled = false;
      nfcSupported = await NfcManager.isSupported();
      if (nfcSupported) nfcEnabled = await NfcManager.isEnabled();
      const permissionsGranted = Platform.OS === 'ios' ? nfcSupported : nfcEnabled;
      setStatus(s => ({ ...s, permissionsGranted }));
    } catch {
      // NFC bridge not available (simulator / dev build without NFC module)
    }
  }, []);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') return false;

    // iOS: no runtime permissions needed. LAN fires a system prompt automatically
    // on first mDNS use; NFC capability is granted via entitlement at build time.
    if (Platform.OS === 'ios') return true;

    // Android: if we'll take the NFC+WebRTC path, NFC must be enabled in settings.
    const path = await getNetworkPath();
    if (path === 'nfc-webrtc') {
      let enabled = false;
      try {
        enabled = await NfcManager.isEnabled();
      } catch {
        // ignore
      }
      if (!enabled) {
        Linking.openSettings();
        return false;
      }
    }

    return true;
  }, []);

  return {
    ...status,
    requestPermissions,
    checkAvailability: checkPermissions,
  };
}
