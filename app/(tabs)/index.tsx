import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { FadeIn } from '@/components/fade-in';
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

export default function HomeScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleConfirm = () => {
    if (!name.trim()) return;
    inputRef.current?.blur();
    Keyboard.dismiss();
    setConfirmed(true);
  };

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
                ⚓ ALL HANDS ON DECK!{'\n'}
                CAPTAIN {name} HAS TAKEN THE HELM.{'\n'}
                THE SEA DEMANDS BLOOD.
              </Text>
              <HapticPressable
                onPress={() => router.push('/battle')}
                style={({ pressed }) => [styles.readyButton, pressed && styles.readyButtonPressed]}>
                <Text style={styles.readyButtonText}>⚔ TO THE BATTLE STATION</Text>
              </HapticPressable>
            </>
          ) : (
            <View style={styles.inputRow}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={name}
                onChangeText={text => setName(text.toUpperCase())}
                autoCapitalize="characters"
                placeholder="ENTER YOUR NAME"
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
      {confirmed && (
        <HapticPressable
          onPress={() => {
            setConfirmed(false);
            setName('');
          }}
          style={({ pressed }) => [
            styles.changeNameButton,
            pressed && styles.changeNameButtonPressed,
          ]}>
          <Text style={styles.changeNameText}>change name</Text>
        </HapticPressable>
      )}
    </ImageBackground>
  );
}

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
    paddingBottom: 60,
  },
  title: {
    width: '80%',
    aspectRatio: 0.8,
  },
  nameContainer: {
    width: '80%',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  inputRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 8,
    paddingHorizontal: 16,
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 2,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  confirmButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  confirmButton: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  welcomeText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 2,
    textAlign: 'center',
    lineHeight: 32,
    textShadow: '1px 2px 6px rgba(0,0,0,0.8)' as never,
  },
  readyButton: {
    marginTop: 24,
    paddingHorizontal: 36,
    paddingVertical: 16,
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
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 4,
    textAlign: 'center',
  },
  changeNameButton: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    padding: 8,
  },
  changeNameButtonPressed: {
    opacity: 0.5,
  },
  changeNameText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 1,
  },
});
