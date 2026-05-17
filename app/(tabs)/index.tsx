import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FadeIn } from '@/components/fade-in';
import { BLEMultiplayerPanel } from '@/components/ble/BLEMultiplayerPanel';
import { useGameStore } from '@/store/useGameStore';
import { useCaptainStore } from '@/store/useCaptainStore';
import { useStatsStore } from '@/store/useStatsStore';
import { useBLEStore } from '@/store/useBLEStore';
import { GameColors } from '@/constants/theme';
import { getRankTitle, translateRankTitle } from '@/models/types';
import {
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { HapticPressable } from '@/components/haptic-pressable';
import { IMAGES } from '@/constants/assets';
import { useResponsive } from '@/hooks/useResponsive';

export default function HomeScreen() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const resetGame = useGameStore(s => s.resetGame);
  const { captainName, setCaptainName, clearCaptainName } = useCaptainStore();
  const { state: bleState, setMode } = useBLEStore();
  const [inputName, setInputName] = useState('');
  const inputRef = useRef<TextInput>(null);
  const { s, fs } = useResponsive();

  const confirmed = captainName.length > 0;

  const gamesPlayed = useStatsStore(st => st.gamesPlayed);
  const wins = useStatsStore(st => st.wins);
  const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
  const rankStr = getRankTitle(gamesPlayed, winRate);
  const address =
    rankStr === 'UNPROVEN' || rankStr === 'RECRUIT' ? 'SIR' : translateRankTitle(rankStr, t);

  const handleConfirm = () => {
    if (!inputName.trim()) return;
    inputRef.current?.blur();
    Keyboard.dismiss();
    setCaptainName(inputName.trim());
  };

  const handleBattle = () => {
    setMode(bleState === 'LOBBY' ? 'ble' : 'ai');
    resetGame();
    router.push('/battle');
  };

  const styles = StyleSheet.create({
    background: {
      flex: 1,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
    content: {
      flex: 1,
      alignItems: 'center',
      paddingTop: '15%',
      justifyContent: 'space-between',
      paddingBottom: s(60),
    },
    title: {
      width: '80%',
      aspectRatio: 0.8,
    },
    nameContainer: {
      width: '80%',
      alignItems: 'center',
      gap: s(8),
    },
    label: {
      color: 'rgba(255, 255, 255, 0.8)',
      fontSize: fs(14),
      fontWeight: '600',
      letterSpacing: 2,
      textTransform: 'uppercase',
    },
    inputRow: {
      flexDirection: 'row',
      width: '100%',
      gap: s(8),
    },
    input: {
      flex: 1,
      height: s(48),
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.5)',
      borderRadius: 8,
      paddingHorizontal: s(16),
      color: '#fff',
      fontSize: fs(18),
      fontWeight: '600',
      letterSpacing: 2,
      textAlign: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    confirmButtonPressed: {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    confirmButton: {
      width: s(48),
      height: s(48),
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.5)',
      borderRadius: 8,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkmark: {
      color: '#fff',
      fontSize: fs(22),
      fontWeight: '700',
    },
    welcomeText: {
      color: '#fff',
      fontSize: fs(20),
      fontWeight: '800',
      letterSpacing: 2,
      textAlign: 'center',
      lineHeight: s(32),
      textShadowColor: 'rgba(0,0,0,0.8)',
      textShadowOffset: { width: 1, height: 2 },
      textShadowRadius: 6,
    },
    readyButton: {
      marginTop: s(24),
      paddingHorizontal: s(36),
      paddingVertical: s(16),
      borderWidth: 2,
      borderColor: '#fff',
      borderRadius: 4,
      backgroundColor: 'rgba(180, 20, 20, 0.75)',
    },
    readyButtonPressed: {
      backgroundColor: 'rgba(220, 40, 40, 0.9)',
    },
    readyButtonText: {
      color: '#fff',
      fontSize: fs(20),
      fontWeight: '900',
      letterSpacing: 4,
      textAlign: 'center',
    },
    changeNameButton: {
      position: 'absolute',
      bottom: s(24),
      left: s(24),
      padding: s(8),
    },
    changeNameButtonPressed: {
      opacity: 0.5,
    },
    changeNameText: {
      color: 'rgba(255, 255, 255, 0.6)',
      fontSize: fs(13),
      fontWeight: '500',
      letterSpacing: 1,
    },
    rankText: {
      fontFamily: 'BlackOpsOne',
      fontWeight: 'normal',
      fontSize: fs(32),
      letterSpacing: 3,
      color: GameColors.gold,
    },
    nameText: {
      fontFamily: 'BlackOpsOne',
      fontWeight: 'normal',
      fontSize: fs(32),
      letterSpacing: 3,
      color: '#fff',
    },
  });

  return (
    <ImageBackground source={IMAGES.bg} style={styles.background} resizeMode="cover">
      <View style={styles.overlay} />
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}>
        <FadeIn translateY={-40}>
          <Image source={IMAGES.title} style={styles.title} contentFit="contain" />
        </FadeIn>
        <View style={styles.nameContainer}>
          {confirmed ? (
            <>
              <Text style={styles.welcomeText}>
                {t('home.allHandsOnDeck')}
                {'\n'}
                <Text style={styles.rankText}>{address}</Text>{' '}
                <Text style={styles.nameText}>{captainName}</Text>
                {t('home.hasTakenTheHelm')}
              </Text>
              <HapticPressable
                onPress={handleBattle}
                style={({ pressed }) => [styles.readyButton, pressed && styles.readyButtonPressed]}>
                <Text style={styles.readyButtonText}>{t('home.toBattleStation')}</Text>
              </HapticPressable>
            </>
          ) : (
            <View style={styles.inputRow}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={inputName}
                onChangeText={text => setInputName(text.toUpperCase())}
                autoCapitalize="characters"
                placeholder={t('home.enterYourName')}
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
              />
              <HapticPressable
                onPress={handleConfirm}
                style={({ pressed }) => [
                  styles.confirmButton,
                  pressed && styles.confirmButtonPressed,
                ]}>
                <Text style={styles.checkmark}>✓</Text>
              </HapticPressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
      <BLEMultiplayerPanel />
      {confirmed && (
        <HapticPressable
          onPress={() => {
            clearCaptainName();
            setInputName('');
          }}
          style={({ pressed }) => [
            styles.changeNameButton,
            pressed && styles.changeNameButtonPressed,
          ]}>
          <Text style={styles.changeNameText}>{t('home.changeName')}</Text>
        </HapticPressable>
      )}
    </ImageBackground>
  );
}
