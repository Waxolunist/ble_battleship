import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import NfcManager from 'react-native-nfc-manager';

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
    setStatus(s => ({ ...s, isChecking: true }));
    try {
      if (Platform.OS === 'web') {
        setStatus({ available: false, permissionsGranted: false, isChecking: false });
        return;
      }

      let nfcSupported = false;
      let nfcEnabled = false;
      try {
        nfcSupported = await NfcManager.isSupported();
        if (nfcSupported) {
          nfcEnabled = await NfcManager.isEnabled();
        }
      } catch {
        // NFC bridge not available (simulator / dev build without NFC module)
      }

      // LAN (WiFi) path never requires a runtime permission grant — the iOS
      // local-network prompt fires automatically on first mDNS use. We count
      // multiplayer as available as long as we are on a native platform.
      // permissionsGranted reflects whether the NFC path is usable; the LAN
      // path is always usable on native.
      const permissionsGranted = Platform.OS === 'ios' ? nfcSupported : nfcEnabled;

      setStatus({ available: true, permissionsGranted, isChecking: false });
    } catch {
      setStatus({ available: true, permissionsGranted: false, isChecking: false });
    }
  }, []);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      // On Android, NFC is enabled/disabled in system settings — there is no
      // runtime permission dialog. Guide the user there if NFC is off.
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

    // Re-check NFC state and return the fresh result directly rather than
    // reading from the (stale) React state closure.
    if (Platform.OS === 'web') return false;
    let nfcSupported = false;
    let nfcEnabled = false;
    try {
      nfcSupported = await NfcManager.isSupported();
      if (nfcSupported) nfcEnabled = await NfcManager.isEnabled();
    } catch {
      // ignore
    }
    const granted = Platform.OS === 'ios' ? nfcSupported : nfcEnabled;
    setStatus({ available: true, permissionsGranted: granted, isChecking: false });
    return granted;
  }, []);

  return {
    ...status,
    requestPermissions,
    checkAvailability: checkPermissions,
  };
}
