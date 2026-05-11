# Battle View — Game Flow & UI Overview

## What is Hulls & Hellfire?

A mobile Battleship-style game built with React Native / Expo. The player faces off against an AI opponent on classic 10x10 grids. The entire battle — from fleet placement to the last shot — takes place on a single screen that transitions between two phases.

---

## Visual Design Language

### Atmosphere
The screen is layered on top of a **full-bleed background image** (`bg.jpeg`) with a **55% black overlay**, creating a dark, moody naval-warfare feel. All UI floats on this dimmed backdrop.

### Color Palette
| Role | Color | Usage |
|---|---|---|
| Primary / friendly | `rgba(80, 160, 255)` | Grid tint, cell borders, label text |
| Ship cells | `rgba(60, 110, 210, 0.75)` | Occupied grid cells (blue steel) |
| Gold / call-to-action | `#FFC832` / `#e8c84a` | "Fire at Will" button, player-turn glow, "SELECT TARGET" divider |
| Danger / enemy | `#FF5050` | Enemy-turn glow, "INCOMING FIRE" divider, enemy grid tint |
| Hit | `rgba(255, 120, 0, 0.9)` | Orange flash on confirmed hit |
| Miss | `rgba(10, 10, 15, 0.95)` | Near-black — spent cell |
| Valid preview | `rgba(80, 210, 120, 0.8)` | Green — ship can be placed here |
| Invalid preview | `rgba(210, 60, 60, 0.8)` | Red — placement blocked |
| Text | White at varying opacity | Titles, labels, buttons |

### Typography
All text is **uppercase, wide letter-spacing (1–4 px), bold (600–900 weight)** — a military stencil vibe without a custom font. Sizes range from 10 px for grid labels up to 26 px for the phase title.

### Grid Appearance
Each grid is a 10x10 matrix of small square cells separated by 1 px gaps. The gap color is the grid's tint (blue for the player, red-shifted for the enemy). Row labels (A–J) run down the left; column labels (1–10) run across the top, rendered in a soft blue at 10 px.

Ships that have sprite art (Carrier, Submarine, Destroyer) are rendered as a single horizontal image sliced across the cells they occupy. When placed vertically, the sprite is rotated 90 degrees. Ships without art (Battleship, Cruiser) fall back to solid blue cells.

---

## Game Flow

### Phase 1 — Placement ("Battle Station")

**What the player sees (top to bottom):**

1. **Title bar** — "BATTLE STATION" in large white text with a subtitle "PLACE YOUR FLEET, CAPTAIN". Both fade in from above on screen entry.

2. **Player grid** — An empty 10x10 grid with blue tint. Ships can be dragged onto it.

3. **Ship tray** — A panel titled "FLEET" listing all five ships:
   - Carrier (5 cells)
   - Battleship (4 cells)
   - Cruiser (3 cells)
   - Submarine (3 cells)
   - Destroyer (2 cells)

   Each row shows: a **rotation toggle** (arrow icon, toggles horizontal/vertical), the **ship name**, a row of **cell-sized sprite tiles** representing the ship, and a **green checkmark** that appears once placed.

   A **shuffle button** (bottom-right of the tray, black square with arrows icon) randomizes the entire fleet in one tap.

4. **Action buttons** — Two side-by-side buttons spanning the screen width:
   - **RETREAT** (left) — bordered white, dark fill. Slides the entire screen upward and navigates back.
   - **FIRE AT WILL** (right) — bordered gold, gold-tinted fill. Disabled (dimmed) until all five ships are placed.

**Drag-and-drop interaction:**
- The player drags a ship from the tray onto the grid. A **floating drag preview** follows the finger — a semi-transparent copy of the ship sprite at 88% opacity, offset slightly above the touch point.
- As the ship hovers over the grid, **preview cells** light up green (valid) or red (invalid/overlapping).
- Dropping on a valid position snaps the ship into the grid. Dropping on an invalid position cancels the move.
- Ships already on the grid can be **re-dragged** to a new position. Dragging a placed ship back onto the tray removes it from the grid.

### Transition — "Commence Firing"

When the player taps "FIRE AT WILL":
1. The placement UI (title, tray, buttons) **fades out** over 350 ms while sliding slightly away (title up, tray/buttons down).
2. The player grid nudges upward to make room.
3. A **"COMMENCE FIRING" splash image** scales up from the center (0.2x to 1x) with a fade-in, holds for ~1.5 seconds, then fades out while scaling to 1.7x — a cinematic punch effect.
4. The battle phase fades in underneath.

### Phase 2 — Battle

**What the player sees (top to bottom):**

1. **Player grid** (upper half) — Now read-only, showing the player's fleet. Hits appear orange, misses appear black.

2. **Turn divider** — A thin horizontal line with a centered label:
   - Player's turn: gold line, text reads "SELECT TARGET"
   - Enemy's turn: red line, text reads "INCOMING FIRE"
   - The line **pulses** (opacity oscillates between 0.2 and 0.9 on a 700 ms cycle).

3. **Enemy grid** (lower half) — A red-tinted grid. Ships are **hidden** (fog of war). The player taps a cell to fire.

**Turn flow:**

| Step | What happens | Timing |
|---|---|---|
| Player taps an empty enemy cell | Cell immediately shows "targeted" (red highlight) | instant |
| Resolve | Cell becomes orange (hit) or near-black (miss) | 500 ms delay |
| Turn passes to enemy | Divider swaps to red / "INCOMING FIRE" | 400 ms animated transition |
| Enemy AI picks a random empty cell | Cell on player grid shows "targeted" | 800 ms pause |
| Resolve | Hit or miss revealed | 500 ms delay |
| Turn returns to player | Divider swaps back to gold / "SELECT TARGET" | 400 ms animated transition |

**Active-turn visual cues:**
- The grid whose turn it is glows with a **pulsing colored border** (gold for the enemy grid on the player's turn, red for the player grid on the enemy's turn). The glow oscillates between 35% and 100% opacity on an 800 ms cycle.
- The inactive grid dims to 55% opacity; the active grid is fully opaque.
- The opacity transition between turns takes 400 ms.

### AI Behavior (current)

The enemy AI is purely random: it picks uniformly from all remaining empty cells on the player's grid. There is no hunt/target logic yet.

### Win Condition (current)

Not yet implemented. The game continues indefinitely — there is no detection for all ships sunk, no victory/defeat screen, and no end-of-game flow.

---

## Screen Lifecycle Summary

```
[Main Menu] --tap "Battle"--> [Battle Screen enters]
                                    |
                              Placement Phase
                           (drag ships onto grid)
                                    |
                         tap "FIRE AT WILL"
                                    |
                          Commence Firing flash
                                    |
                              Battle Phase
                         (alternating turns, no end)
                                    |
                         tap "RETREAT" (placement)
                         or navigate back
                                    |
                          [screen slides out]
```

---

## Component Hierarchy

```
BattleScreen (app/battle.tsx)
  ImageBackground + dark overlay
    PlacementView (components/views/placement-view.tsx)
      Title + subtitle
      GameField (components/game-field.tsx)  ← player grid, drag-enabled
      ShipTray (components/ship-tray.tsx)    ← fleet roster + shuffle
      Retreat + Fire At Will buttons
    BattleView (components/views/battle-view.tsx)
      GameField  ← player grid (read-only)
      Turn divider (pulsing line + label)
      GameField  ← enemy grid (red tint, ships hidden, tappable)
    "Commence Firing" flash overlay
    DragPreview (components/drag-preview.tsx) ← floating ship under finger
```
