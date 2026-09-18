import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

export interface MultiplayerPermissionStatus {
  /** False only on web — the LAN transport requires native. */
  available: boolean;
  isChecking: boolean;
}

export function useMultiplayerPermissions() {
  const [status, setStatus] = useState<MultiplayerPermissionStatus>({
    available: true,
    isChecking: false,
  });

  const checkAvailability = useCallback(() => {
    setStatus({ available: Platform.OS !== 'web', isChecking: false });
  }, []);

  useEffect(() => {
    checkAvailability();
  }, [checkAvailability]);

  /**
   * iOS fires the local-network prompt automatically on first mDNS use and
   * Android needs no runtime permission for it, so there is nothing to ask for.
   */
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    return Platform.OS !== 'web';
  }, []);

  return { ...status, requestPermissions, checkAvailability };
}
