# Endgame UX Design

Covers four features: the retreat button in battle view, retreat visualization, victory visualization, and post-game navigation.

---

## Retreat Button — Battle View

**Placement:** Bottom-left corner of the battle screen, symmetrically opposite the turn indicator. Small and unobtrusive — this is an escape hatch, not a primary action.

**Appearance:**
- Ghost button style: transparent background, `blueBorder` outline, `label` text color
- Label: **RETREAT** in BlackOpsOne, small size (~11px), high letter-spacing
- Flanked by a white-flag or anchor icon (subtle, `labelFaded` opacity)
- Opacity 50% during enemy turn — slightly dimmed but still reachable

**Interaction guard:** Tapping triggers a confirmation modal, not immediate exit. The modal appears inline (no route change) as a dark overlay:

> *"Abandon battle? Your fleet will be lost to the sea."*
> **HOLD THE LINE** / **RETREAT**

- Require a long-press (600ms) OR a two-tap confirm to prevent accidental retreats mid-combat
- Haptic: medium impact on press, heavy impact on confirmation

---

## Retreat Visualization

The screen doesn't just navigate away — it sinks the player's fleet first.

**Sequence (~2.5 seconds total):**

1. **Flag raised (0–0.4s):** A white flag icon fades in above the player grid with a short upward float — same animation pattern as the "CARRIER LOST" sunk label.

2. **Fleet submersion (0.4–1.4s):** All player ship cells animate to `cellSunk` color (`rgba(90, 30, 30, 0.95)`) in a staggered wave, left-to-right, with the same pulse used for sunk ship counters.

3. **Screen darkens (1.0–1.8s):** A full-screen overlay fades in — `rgba(8, 15, 40, 0.85)` (deep navy, darker than `navyBg`). The word **RETREAT** appears centered in BlackOpsOne, `red` (#FF5050), large (~48px), with a heavy text shadow.

4. **Fade to black (1.8–2.5s):** Entire screen cross-fades to black before navigation fires.

**Haptics:** Short sequence — light, light, heavy — mirroring defeat.

---

## Victory Visualization

Mirror the retreat's drama but with the opposite emotional weight.

**Sequence (~3 seconds total):**

1. **Final sunk verdict (existing):** The last enemy ship sinks using the existing "SUNK" verdict flow.

2. **Cannons fire (0–0.6s):** Screen shake (same `useShake` from combat), but three quick bursts instead of one. Gold flash overlays the enemy grid (`fireGlow`).

3. **Victory callout (0.6–1.2s):** The word **VICTORY** slams in from above in BlackOpsOne, `gold` (#FFC832), ~52px, with a drop-shadow glow. Below it, smaller: *"Enemy fleet destroyed."* in `label` color.

4. **Player fleet illuminates (1.2–2.0s):** All surviving player ship cells pulse from `cellShip` to a brighter `rgba(120, 200, 255, 0.9)` — a triumphant fleet salute.

5. **Sparks (optional, 1.2–1.7s):** 6–8 small gold particle dots burst outward from center screen and fade. Keeps it grounded — not over-the-top, just satisfying.

6. **Hold frame (2.0–3.0s):** Victory state lingers before the CTA appears.

**Haptics:** Three medium impacts in rhythm, then a long heavy impact on the **VICTORY** reveal.

---

## Post-Game Navigation

Do NOT auto-navigate. After retreat or victory, the player stays on a transformed battle screen briefly, then is offered clear choices.

**Post-game overlay (appears after visualization):**

For **VICTORY:**
```
        VICTORY
   Enemy fleet destroyed.

   [ PLAY AGAIN ]   [ MAKE PORT ]
```

For **RETREAT:**
```
        RETREAT
   Your fleet was lost.

   [ TRY AGAIN ]   [ MAKE PORT ]
```

**Button design:**
- **PLAY AGAIN / TRY AGAIN** — primary, gold outline (`fireGold`), BlackOpsOne label. Tapping resets game state and transitions directly to the placement phase (not home — keep momentum).
- **MAKE PORT** — ghost button, `blueBorder`, smaller. Routes back to the tab navigator.

**Navigation mechanics:**
- `resetGame()` + `router.replace('/battle')` for Play Again (replace, not push, so back-button doesn't loop)
- `router.dismissAll()` + `router.replace('/(tabs)')` for Home — fully clears the battle stack

**Rationale:** Staying on the battle screen avoids jarring cuts after emotional moments. "Play Again" going directly to placement reduces friction for the core loop. The player should feel the outcome before it disappears.

---

## Dev Tool: Force Victory Button

A debug-only button to instantly trigger the victory sequence without playing through a full battle. Speeds up testing of the victory visualization and post-game navigation flow.

**Feature flag:** Controlled by a boolean constant, e.g. `DEV_SHOW_FORCE_VICTORY` in a `constants/dev.ts` file. Set to `false` before any production build — the button must not render at all when the flag is off (not just hidden).

**Placement:** Bottom-right corner of the battle screen, mirroring the retreat button on the left.

**Appearance:**
- Visually distinct from real game UI to avoid confusion during recordings or screenshots
- Label: **VICTORY** in BlackOpsOne, same small size as the retreat button
- Gold tint (`fireGold`) border and text to distinguish it as a dev tool
- A small wrench or bug icon alongside the label

**Behavior:** Single tap — no confirmation modal, no long-press guard. This is a dev shortcut; friction is unwanted. Immediately calls the same victory resolution path as a legitimate win (all enemy ships marked sunk, victory visualization fires, post-game overlay appears).
