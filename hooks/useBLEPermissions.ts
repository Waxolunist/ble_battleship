import { useTranslation } from 'react-i18next';
import { Alert, Linking, Platform } from 'react-native';
import { useCallback, useEffect, useState } from 'react';

interface BLEPermissionStatus {
  available: boolean;
  bluetoothEnabled: boolean;
  permissionGranted: boolean;
}

type MunimBLE = typeof import('munim-bluetooth');

let bleModule: MunimBLE | null = null;
let bleModuleLoaded = false;

const loadBLE = (): MunimBLE | null => {
  if (bleModuleLoaded) return bleModule;
  bleModuleLoaded = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    bleModule = require('munim-bluetooth') as MunimBLE;
  } catch {
    bleModule = null;
  }
  return bleModule;
};

/**
 * Hook for checking Bluetooth availability and requesting runtime permissions
 * via munim-bluetooth's native bridge (Android: BLUETOOTH_SCAN/CONNECT/ADVERTISE
 * + ACCESS_FINE_LOCATION on Android < 12; iOS: CBManager authorization check).
 */
export function useBLEPermissions() {
  const { t } = useTranslation('common');
  const [status, setStatus] = useState<BLEPermissionStatus>({
    available: true,
    bluetoothEnabled: false,
    permissionGranted: false,
  });
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    void checkBLEAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkBLEAvailability = useCallback(async () => {
    setIsChecking(true);
    try {
      if (Platform.OS === 'web') {
        setStatus({ available: false, bluetoothEnabled: false, permissionGranted: false });
        return;
      }
      const ble = loadBLE();
      if (!ble) {
        // Native module unavailable (Expo Go / simulator without rebuild).
        setStatus({ available: false, bluetoothEnabled: false, permissionGranted: false });
        return;
      }
      let bluetoothEnabled = false;
      try {
        bluetoothEnabled = await ble.isBluetoothEnabled();
      } catch (e) {
        console.warn('[BLE perms] isBluetoothEnabled threw:', e);
      }
      setStatus(prev => ({ ...prev, available: true, bluetoothEnabled }));
    } finally {
      setIsChecking(false);
    }
  }, []);

  const openSettings = useCallback(() => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  }, []);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    setIsChecking(true);
    try {
      const ble = loadBLE();
      if (!ble) {
        return false;
      }

      let granted = false;
      try {
        granted = await ble.requestBluetoothPermission();
      } catch (e) {
        console.warn('[BLE perms] requestBluetoothPermission threw:', e);
        granted = false;
      }

      if (!granted) {
        Alert.alert(t('ble.permissionDenied'), t('ble.permissionDeniedMessage'), [
          { text: t('ble.openSettings'), onPress: openSettings },
          { text: t('ble.cancel'), style: 'cancel' },
        ]);
        setStatus(prev => ({ ...prev, permissionGranted: false }));
        return false;
      }

      let bluetoothEnabled = false;
      try {
        bluetoothEnabled = await ble.isBluetoothEnabled();
      } catch (e) {
        console.warn('[BLE perms] isBluetoothEnabled threw:', e);
      }

      if (!bluetoothEnabled) {
        Alert.alert(t('ble.bluetoothOff'), t('ble.bluetoothOffMessage'), [
          { text: t('ble.openSettings'), onPress: openSettings },
          { text: t('ble.cancel'), style: 'cancel' },
        ]);
        setStatus(prev => ({ ...prev, permissionGranted: true, bluetoothEnabled: false }));
        return false;
      }

      setStatus(prev => ({ ...prev, permissionGranted: true, bluetoothEnabled: true }));
      return true;
    } finally {
      setIsChecking(false);
    }
  }, [t, openSettings]);

  return {
    ...status,
    isChecking,
    requestPermissions,
    checkAvailability: checkBLEAvailability,
  };
}
