# Missing Features & Work Items

## Features

### Must Haves

| Priority | Feature | Description |
|---|---|---|
| High | **Local two-player via BLE** | Offline head-to-head multiplayer over Bluetooth Low Energy so two players can battle on separate devices without internet. |
| Done | **Tutorial overlays** | Show guided overlay hints on placement and battle views on first launch, with an option to replay them from a settings or help menu. |
| Medium | **Sound effects** | Add audio for shots (fire, hit, miss, sunk), phase transitions, victory/defeat, and ambient ocean — the game's haptics and animations are strong but silent, which undercuts the drama. |
| Low | **Difficulty levels** | Offer at least two AI difficulty modes (e.g. Seaman vs Admiral) so new players aren't frustrated and veterans stay challenged. |
| Medium | **Settings screen** | A dedicated screen for toggling sound, haptics, viewing credits, replaying the tutorial, and selecting difficulty. |
| High | **App icon & splash screen** | A polished app icon and branded splash/loading screen to replace the Expo defaults before any store submission. |
| Done | **Defeat screen polish** | The victory screen has a full choreographed animation, but the defeat screen needs equal treatment — a dramatic sinking sequence with the light-light-heavy haptic pattern already spec'd in the guidelines. |
| Done | **Production dev flag cleanup** | `DEV_SHOW_FORCE_VICTORY` is currently `true` — needs a build-time gate or removal before release. |
| Done | **i18n** | Make the app in multiple languages. German and English are a must. |

### Nice to Haves

| Priority | Feature | Description |
|---|---|
| Low | **Game history / battle log** | A scrollable log or post-game summary showing each turn's coordinates and outcomes so players can review what happened. |
| Low | **Achievements / medals** | Unlockable badges for milestones like "sink a carrier first," "win without losing a ship," or "10-game win streak" to drive replayability. |
| Very Low | **Ship skins / fleet customization** | Let players choose alternate visual themes or color palettes for their fleet as a cosmetic reward for rank progression. |
| Medium | **Animated water / ocean background** | Subtle looping wave or ripple animation on the grids to add atmosphere beyond the static navy cells. |
| Medium | **Rate / share prompt** | A non-intrusive prompt after a victory to rate the app or share a battle result, helping with organic discovery. |

## Missing Work

| Status | Item | Description |
|---|---|---|
| | Missing ship sprite assets | Battleship and Cruiser still use solid blue cell fallback — need proper sprite images. |
| Done | Dev flag guard | `DEV_SHOW_FORCE_VICTORY` is hardcoded `true` in `constants/dev.ts` — must be `false` or gated by `__DEV__` before release. |
| Done | Unused modal screen | `app/modal.tsx` appears to be scaffold boilerplate — remove or repurpose. |
| Low Priority | Accessibility labels | Grid cells, buttons, and ship tray items lack `accessibilityLabel` / `accessibilityRole` props for screen reader support. |
| Won't Do | Web platform testing | Haptics are guarded for web but the grid gesture system (pan/drag) may not work correctly with mouse input. |
