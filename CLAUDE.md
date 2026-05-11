# Hulls & Hellfire — Claude Code Guidelines

## After editing code

Run lint and format after any code change:

```bash
npm run lint
npm run format
```

Use `npm run lint:fix` to auto-fix lint errors, and `npm run format:check` to verify formatting without writing.

## Constants — no magic values

### Assets

Never require image or asset files inline. Always reference the `IMAGES` map from [constants/assets.ts](constants/assets.ts):

```ts
// ✗ bad
source={require('@/assets/images/carrier.png')}

// ✓ good
import { IMAGES } from '@/constants/assets';
source={IMAGES.carrier}
```

Add new assets to `IMAGES` in [constants/assets.ts](constants/assets.ts) before using them.

### Colors

Never hard-code color strings in component styles or logic. Always import from `GameColors` in [constants/theme.ts](constants/theme.ts):

```ts
// ✗ bad
color: '#FFC832'
backgroundColor: 'rgba(8, 25, 70, 0.85)'

// ✓ good
import { GameColors } from '@/constants/theme';
color: GameColors.gold
backgroundColor: GameColors.navyBg
```

If a color you need doesn't exist in `GameColors`, add it there with a descriptive name and JSDoc comment before using it.

## UX / UI guidelines

### Haptic feedback

Use `expo-haptics` (`impactAsync`) for all interactive elements on native. Skip it on web. Never call haptics without a `.catch(() => {})` guard (the device may not support them).

Match intensity to the weight of the action:

| Intensity | Style | When to use |
|-----------|-------|-------------|
| **Light** | `ImpactFeedbackStyle.Light` | Tab bar press, targeting reticle locked, selection highlight, any low-stakes touch |
| **Medium** | `ImpactFeedbackStyle.Medium` | Standard button press (`HapticPressable` default), drag-and-drop placement, ship rotation, shot-verdict hit |
| **Heavy** | `ImpactFeedbackStyle.Heavy` | Shell impact beat, shot-verdict sunk, destructive confirm (retreat confirmed), victory reveal |
| **Sequence** | light → light → heavy | Defeat / retreat animation sequence |
| **Sequence** | medium × 3 → heavy | Victory animation sequence |

Use the shared `HapticPressable` component ([components/haptic-pressable.tsx](components/haptic-pressable.tsx)) for buttons. Only reach for `expo-haptics` directly when you need a different intensity or a multi-beat sequence that `HapticPressable` can't express.

```ts
// ✗ bad — wrong tool for a destructive confirm
<Pressable onPress={handleRetreat} />

// ✓ good — heavy haptic on a high-stakes action
const { impactAsync, ImpactFeedbackStyle } = await import('expo-haptics');
impactAsync(ImpactFeedbackStyle.Heavy).catch(() => {});
```

### Typography

The game has two font voices — military display and system UI. Use them consistently:

| Use case | Font | How to reference |
|----------|------|-----------------|
| Screen titles, verdict callouts (HIT / MISS / SUNK), button labels, counters | **BlackOpsOne** | `fontFamily: 'BlackOpsOne'` |
| Stats, data readouts, coordinates, turn counters | System monospace | `fontFamily: Fonts.mono` |
| Body copy, in-game labels, grid headers | System rounded / sans | `fontFamily: Fonts.rounded` or `Fonts.sans` |
| Prose / flavour text (not currently used) | System serif | `fontFamily: Fonts.serif` |

Always import `Fonts` from [constants/theme.ts](constants/theme.ts) for system faces. Never hard-code platform font names like `'Menlo'` or `'Courier New'`.

```ts
// ✗ bad
fontFamily: 'Courier New'

// ✓ good
import { Fonts } from '@/constants/theme';
fontFamily: Fonts.mono
```

**Letter spacing:** BlackOpsOne labels (especially small ones like the retreat button) need explicit `letterSpacing` (2–4) to remain legible at small sizes.

**Text hierarchy:** Battle verdicts and callouts are always larger and bolder than ambient UI labels. Don't use BlackOpsOne for helper text or error messages — keep it reserved for the game's drama moments.

## Code style

- TypeScript strict mode is on — no implicit `any`.
- Prefer editing existing files over creating new ones.
- Don't add comments unless the logic isn't self-evident.
- Don't add error handling for scenarios that can't happen.
- Don't introduce abstractions for one-off use cases.
