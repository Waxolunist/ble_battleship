// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // SDK 57 turns on the React Compiler's hook rules, and three of them read
    // Reanimated and Animated as mistakes. `sv.value = withTiming(...)` is how
    // a shared value is driven, and `useRef(new Animated.Value(1)).current` is
    // the idiom from React Native's own documentation; the compiler sees a
    // mutated hook argument and a ref read during render. Every one of the 26
    // reports these raised is one of those two shapes, so the rules are off
    // rather than silenced line by line across seven files.
    rules: {
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]);
