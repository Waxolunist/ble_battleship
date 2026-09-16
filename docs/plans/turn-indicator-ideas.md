# Turn Indicator Ideas

The battle phase shows two grids (player + enemy). The player needs a clear, immediate signal for whose turn it is — especially since tapping the wrong grid at the wrong time would be confusing.

---

## Option A: Active Grid Border Glow

Highlight the grid that is currently actionable with an animated border glow.

- **Player's turn**: the enemy grid gets a pulsing golden/amber border; the player grid dims slightly.
- **Enemy's turn**: the player grid gets a pulsing red border (incoming fire); the enemy grid dims.

The pulse uses a looping `withRepeat` opacity animation so it feels alive without being distracting. When the turn switches, the glow cross-fades from one grid to the other (~300ms).

**Pros**: purely visual, no extra screen real estate needed, directly points at where the player should tap.
**Cons**: players with color-vision deficiencies may need an additional cue; subtle on small screens.

---

## Option B: Banner / Ribbon Label

A full-width banner slides in from the top at each turn change, displaying text like **"YOUR TURN — FIRE!"** or **"ENEMY IS FIRING..."**.

- Slides down with a spring animation, holds for ~1.5s, then slides back up (or shrinks into a persistent small label at the top edge).
- Player turn banner uses gold text on a dark translucent strip; enemy turn uses red text.
- During the enemy turn the banner could show a loading/radar sweep animation to communicate "waiting".

**Pros**: impossible to miss, works well for accessibility, can carry extra info (e.g. "3 ships remaining").
**Cons**: takes vertical space (briefly), can feel interruptive if animations are too slow.

---

## Option C: Divider Text Swap + Color Shift

Reuse the existing "ENEMY WATERS" divider between the two grids as the turn indicator.

- **Player's turn**: divider text changes to **"SELECT TARGET"** with a subtle left-right scanning animation on the divider line (like a radar sweep). Divider color shifts to gold.
- **Enemy's turn**: divider text changes to **"INCOMING FIRE"** with a red pulse on the divider line. The enemy grid pointer-events are disabled, reinforcing that it's not your turn to act.

**Pros**: zero additional UI elements, leverages existing layout, minimal distraction.
**Cons**: easy to overlook if the player isn't looking at the center of the screen; less dramatic.

---

## Recommendation

Combine **Option A** (grid glow) with **Option C** (divider text swap) for a layered approach: the glow draws the eye to the right grid, and the divider text confirms what the player should do — without needing a large banner that eats screen space.
