# Story: Tutorial Overlays

## User Story

> As a **first-time player**, I want **guided hints to appear on the placement and battle screens**
> so that **I can learn the game's mechanics without reading a manual or quitting in frustration.**
>
> As a **returning player**, I want **the option to replay the tutorial from a help button**
> so that **I can refresh my memory after time away or show a friend how to play.**

---

## Background

Hulls & Hellfire drops the player into a placement grid with no explanation. For anyone unfamiliar with Battleship, the ship tray, drag-to-place interaction, and rotation mechanic are non-obvious. The battle view compounds this — two grids, a turn indicator, fire-by-tap, and a retreat button all demand silent comprehension.

First-time confusion is a known drop-off vector. This feature addresses that with lightweight, dismissible overlays that teach in context — no separate tutorial level, no blocking video, just a spotlight on what matters at the moment it matters.

---

## Scope

Two tutorial sequences, each triggered independently on first launch:

| Sequence | Screen | Trigger |
|---|---|---|
| **Placement Tutorial** | Placement view | First time the placement screen loads |
| **Battle Tutorial** | Battle view | First time a battle begins |

Each sequence is stored as a flag in persistent storage. Once completed or skipped, it does not reappear — unless the player explicitly replays it.

---

## Placement Tutorial

The player has just opened the app for the first time and reached the fleet placement screen.

### Step 1 — Welcome

**Spotlight:** None (full-screen dimmed backdrop)

**Callout (center):**
> **DEPLOY YOUR FLEET**
> Arrange your ships before the battle begins.
> Tap anywhere to continue.

**Tone:** Commanding, brief. This is the game's first real moment — it should feel like orders from a superior officer, not a pop-up ad.

---

### Step 2 — The Ship Tray

**Spotlight:** The horizontal ship tray at the bottom of the screen.

**Callout (above tray):**
> **SELECT A VESSEL**
> Tap a ship to pick it up, then tap a grid square to place it.

**Sub-hint (smaller text below):**
> Longer ships are harder to hide. Place them wisely.

---

### Step 3 — Rotation

**Spotlight:** The rotation button (or the selected ship on the grid).

**Callout (near rotation control):**
> **ROTATE**
> Tap to change orientation — horizontal or vertical.

Trigger: appears automatically after the player places their first ship, or after a 3-second pause on step 2 with no interaction.

---

### Step 4 — Ready to Deploy

**Spotlight:** The **DEPLOY FLEET** button.

**Callout (above button):**
> **ALL HANDS ON DECK**
> Place all your ships, then deploy to begin the battle.

This step appears only after all ships are placed, replacing step 3 as the active hint.

---

### Dismissal

A **SKIP TUTORIAL** ghost-text link sits at the top-right throughout. Tapping it completes the tutorial flag immediately and hides the overlays — no confirmation needed.

---

## Battle Tutorial

The player has placed their fleet and the battle screen loads for the first time.

### Step 1 — The Two Grids

**Spotlight:** Both grids simultaneously (or a split highlight with a dividing line).

**Callout (center, between grids):**
> **THE BATTLEFIELD**
> Top: your fleet. Bottom: enemy waters.

---

### Step 2 — How to Fire

**Spotlight:** The enemy (bottom) grid.

**Callout (below enemy grid):**
> **OPEN FIRE**
> Tap any square on the enemy grid to launch a shell.
> Blue = miss. Red = hit.

Sub-hint (smaller):
> A sunken ship lights up its full silhouette.

---

### Step 3 — Turn Indicator

**Spotlight:** The turn indicator component.

**Callout (adjacent to indicator):**
> **WAIT FOR YOUR TURN**
> The enemy fires back. Watch the indicator — it's your command.

---

### Step 4 — Retreat

**Spotlight:** The RETREAT button (bottom-left).

**Callout (above button):**
> **LAST RESORT**
> If the odds are against you, you can retreat — but the battle is lost.

This is the final step. After dismissing it, the tutorial is complete and battle proceeds normally.

---

### Dismissal

Same **SKIP TUTORIAL** ghost-text link in the top-right. Skipping during battle goes straight into play with no further interruption.

---

## Replay Entry Points

Players can replay either tutorial independently from two places:

1. **Help button** — a small `?` or anchor icon in the top navigation bar of the placement and battle views. Tapping it replays the tutorial for that screen only.
2. **Settings screen** (when built) — a **Replay Tutorial** row that lets the player choose which sequence to replay or reset both.

Replaying resets only that sequence's seen-flag, not any game state.

---

## Persistence

Use `expo-secure-store` or `@react-native-async-storage/async-storage` to store per-sequence completion flags:

```
tutorial_placement_seen: true | false
tutorial_battle_seen:    true | false
```

Flags default to `false` on first install. Dev builds should expose a reset button (behind the same `__DEV__` guard as `DEV_SHOW_FORCE_VICTORY`) to re-trigger the tutorial without clearing all storage.

---

## Visual Design

### Overlay backdrop

A semi-transparent full-screen layer (`rgba(8, 15, 40, 0.82)` — close to `navyBg` but slightly darker) covers the screen. The spotlighted element is cut out of the backdrop using a transparent "hole," keeping the real UI visible and interactive only where intended.

### Callout card

- Background: `rgba(8, 25, 70, 0.95)` with a `1px` `blueBorder` outline
- Title: BlackOpsOne, ~16px, `gold` color, `letterSpacing: 2`
- Body: `Fonts.rounded`, ~13px, `label` color
- Sub-hint: `Fonts.rounded`, ~11px, `labelFaded` color, italic
- Rounded corners (`borderRadius: 8`), subtle drop shadow

### Callout pointer

A small triangular notch on the callout card pointing toward the spotlighted element. Direction adapts based on whether the callout is above or below the spotlight.

### Progression

- **Tap anywhere to advance** (on the backdrop or the callout card itself)
- A faint step indicator (e.g., `2 / 4` in `labelFaded`, monospace) appears at the bottom of the callout card
- Forward-only — no back button, no step scrubbing

### Animation

- Backdrop fades in (`opacity` 0 → 1, 250ms ease-in)
- Spotlight cutout morphs position between steps (`layout` animation, 300ms)
- Callout card slides up from below the spotlight (translateY + opacity, 200ms)
- On dismiss: fade out entire overlay (200ms)

---

## Haptics

| Moment | Haptic |
|---|---|
| Tutorial appears (first step) | Light impact |
| Advancing to next step | Light impact |
| Tutorial completed | Medium impact |
| SKIP tapped | Light impact |

---

## Acceptance Criteria

- [ ] Placement tutorial appears automatically on the first ever visit to the placement screen and never again (unless replayed).
- [ ] Battle tutorial appears automatically the first time a battle begins and never again (unless replayed).
- [ ] Each tutorial can be skipped entirely via a persistent SKIP link.
- [ ] Skipping marks the sequence as seen — it does not re-trigger on the next visit.
- [ ] A help button on each respective screen allows independent replay of that screen's tutorial.
- [ ] Completion flags survive app restarts.
- [ ] In `__DEV__` builds, a reset option is available to clear tutorial flags without wiping all storage.
- [ ] All callout text uses BlackOpsOne for titles, `Fonts.rounded` for body — no hard-coded fonts.
- [ ] All colors reference `GameColors` — no hard-coded hex strings.
- [ ] No haptic calls are made without a `.catch(() => {})` guard.
- [ ] Tutorial overlays do not block interaction on the spotlighted element itself (tapping the ship tray in step 2 should still work).

---

## Out of Scope

- Animated character / narrator
- Voice-over
- Mandatory completion (must always be skippable)
- Tutorial analytics / funnel tracking
- Difficulty-specific tutorial variants

---

## Library Options for Implementation

Several React Native libraries exist for this pattern. All of the options below work with Expo managed workflow (zero native dependencies).

### `rn-tourguide`

- **Package:** `rn-tourguide`
- **Approach:** Active rewrite of the original `react-native-copilot`. Uses a `TourGuideProvider` at the app root, `TourGuideZone` wrappers around target elements, and a `useTourGuideController` hook to start/stop tours. SVG and view-based overlay options.
- **Expo:** Compatible.
- **Strengths:** Most widely adopted, good documentation, customizable tooltip renderer, event callbacks, step ordering.
- **Weaknesses:** Provider must wrap the app root, which may require some restructuring.

### `@stackbuilders/react-native-spotlight-tour`

- **Package:** `@stackbuilders/react-native-spotlight-tour`
- **Approach:** Spotlight effect via `react-native-svg`. Declarative API with an `SpotlightTour` provider and `AttachStep` wrappers. Uses Floating UI for callout positioning.
- **Expo:** Compatible; requires `react-native-svg`.
- **Strengths:** Actively maintained (2024–2025 releases), TypeScript-first, automatic shape-aware spotlight, supports custom overlay and tooltip components.
- **Weaknesses:** Slightly smaller community than `rn-tourguide`.

### `@wrack/react-native-tour-guide`

- **Package:** `@wrack/react-native-tour-guide`
- **Approach:** Lightweight coach-mark library with zero native dependencies. Spotlight automatically matches component shape — no manual configuration.
- **Expo:** Explicitly Expo-compatible, also works with React Native Web.
- **Strengths:** Minimal setup, least friction to get running, shape-aware spotlight.
- **Weaknesses:** Less customization depth for complex callout layouts.

### `react-native-highlight-overlay`

- **Package:** `react-native-highlight-overlay`
- **Approach:** Tinted overlay with one or more non-tinted highlighted elements. Supports switching between highlights for a walkthrough flow.
- **Expo:** Compatible.
- **Strengths:** Very lightweight, simple API, good for basic "highlight this thing" tutorials.
- **Weaknesses:** No built-in callout/tooltip — you bring your own. No step progression logic.

### `react-native-walkthrough-tooltip`

- **Package:** `react-native-walkthrough-tooltip`
- **Approach:** Tooltip-only — positions a callout card relative to a wrapped target element with a fullscreen backdrop. No spotlight cutout.
- **Expo:** Compatible.
- **Strengths:** Highly customizable callout, great for simple "point at this" hints.
- **Weaknesses:** No spotlight mask; you wire step progression yourself.

### Custom implementation

Build the overlay as a React Native `Modal` (or absolute-positioned `View` at the root) with:
- `onLayout` + `ref.measure()` to get target coordinates
- `react-native-svg` `<Mask>` + `<Rect>` with a cutout for the spotlight
- Manual step state machine

**Strengths:** Full control over appearance; no third-party churn risk; can match the game's exact visual language precisely.  
**Weaknesses:** Non-trivial to build correctly (layout measurement is fiddly on absolute-positioned targets); ongoing maintenance burden.

### Recommendation

Start with **`@stackbuilders/react-native-spotlight-tour`** — it is actively maintained, TypeScript-first, supports fully custom callout renderers (needed to match the game's visual language), and works cleanly with Expo. If its SVG mask proves unreliable against the game's absolute-positioned grid elements, **`@wrack/react-native-tour-guide`** is the fastest fallback. Resort to a custom implementation only if both libraries have unresolvable layout issues with the game's grid.
