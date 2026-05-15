# Story: Responsiveness

## User Story

> > As a **player on a smaller Android device** (e.g. Samsung S22, 360dp wide), I want
> > **the app to scale its layout, fonts, and spacing to fit my screen** so that **no
> > content is clipped, overlapping, or pushed off-screen.**
>
> As a **player on a larger device** (e.g. Pixel 9 Pro Max, Galaxy S24 Ultra), I want
> **the app to use the extra screen space** — larger grids, more breathing room, bigger
> touch targets — so that **the UI feels native to my device rather than a small-phone
> layout with empty margins.**

---

## Background

The app currently renders well on a Pixel 7 (412 x 732 dp) but breaks on narrower
devices like the Samsung S22 (360 x 780 dp) — a 52 dp (12.6 %) reduction in width.

The game grid already scales dynamically via `useWindowDimensions`, but every other
dimension in the app — font sizes, paddings, margins, fixed widths, and absolute
positions — is hardcoded in pixels. On 360 dp screens these values consume
proportionally more space, causing overflow, clipping, and layout breaks.

Conversely, on larger devices (e.g. Pixel 9 Pro Max at 448 dp, Galaxy S24 Ultra at
414 dp) the hardcoded sizes leave the UI looking cramped and under-utilised — grids
could be bigger, fonts more comfortable, and spacing more generous. The scaling should
work **both directions**: shrink on small screens, grow on large ones.

### Target devices

| Device                 | Width (dp) | Height (dp) | Notes                                     |
| ---------------------- | ---------- | ----------- | ----------------------------------------- |
| Samsung S22            | 360        | 780         | Smallest target — narrower, must not clip |
| Pixel 5 / small phones | 393        | 851         | Should also work                          |
| Pixel 7                | 412        | 732         | Current baseline — works well             |
| Pixel 9 Pro Max        | 448        | 998         | Large phone — should use extra space      |
| Galaxy S24 Ultra       | 414        | 883         | Large phone — should use extra space      |
| Tablets / foldables    | 600+       | varies      | Out of scope for now                      |

### Key width comparison

| Metric                             | S22    | Pixel 7 | Pixel 9 Pro Max |
| ---------------------------------- | ------ | ------- | --------------- |
| Screen width                       | 360 dp | 412 dp  | 448 dp          |
| Content width (after 32px padding) | 296 dp | 348 dp  | 384 dp          |
| Grid cell size                     | 27 px  | 32 px   | 35 px           |

---

## Scope

| Area                                              | Included                     |
| ------------------------------------------------- | ---------------------------- |
| Responsive scaling utility (`useResponsive` hook) | Yes                          |
| Home screen                                       | Yes                          |
| Stats screen                                      | Yes                          |
| Battle screen (placement phase)                   | Yes                          |
| Battle screen (battle phase + overlays)           | Yes                          |
| Ship tray component                               | Yes                          |
| Game field component                              | Yes (minor — already scales) |
| Tab bar                                           | Yes (audit)                  |
| Scale-up on larger phones (448 dp+)               | Yes                          |
| Tablet / foldable layouts                         | No                           |
| Landscape orientation                             | No                           |

---

## Implementation Strategy

### 1. Create a shared scaling utility

Rather than scattering `useWindowDimensions` calls and ad-hoc math through every
screen, introduce a single `useResponsive` hook in `hooks/useResponsive.ts` that
provides pre-computed scale factors and helpers.

```ts
// hooks/useResponsive.ts
import { useWindowDimensions } from 'react-native';

const BASE_WIDTH = 412; // Pixel 7 reference width

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const scale = width / BASE_WIDTH; // ~0.874 on S22, 1.0 on Pixel 7, ~1.087 on Pixel 9 Pro Max

  /** Scale a pixel value relative to the base width */
  const s = (size: number) => Math.round(size * scale);

  /** Scale font size (clamped: floor at 80% to stay legible, cap at 120% to stay balanced) */
  const fs = (size: number) => Math.round(Math.min(Math.max(size * scale, size * 0.8), size * 1.2));

  return { width, height, scale, s, fs };
}
```

- `s(px)` — scale spacing, padding, margin, fixed widths. Scales linearly in both
  directions (smaller on S22, larger on Pixel 9 Pro Max).
- `fs(px)` — scale font sizes with a floor at 80 % (legibility) and a cap at 120 %
  (visual balance). Prevents text from becoming illegibly small or disproportionately
  large.
- `scale` — raw multiplier for custom calculations.

This keeps the Pixel 7 layout pixel-identical while proportionally shrinking on narrower
screens **and growing on wider ones** — bigger grids, more comfortable spacing, larger
touch targets.

### 2. Add responsive constants to theme

Add spacing / sizing scales to `constants/theme.ts` that screens can import for
consistent vertical rhythm (optional, can be done incrementally).

### 3. Migrate each screen

For every screen and shared component, replace hardcoded pixel values with calls to
`s()` and `fs()` from the hook. Percentage-based values and `flex` layouts that already
work can be left unchanged.

### 4. Test matrix

After each screen migration, verify on:

- Samsung S22 (360 dp) — no overflow or clipping
- Pixel 7 (412 dp) — no visual regression
- Pixel 9 Pro Max (448 dp) — extra space is used, not wasted

---

## Tasks

### Task 0: Create the `useResponsive` hook - Done

**File:** `hooks/useResponsive.ts` (new)

Create the shared scaling hook as described in the strategy section. Export `s`, `fs`,
`scale`, `width`, and `height`. Write it once, import everywhere.

**Acceptance criteria:**

- Hook exists and exports the documented API.
- Calling `s(32)` on a 360 dp screen returns `28` (≈ 32 \* 0.874).
- Calling `fs(52)` on a 360 dp screen returns `45` (≈ 52 \* 0.874), not below `42`
  (80 % floor).
- Calling `s(32)` on a 448 dp screen returns `35` (≈ 32 \* 1.087) — scales up.
- Calling `fs(52)` on a 448 dp screen returns `62` (capped at 120 % = 52 \* 1.2).

---

### Task 1: Home screen (`app/(tabs)/index.tsx`)

**Current issues on S22:**

- `paddingBottom: 60` wastes vertical space.
- Input `height: 48`, confirm button `width/height: 48` don't scale.
- `fontSize: 32` (name), `fontSize: 20` (welcome) are oversized.
- Ready button `paddingHorizontal: 36` may push edges.
- Change-name button uses `position: absolute, bottom: 24, left: 24` — could overlap
  content.

**Changes:**

- Import `useResponsive`.
- Replace all hardcoded `fontSize`, `padding*`, `width`, `height`, `bottom`, `left`
  values with `s()` / `fs()` calls.
- Keep percentage-based values (`width: '80%'`, `paddingTop: '15%'`) as-is.

**Acceptance criteria:**

- No clipping or overflow on 360 dp width.
- Pixel 7 layout is visually unchanged.
- On 448 dp, fonts and spacing grow — no wasted whitespace at edges.

---

### Task 2: Stats screen (`app/(tabs)/stats.tsx`)

**Current issues on S22:**

- `accuracyPct: fontSize: 52` overflows its container.
- `captainName: fontSize: 34` may wrap unexpectedly.
- `shipRowLeft: width: 100` is a fixed width that leaves little room for bar + count.
- `shipCount: width: 28` and `shipName: fontSize: 9` are tiny but rigid.
- `paddingTop: 72`, `paddingBottom: 48` reduce usable height.
- `streakValue: fontSize: 20`, `bigStatValue: fontSize: 32` don't scale.

**Changes:**

- Import `useResponsive`.
- Scale all font sizes with `fs()`.
- Replace `shipRowLeft: width: 100` with `s(100)`.
- Scale all padding / gap / margin values with `s()`.
- `accuracyPct` specifically: use `fs(52)` so it drops to ~45 on S22.

**Acceptance criteria:**

- Accuracy percentage, captain name, and ship bars fit without overflow on 360 dp.
- No visual regression on 412 dp.
- On 448 dp, stat cards and bars expand to fill the wider viewport.

---

### Task 3: Battle screen — placement phase (`app/battle.tsx` + `components/views/placement-view.tsx`)

**Current issues on S22:**

- `paddingTop: 64`, `paddingBottom: 48`, `paddingHorizontal: 32` — too generous.
- Title `fontSize: 24` may wrap.
- Bottom buttons `gap: 12`, button `fontSize: 16` don't adapt.

**Changes:**

- Import `useResponsive`.
- Scale padding, font sizes, and gaps with `s()` / `fs()`.
- The game grid already scales (cellSize is dynamic) — leave it.

**Acceptance criteria:**

- Title, subtitle, grid, and bottom buttons all fit on 360 dp without scrolling or
  overlap.

---

### Task 4: Ship tray (`components/ship-tray.tsx`)

**Current issues on S22:**

- `CELL_SIZE: 28` is a module-level constant — doesn't scale.
- `shipLabel: width: 120` is fixed and too wide for 296 dp content area.
- `rotateButton: width/height: 22`, `shuffleButton: width/height: 32` don't scale.
- `placedBadge: width: 18, fontSize: 14` rigid.

**Changes:**

- Accept `scale` (or `width`) as a prop from the parent, or call `useResponsive`
  internally.
- Replace `CELL_SIZE` with a scaled value: `Math.round(28 * scale)`.
- Replace `shipLabel: width: 120` with `s(120)`.
- Scale rotate button, shuffle button, badge, and font sizes.

**Acceptance criteria:**

- Ship names, cells, rotate button, and placed badge all fit in a single row on 360 dp.
- Drag-and-drop placement still works correctly with the new cell sizes.

---

### Task 5: Battle screen — battle phase + overlays (`app/battle.tsx`)

**Current issues on S22:**

- Victory text `fontSize: 52` and defeat text `fontSize: 48` overflow.
- Confirm dialog `marginHorizontal: 32` leaves only 296 dp.
- `sunkLabel: fontSize: 22`, `counterText: fontSize: 20` don't scale.
- Retreat button `position: absolute, bottom: 24, left: 24`.
- Endgame buttons `gap: 16, marginTop: 32`.

**Changes:**

- Import `useResponsive`.
- Scale victory / defeat font sizes with `fs()`.
- Scale confirm dialog margins, paddings, button font sizes.
- Scale retreat button positioning.
- Scale ship icon border widths and sunk label.

**Acceptance criteria:**

- Victory / defeat overlays render cleanly on 360 dp.
- Retreat confirm dialog fits with readable text.
- Endgame buttons are tappable and don't overflow.

---

### Task 6: Game field component (`components/game-field.tsx`)

**Current state:** Mostly responsive — `cellSize` is already derived from screen width.

**Minor issues:**

- `GRID_PADDING: 32` and `LABEL_SIZE: 22` are module-level constants.
- `labelText: fontSize: 10` is hardcoded.

**Changes:**

- Evaluate whether `GRID_PADDING` and `LABEL_SIZE` should scale. On S22, reducing
  `GRID_PADDING` from 32 to 28 would recover 8 dp across the grid (almost one extra
  pixel per cell).
- Scale `labelText` font size.

**Acceptance criteria:**

- Grid labels remain legible on 360 dp.
- Cell size is maximised for available width.

---

### Task 7: Tab bar audit (`app/(tabs)/_layout.tsx`)

**Changes:**

- Review tab bar icon sizes, label font sizes, and padding.
- Scale any hardcoded values.

**Acceptance criteria:**

- Tab bar renders correctly on 360 dp without icon / label clipping.

---

### Task 8: Final integration test

- Run through the full flow (home -> placement -> battle -> endgame -> stats) on three
  device profiles:
  - **Samsung S22 (360 dp)** — no overflow, clipping, or layout breaks.
  - **Pixel 7 (412 dp)** — no regressions from current layout.
  - **Pixel 9 Pro Max (448 dp)** — extra space is used: larger grid cells, bigger fonts,
    more comfortable spacing. The UI should feel native to the larger screen, not a
    small-phone layout floating in empty space.
- Test with long captain names and German locale (longer strings on all three sizes).

---

## Task dependency graph

```
Task 0 (useResponsive hook)
  ├── Task 1 (Home screen)
  ├── Task 2 (Stats screen)
  ├── Task 3 (Placement phase)
  │     └── Task 4 (Ship tray)
  ├── Task 5 (Battle phase + overlays)
  ├── Task 6 (Game field)
  └── Task 7 (Tab bar)
        └── Task 8 (Integration test — after all above)
```

Tasks 1–7 can be done in parallel after Task 0. Task 8 is the final gate.
