import { HapticPressable } from '@/components/haptic-pressable';
import { Fonts, GameColors } from '@/constants/theme';
import { useMultiplayerPermissions } from '@/hooks/useMultiplayerPermissions';
import { useMultiplayerStore } from '@/store/useMultiplayerStore';
import { useCaptainStore } from '@/store/useCaptainStore';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useCallback } from 'react';
import { Alert, Animated, StyleSheet, Text, View } from 'react-native';
import { PlayerListItem } from './PlayerListItem';
import { multiplayerService } from '@/services/multiplayer';
import { multiplayerDebugLog } from '@/services/multiplayer-debug-log';

interface MultiplayerPanelProps {
  onHostPress?: () => void;
  onJoinPress?: () => void;
}

export function MultiplayerPanel({ onHostPress, onJoinPress }: MultiplayerPanelProps) {
  const { t } = useTranslation('common');
  const { available, isChecking, requestPermissions } = useMultiplayerPermissions();
  const { state, discoveredPeers, setState, connectedPeer, addDiscoveredPeer, setConnectedPeer } =
    useMultiplayerStore();
  const { captainName } = useCaptainStore();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Surface disconnects as an alert and reset.
  useEffect(() => {
    multiplayerService.setOnDisconnect(() => {
      // Already back to IDLE means the session was ended deliberately and the
      // battle screen has explained why — the socket closing behind it is not
      // news, and a second "connection lost" alert would be misleading.
      if (useMultiplayerStore.getState().state === 'IDLE') {
        multiplayerDebugLog.push('event', 'UI: disconnect after leaving — ignored');
        return;
      }
      multiplayerDebugLog.push('event', 'UI: connection lost → IDLE');
      Alert.alert(t('multiplayer.connectionLost'), t('multiplayer.connectionLostMessage'));
      setConnectedPeer(null);
      setState('IDLE');
    });
    return () => multiplayerService.setOnDisconnect(null);
  }, [setState, setConnectedPeer, t]);

  // Host: HELLO handshake completed — peer name comes from the HELLO payload.
  useEffect(() => {
    multiplayerService.setOnCentralConnected((peerName: string) => {
      multiplayerDebugLog.push('event', 'UI: host → LOBBY (HELLO accepted)', peerName);
      setConnectedPeer({
        id: 'remote',
        name: peerName || t('multiplayer.opponent'),
        version: '1',
      });
      setState('LOBBY');
    });
    return () => multiplayerService.setOnCentralConnected(null);
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

  const handleConnectToDevice = useCallback(
    async (deviceId: string, deviceName: string) => {
      multiplayerDebugLog.push('event', 'UI: peer tapped → CONNECTING', deviceId);
      try {
        setState('CONNECTING');
        setState('HANDSHAKING');
        const peerName = await multiplayerService.connect(deviceId, captainName);
        setConnectedPeer({
          id: deviceId,
          name: peerName || deviceName || t('multiplayer.opponent'),
          version: '1',
        });
        setState('LOBBY');
      } catch (error) {
        console.error('[UI] Failed to connect:', error);
        multiplayerDebugLog.push('error', 'UI: connect flow failed', String(error));
        setState('SCANNING');
      }
    },
    [setState, setConnectedPeer, captainName, t],
  );

  const handleHostPress = useCallback(async () => {
    multiplayerDebugLog.push('event', 'UI: HOST pressed');
    const permitted = await requestPermissions();
    multiplayerDebugLog.push('info', `UI: permissions ${permitted ? 'granted' : 'denied'}`);
    if (permitted) {
      try {
        setState('HOST_ADVERTISING');
        await multiplayerService.startAdvertising(captainName);
        onHostPress?.();
      } catch (error) {
        console.error('[UI] Failed to start advertising:', error);
        multiplayerDebugLog.push('error', 'UI: host flow failed', String(error));
        setState('IDLE');
      }
    }
  }, [requestPermissions, setState, captainName, onHostPress]);

  const handleJoinPress = useCallback(async () => {
    multiplayerDebugLog.push('event', 'UI: JOIN pressed');
    const permitted = await requestPermissions();
    multiplayerDebugLog.push('info', `UI: permissions ${permitted ? 'granted' : 'denied'}`);
    if (permitted) {
      try {
        setState('SCANNING');
        await multiplayerService.startScanning((id: string, name: string) => {
          addDiscoveredPeer({ id, name });
        });
        onJoinPress?.();
      } catch (error) {
        console.error('[UI] Failed to start scanning:', error);
        multiplayerDebugLog.push('error', 'UI: join flow failed', String(error));
        setState('IDLE');
      }
    }
  }, [requestPermissions, setState, addDiscoveredPeer, onJoinPress]);

  const handleCancel = useCallback(async () => {
    multiplayerDebugLog.push('event', `UI: CANCEL from ${state}`);
    try {
      if (state === 'HOST_ADVERTISING') {
        await multiplayerService.stopAdvertising();
      } else if (state === 'SCANNING') {
        await multiplayerService.stopScanning();
      } else if (state === 'LOBBY' && connectedPeer) {
        await multiplayerService.disconnect();
      }
    } catch (error) {
      console.error('[UI] Failed to cancel operation:', error);
      multiplayerDebugLog.push('error', 'UI: cancel failed', String(error));
    }
    setState('IDLE');
  }, [state, connectedPeer, setState]);

  // The home screen swaps the panel's slot for the captain-name input while the
  // name is unset. Tear down anything in flight so a half-finished host/join
  // cannot outlive the UI that would let the player cancel it.
  const nameEntryOpen = captainName.length === 0;
  useEffect(() => {
    if (nameEntryOpen && state !== 'IDLE') {
      void handleCancel();
    }
  }, [nameEntryOpen, state, handleCancel]);

  if (!available || nameEntryOpen) {
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
              <Text style={styles.buttonText}>{t('multiplayer.host')}</Text>
            </HapticPressable>
            <HapticPressable
              disabled={isChecking}
              onPress={handleJoinPress}
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                isChecking && styles.buttonDisabled,
              ]}>
              <Text style={styles.buttonText}>{t('multiplayer.join')}</Text>
            </HapticPressable>
          </View>
        </View>
      </View>
    );
  }

  // LAN path — HOST: show "WAITING FOR PLAYERS…" with the game room name.
  if (state === 'HOST_ADVERTISING') {
    return (
      <View style={styles.panel}>
        <View style={styles.advertisingContainer}>
          <Animated.Text style={[styles.advertisingTitle, { opacity: pulseAnim }]}>
            {t('multiplayer.awaitingChallenger')}
          </Animated.Text>
          <Text style={styles.callsignLabel}>
            {t('multiplayer.yourCallsign')} {captainName}
          </Text>
          <View style={styles.actionRow}>
            <HapticPressable
              onPress={handleCancel}
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
              <Text style={styles.buttonText}>{t('multiplayer.cancel')}</Text>
            </HapticPressable>
          </View>
        </View>
      </View>
    );
  }

  // LAN path — SCAN: show scrollable list of discovered nearby games.
  if (state === 'SCANNING') {
    return (
      <View style={styles.panel}>
        <View style={styles.scanningContainer}>
          <Text style={styles.scanningTitle}>{t('multiplayer.scanning')}</Text>
          <View style={styles.peerList}>
            {discoveredPeers.length === 0 ? (
              <Text style={styles.nopeersText}>{t('multiplayer.noDevicesFound')}</Text>
            ) : (
              discoveredPeers.map(peer => (
                <PlayerListItem
                  key={peer.id}
                  name={peer.name}
                  onPress={() => handleConnectToDevice(peer.id, peer.name)}
                />
              ))
            )}
          </View>
          <View style={styles.actionRow}>
            <HapticPressable
              onPress={handleCancel}
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
              <Text style={styles.buttonText}>{t('multiplayer.cancel')}</Text>
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
          <Text style={styles.handshakingTitle}>{t('multiplayer.connecting')}</Text>
          <View style={styles.cancelRow}>
            <HapticPressable
              onPress={handleCancel}
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
              <Text style={styles.buttonText}>{t('multiplayer.cancel')}</Text>
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
            <Text style={styles.statusText}>— {t('multiplayer.connected')}</Text>
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
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingVertical: 8,
  },
  switchHint: {
    color: GameColors.labelDim,
    fontSize: 11,
    fontFamily: Fonts.rounded,
    textAlign: 'center',
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
