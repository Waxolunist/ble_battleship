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

## Internationalisation (i18n)

The app uses `i18next` + `react-i18next` for translations and `expo-localization` for locale detection. Two locales are supported: `en` (default) and `de`.

### Never hard-code user-visible strings

All strings that appear in the UI must come from the translation files via `t()`. No hard-coded English text in JSX.

```tsx
// ✗ bad
<Text>RETREAT</Text>

// ✓ good
import { useTranslation } from 'react-i18next';
const { t } = useTranslation('battle');
<Text>{t('retreat.button')}</Text>
```

### Choose the right namespace

| Namespace | Content |
|-----------|---------|
| `common` | Shared labels, button text, home screen, placement screen, fleet tray |
| `battle` | Verdicts (HIT/MISS/SUNK), endgame overlays, retreat dialog, turn divider |
| `tutorial` | All tour step titles, descriptions, and button labels |
| `stats` | Stats screen labels, rank hints, empty state |

### Add strings to both locales simultaneously

Whenever you add a new translation key, add it to **both** `locales/en/` and `locales/de/` at the same time. TypeScript will catch missing keys in code (via `CustomTypeOptions`), but it cannot catch missing keys in the `de` files — you must do this manually.

### Locale-specific images

Images that contain localizable text must live under `assets/images/locales/<locale>/` and be referenced through `LOCALE_IMAGES` in [constants/assets.ts](constants/assets.ts) — never via `IMAGES` or an inline `require()`.

```tsx
// ✗ bad
source={require('@/assets/images/commence_firing.png')}

// ✓ good
import { LOCALE_IMAGES } from '@/constants/assets';
const { i18n } = useTranslation();
const locale = (i18n.language === 'de' ? 'de' : 'en') as keyof typeof LOCALE_IMAGES;
source={LOCALE_IMAGES[locale].commenceFiring}
```

Adding a new locale-specific image: place the file under `assets/images/locales/<locale>/`, add a `require()` entry to every locale key in `LOCALE_IMAGES`. TypeScript's `satisfies` constraint will error if any locale is missing a key.

### Changing the active locale

Use `i18next.changeLanguage(locale)` or the `setLanguage` action from `useLanguageStore`. Do not re-render the app or navigate — i18next notifies all `useTranslation` subscribers automatically.

```ts
// ✓ correct — triggers re-render of all translated components
import { useLanguageStore } from '@/store/useLanguageStore';
const { setLanguage } = useLanguageStore();
setLanguage('de');
```

### Plurals

Use i18next's `count`-based plural keys. German plurals are handled automatically — do not manually branch on count in component code.

```json
// locales/en/stats.json
{
  "engagement_one": "{{count}} ENGAGEMENT",
  "engagement_other": "{{count}} ENGAGEMENTS"
}
```

```tsx
t('engagement', { count: gamesPlayed })
```

## Code style

- TypeScript strict mode is on — no implicit `any`.
- Prefer editing existing files over creating new ones.
- Don't add comments unless the logic isn't self-evident.
- Don't add error handling for scenarios that can't happen.
- Don't introduce abstractions for one-off use cases.
