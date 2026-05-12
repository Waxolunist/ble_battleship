import { HapticPressable } from '@/components/haptic-pressable';
import { Fonts, GameColors } from '@/constants/theme';
import { useBLEPermissions } from '@/hooks/useBLEPermissions';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

interface BLEMultiplayerPanelProps {
  onHostPress?: () => void;
  onJoinPress?: () => void;
}

export function BLEMultiplayerPanel({ onHostPress, onJoinPress }: BLEMultiplayerPanelProps) {
  const { t } = useTranslation('common');
  const { available, isChecking, requestPermissions } = useBLEPermissions();

  if (!available) {
    return null;
  }

  const handleHostPress = async () => {
    const permitted = await requestPermissions();
    if (permitted && onHostPress) {
      onHostPress();
    }
  };

  const handleJoinPress = async () => {
    const permitted = await requestPermissions();
    if (permitted && onJoinPress) {
      onJoinPress();
    }
  };

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

const styles = StyleSheet.create({
  panel: {
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 8,
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
});
