import { useTranslation } from 'react-i18next';
import { Alert, Linking, Platform } from 'react-native';
import { useCallback, useEffect, useState } from 'react';

interface BLEPermissionStatus {
  available: boolean;
  bluetoothEnabled: boolean;
  permissionGranted: boolean;
}

/**
 * Hook for checking Bluetooth availability and requesting permissions.
 * Returns the current permission status and a function to request permissions.
 */
export function useBLEPermissions() {
  const { t } = useTranslation('common');
  const [status, setStatus] = useState<BLEPermissionStatus>({
    available: true,
    bluetoothEnabled: true,
    permissionGranted: false,
  });
  const [isChecking, setIsChecking] = useState(false);

  // Check if BLE is available on the device
  useEffect(() => {
    checkBLEAvailability();
  }, []);

  const checkBLEAvailability = useCallback(async () => {
    setIsChecking(true);
    try {
      // BLE is available on iOS and Android, but the native module
      // (munim-bluetooth) only loads on a native build, not Expo Go.
      // We show the UI in all environments to allow testing the flow;
      // the BLE service gracefully handles the missing native module.
      const available = Platform.OS !== 'web';
      setStatus(prev => ({ ...prev, available }));
    } finally {
      setIsChecking(false);
    }
  }, []);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    setIsChecking(true);
    try {
      // Permission request would be handled here
      // For now, we assume permissions are granted after the user accepts the native prompt
      // In a real implementation, this would call native permission APIs

      // Check if Bluetooth is enabled (this is a simplified check)
      const bluetoothEnabled = status.bluetoothEnabled;

      if (!bluetoothEnabled) {
        // Bluetooth is off - show alert with deep-link to settings
        Alert.alert(t('ble.bluetoothOff'), t('ble.bluetoothOffMessage'), [
          {
            text: t('ble.openSettings'),
            onPress: () => {
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings://');
              } else {
                Linking.openURL('android.settings.BLUETOOTH_SETTINGS');
              }
            },
          },
          { text: t('ble.cancel'), style: 'cancel' },
        ]);
        return false;
      }

      // Permissions granted
      setStatus(prev => ({ ...prev, permissionGranted: true }));
      return true;
    } finally {
      setIsChecking(false);
    }
  }, [status.bluetoothEnabled, t]);

  return {
    ...status,
    isChecking,
    requestPermissions,
    checkAvailability: checkBLEAvailability,
  };
}
