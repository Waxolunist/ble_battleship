import { HapticPressable } from '@/components/haptic-pressable';
import { Fonts, GameColors } from '@/constants/theme';
import { useBLEPermissions } from '@/hooks/useBLEPermissions';
import { useBLEStore } from '@/store/useBLEStore';
import { useCaptainStore } from '@/store/useCaptainStore';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useCallback } from 'react';
import { Alert, Animated, StyleSheet, Text, View } from 'react-native';
import { PlayerListItem } from './PlayerListItem';
import { bleService } from '@/services/ble';
import { bleDebugLog } from '@/services/ble-debug-log';

interface BLEMultiplayerPanelProps {
  onHostPress?: () => void;
  onJoinPress?: () => void;
}

export function BLEMultiplayerPanel({ onHostPress, onJoinPress }: BLEMultiplayerPanelProps) {
  const { t } = useTranslation('common');
  const { available, isChecking, requestPermissions } = useBLEPermissions();
  const { state, discoveredPeers, setState, connectedPeer, addDiscoveredPeer, setConnectedPeer } =
    useBLEStore();
  const { captainName } = useCaptainStore();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Surface BLE disconnects (out-of-range, peer left) as an alert and reset.
  useEffect(() => {
    bleService.setOnDisconnect(() => {
      bleDebugLog.push('event', 'UI: connection lost → IDLE');
      Alert.alert(t('ble.connectionLost'), t('ble.connectionLostMessage'));
      setConnectedPeer(null);
      setState('IDLE');
    });
    return () => bleService.setOnDisconnect(null);
  }, [setState, setConnectedPeer, t]);

  // Host: HELLO handshake just completed (validated magic + protocol version).
  // The peer name comes from the joiner's HELLO payload, so we display the
  // real callsign instead of a generic placeholder.
  useEffect(() => {
    bleService.setOnCentralConnected((peerName: string) => {
      bleDebugLog.push('event', 'UI: host → LOBBY (HELLO accepted)', peerName);
      setConnectedPeer({
        id: 'remote',
        name: peerName || t('ble.opponent'),
        version: '1',
      });
      setState('LOBBY');
    });
    return () => bleService.setOnCentralConnected(null);
  }, [setState, setConnectedPeer, t]);

  // Pulsing animation for "AWAITING CHALLENGER..."
  useEffect(() => {
    if (state === 'HOST_ADVERTISING') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 600,
            useNativeDriver: false,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: false,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [state, pulseAnim]);

  const handleHostPress = useCallback(async () => {
    bleDebugLog.push('event', 'UI: HOST pressed');
    const permitted = await requestPermissions();
    bleDebugLog.push('info', `UI: permissions ${permitted ? 'granted' : 'denied'}`);
    if (permitted) {
      try {
        setState('HOST_ADVERTISING');
        await bleService.startAdvertising(captainName);
        onHostPress?.();
      } catch (error) {
        console.error('[UI] Failed to start advertising:', error);
        bleDebugLog.push('error', 'UI: host flow failed', String(error));
        setState('IDLE');
      }
    }
  }, [requestPermissions, setState, captainName, onHostPress]);

  const handleJoinPress = useCallback(async () => {
    bleDebugLog.push('event', 'UI: JOIN pressed');
    const permitted = await requestPermissions();
    bleDebugLog.push('info', `UI: permissions ${permitted ? 'granted' : 'denied'}`);
    if (permitted) {
      try {
        setState('SCANNING');
        await bleService.startScanning((id: string, name: string) => {
          addDiscoveredPeer({ id, name });
        });
        onJoinPress?.();
      } catch (error) {
        console.error('[UI] Failed to start scanning:', error);
        bleDebugLog.push('error', 'UI: join flow failed', String(error));
        setState('IDLE');
      }
    }
  }, [requestPermissions, setState, addDiscoveredPeer, onJoinPress]);

  const handleConnectToDevice = useCallback(
    async (deviceId: string, deviceName: string) => {
      bleDebugLog.push('event', 'UI: peer tapped → CONNECTING', deviceId);
      try {
        setState('CONNECTING');
        setState('HANDSHAKING');
        // connect() now exchanges HELLO with the host before resolving.
        // The returned name comes from the host's HELLO payload — fall back
        // to the advertised name (from scan) if HELLO didn't carry one.
        const peerName = await bleService.connect(deviceId, captainName);
        setConnectedPeer({
          id: deviceId,
          name: peerName || deviceName || t('ble.opponent'),
          version: '1',
        });
        setState('LOBBY');
      } catch (error) {
        console.error('[UI] Failed to connect:', error);
        bleDebugLog.push('error', 'UI: connect flow failed', String(error));
        setState('SCANNING');
      }
    },
    [setState, setConnectedPeer, captainName, t],
  );

  const handleCancel = useCallback(async () => {
    bleDebugLog.push('event', `UI: CANCEL from ${state}`);
    try {
      if (state === 'HOST_ADVERTISING') {
        await bleService.stopAdvertising();
      } else if (state === 'SCANNING') {
        await bleService.stopScanning();
      } else if (state === 'LOBBY' && connectedPeer) {
        await bleService.disconnect();
      }
    } catch (error) {
      console.error('[UI] Failed to cancel operation:', error);
      bleDebugLog.push('error', 'UI: cancel failed', String(error));
    }
    setState('IDLE');
  }, [state, connectedPeer, setState]);

  if (!available) {
    return null;
  }

  if (state === 'IDLE') {
    return (
      <View style={styles.panel}>
        <View style={styles.idleRow}>
          <Text style={styles.label}>⚔ 2-PLAYER</Text>
          <View style={styles.buttonRow}>
            <HapticPressable
              disabled={isChecking}
              onPress={handleHostPress}
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                isChecking && styles.buttonDisabled,
              ]}>
              <Text style={styles.buttonText}>{t('ble.host')}</Text>
            </HapticPressable>
            <HapticPressable
              disabled={isChecking}
              onPress={handleJoinPress}
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                isChecking && styles.buttonDisabled,
              ]}>
              <Text style={styles.buttonText}>{t('ble.join')}</Text>
            </HapticPressable>
          </View>
        </View>
      </View>
    );
  }

  if (state === 'HOST_ADVERTISING') {
    return (
      <View style={styles.panel}>
        <View style={styles.advertisingContainer}>
          <Animated.Text
            style={[
              styles.advertisingTitle,
              {
                opacity: pulseAnim,
              },
            ]}>
            {t('ble.awaitingChallenger')}
          </Animated.Text>
          <Text style={styles.callsignLabel}>
            {t('ble.yourCallsign')} {captainName}
          </Text>
          <View style={styles.cancelRow}>
            <HapticPressable
              onPress={handleCancel}
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
              <Text style={styles.buttonText}>{t('ble.cancel')}</Text>
            </HapticPressable>
          </View>
        </View>
      </View>
    );
  }

  if (state === 'SCANNING') {
    return (
      <View style={styles.panel}>
        <View style={styles.scanningContainer}>
          <Text style={styles.scanningTitle}>{t('ble.scanning')}</Text>
          <View style={styles.peerList}>
            {discoveredPeers.length === 0 ? (
              <Text style={styles.nopeersText}>{t('ble.noDevicesFound')}</Text>
            ) : (
              discoveredPeers.map(peer => (
                <PlayerListItem
                  key={peer.id}
                  name={peer.name}
                  onPress={() => {
                    handleConnectToDevice(peer.id, peer.name);
                  }}
                />
              ))
            )}
          </View>
          <View style={styles.cancelRow}>
            <HapticPressable
              onPress={handleCancel}
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
              <Text style={styles.buttonText}>{t('ble.cancel')}</Text>
            </HapticPressable>
          </View>
        </View>
      </View>
    );
  }

  if (state === 'CONNECTING' || state === 'HANDSHAKING') {
    return (
      <View style={styles.panel}>
        <View style={styles.handshakingContainer}>
          <Text style={styles.handshakingTitle}>{t('ble.connecting')}</Text>
          <View style={styles.cancelRow}>
            <HapticPressable
              onPress={handleCancel}
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
              <Text style={styles.buttonText}>{t('ble.cancel')}</Text>
            </HapticPressable>
          </View>
        </View>
      </View>
    );
  }

  if (state === 'LOBBY' && connectedPeer) {
    return (
      <View style={styles.panel}>
        <View style={styles.lobbyContainer}>
          <View style={styles.lobbyRow}>
            <Text style={styles.checkmark}>✓</Text>
            <Text style={styles.opponentName}>{connectedPeer.name}</Text>
            <Text style={styles.statusText}>— {t('ble.connected')}</Text>
          </View>
        </View>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 30,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 20,
    zIndex: 10,
  },
  idleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: GameColors.blueBorder,
    borderRadius: 4,
    backgroundColor: GameColors.navyBg,
  },
  label: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: Fonts.rounded,
    letterSpacing: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#fff',
    borderRadius: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  buttonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 3,
  },
  advertisingContainer: {
    borderWidth: 1,
    borderColor: GameColors.blueBorder,
    borderRadius: 4,
    backgroundColor: GameColors.navyBg,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  advertisingTitle: {
    color: GameColors.gold,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: Fonts.rounded,
    letterSpacing: 1,
    textAlign: 'center',
  },
  callsignLabel: {
    color: GameColors.label,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Fonts.rounded,
    letterSpacing: 1,
    textAlign: 'center',
  },
  scanningContainer: {
    borderWidth: 1,
    borderColor: GameColors.blueBorder,
    borderRadius: 4,
    backgroundColor: GameColors.navyBg,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  scanningTitle: {
    color: GameColors.label,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Fonts.rounded,
    letterSpacing: 1,
    paddingVertical: 8,
  },
  peerList: {
    marginVertical: 8,
  },
  nopeersText: {
    color: GameColors.labelDim,
    fontSize: 12,
    fontFamily: Fonts.rounded,
    textAlign: 'center',
    paddingVertical: 8,
  },
  cancelRow: {
    alignItems: 'flex-end',
    paddingVertical: 8,
  },
  handshakingContainer: {
    borderWidth: 1,
    borderColor: GameColors.blueBorder,
    borderRadius: 4,
    backgroundColor: GameColors.navyBg,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  handshakingTitle: {
    color: GameColors.label,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Fonts.rounded,
    letterSpacing: 1,
    textAlign: 'center',
  },
  lobbyContainer: {
    borderWidth: 1,
    borderColor: GameColors.blueBorder,
    borderRadius: 4,
    backgroundColor: GameColors.navyBg,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  lobbyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  checkmark: {
    color: GameColors.gold,
    fontSize: 14,
    fontWeight: '700',
  },
  opponentName: {
    color: GameColors.gold,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: Fonts.rounded,
    letterSpacing: 1,
  },
  statusText: {
    color: GameColors.label,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Fonts.rounded,
  },
});
