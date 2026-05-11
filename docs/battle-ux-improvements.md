# Battle UX Improvements — Design Proposals

Three interconnected features to raise the tension and readability of the battle phase. All proposals follow the existing design language: dark backdrop, military typography, gold/red/blue palette, animated glows.

### Font Addition: Black Ops One

All dramatic text callouts (sunk labels, hit/miss/sunk divider flashes) use **Black Ops One** — a military display typeface from Google Fonts. It is used exclusively for momentary callouts to make them pop against the system-font UI. Standard UI text (grid labels, divider turn labels, buttons) continues to use the system font.

---

## 1. Ship Sunk Reveal

**Problem:** When the last cell of a ship is hit, nothing distinguishes it from a regular hit. The player has no moment of triumph (sinking an enemy ship) or dread (losing one of their own).

### Option A — Ghost Reveal (recommended)

When the final part is hit, **all cells of the sunk ship crossfade from orange-hit to a distinct "sunk" color** and the **full ship sprite fades in** across those cells — even on the enemy grid where ships are normally hidden.

| Detail | Value |
|---|---|
| Sunk cell color | `rgba(90, 30, 30, 0.95)` — charred dark red |
| Sprite overlay | Ship sprite at 40% opacity, desaturated / tinted red, rendered on top of the sunk cells |
| Animation | 600 ms crossfade from orange to sunk color, sprite fades in simultaneously |
| Text callout | A floating label appears above the grid: "CARRIER SUNK" in gold (enemy ship) or "CARRIER LOST" in red (player ship), **Black Ops One** font, uppercase, letter-spacing 3, fades up and out over 1.5 s |
| Haptics | Medium impact on enemy sunk, heavy impact on player sunk |

**Pros:**
- The revealed sprite gives instant spatial understanding — the player sees exactly where the ship was and how large it is
- The color shift distinguishes sunk cells from merely-hit cells at a glance
- The floating label adds a narrative beat without blocking gameplay
- Works well with the existing sprite system (Carrier, Submarine, Destroyer have art; Battleship/Cruiser would show as solid sunk-colored cells with a slight glow outline)

**Cons:**
- Revealing the enemy sprite could feel like "too much info" — though in classic Battleship you always learn the ship identity on sinking, so this is faithful
- Needs a new cell status (`"sunk"`) in the data model

### Option B — Pulse + Outline Only

All cells of the sunk ship simultaneously flash white (100 ms), then settle into the sunk color. A **glowing outline** traces the ship's bounding rectangle (1 px, same charred-red, pulsing once). No sprite is revealed on the enemy grid.

**Pros:**
- Simpler to implement — no sprite rendering on the enemy grid
- More mysterious — the enemy fleet stays hidden

**Cons:**
- Harder to read at a glance which ship was sunk, especially for the 3-cell ships (Cruiser vs. Submarine)
- Loses the satisfying "reveal" moment
- The floating text label becomes the only way to identify the ship, which is easy to miss

### Option C — Sinking Animation (sprite slides off-grid)

The revealed sprite briefly appears, then "sinks" — translates downward with decreasing opacity, as if descending into the water.

**Pros:**
- Most cinematic; strong emotional payoff
- Clear visual metaphor

**Cons:**
- Significantly more complex animation (translate + fade + clip to grid bounds)
- The sprite disappears after the animation, so the sunk cells lose their context — the player can't glance back later and see which ship was where
- Could feel slow if it happens frequently in the late game

### Recommendation

**Option A (Ghost Reveal)** gives the best balance of readability, drama, and implementation cost. The persistent ghost sprite serves as a battlefield log — late in the game, both grids tell a visual story at a glance.

---

## 2. Shot Resolution — Building Tension

**Problem:** Currently a shot resolves in 500 ms flat. There is no anticipation. The player taps, the cell blinks red, and the result appears almost immediately. This feels mechanical rather than dramatic.

### Proposed: Three-Beat Resolution Sequence

Replace the current instant-targeted-then-resolve with a **staged sequence** that stretches the suspense:

#### Beat 1 — "Locked" (0–400 ms)

The tapped cell pulses with a **targeting reticle effect**: a thin gold ring shrinks from 2x to 1x scale around the cell, landing flush with the cell border. The cell itself brightens slightly. A subtle **low rumble haptic** fires on tap.

This beat communicates: "your shot is registered, impact incoming."

#### Beat 2 — "Impact" (400–900 ms)

A brief **screen shake** (3 px random offset, 4 oscillations over 200 ms) simulates the shell hitting water. The cell flashes bright white for 80 ms. **Heavy haptic** fires.

This beat is the point of no return — the shell has landed. The player still doesn't know the outcome.

#### Beat 3 — "Verdict" (900–1800 ms)

The result fades in:

| Outcome | Cell visual | Accompaniment |
|---|---|---|
| **Miss** | White flash fades to near-black (`miss` color). A subtle ripple ring expands outward from the cell (opacity 0.3, fades over 400 ms). | Divider text briefly reads "MISS" in dim white (**Black Ops One** font) before returning to turn label. Soft haptic. |
| **Hit** | White flash fades to bright orange (`hit` color). A brief **fire glow** radiates from the cell — a 2-cell-radius radial gradient in orange, fading over 500 ms. | Divider text flashes "HIT!" in bright gold (**Black Ops One** font) for 800 ms. Medium haptic. |
| **Sunk** | Same as hit, but immediately followed by the Ship Sunk Reveal (see section 1). | Divider text flashes "SUNK!" in gold (**Black Ops One** font) for 1.2 s. Heavy haptic. |

#### Total timing: ~1.8 s per player shot (vs. current 500 ms)

#### Why this duration works
- Classic Battleship (board game) has natural tension because the opponent pauses to check — the digital equivalent should take at least 1–2 seconds
- 1.8 s is long enough to feel suspenseful but short enough to not drag during the late game when many cells are already revealed
- The three distinct visual beats (lock, impact, verdict) give the brain anchors — it doesn't feel like "waiting," it feels like a sequence of events

#### Enemy shots
The enemy AI's shots should use the **same sequence** but slightly faster (total ~1.4 s) — the player is on the receiving end, so the tension comes from dread, not anticipation. The targeting reticle can be red instead of gold.

#### Timing comparison

| Phase | Current | Proposed (player) | Proposed (enemy) |
|---|---|---|---|
| Targeted state | instant | 400 ms (reticle) | 300 ms |
| Impact | — | 500 ms (shake + flash) | 400 ms |
| Verdict reveal | 500 ms | 900 ms (fade + glow/ripple) | 700 ms |
| **Total** | **500 ms** | **~1800 ms** | **~1400 ms** |

### Alternative considered: Dice-roll / slot-machine text

A counter in the divider area rapidly cycles between "HIT" and "MISS" before landing on the true result, like a slot machine.

**Rejected because:** It feels gamey and random rather than tactical. Battleship outcomes are deterministic — you aimed at a cell and either a ship is there or it isn't. A slot-machine metaphor undermines that.

### Alternative considered: Slow camera zoom

The grid slowly zooms toward the targeted cell during resolution.

**Rejected because:** On a small mobile screen, zooming into the grid would crop out context (the rest of the board, the counter, the divider). It also creates jarring layout shifts that conflict with the split-screen design.

---

## 3. Battle Counter

**Problem:** There is no scoreboard or progress indicator. The player has no at-a-glance sense of how the battle is going.

### What to count?

There are several candidates:

| Metric | Direction | Notes |
|---|---|---|
| Ships remaining | Counts down 5 to 0 | Most intuitive — directly tied to the win condition |
| Hits landed | Counts up | Less useful — doesn't account for ship sizes |
| Cells remaining (unhit ship cells) | Counts down 17 to 0 | Granular, but 17 is an odd number to start from; feels like HP |
| Shots fired | Counts up | Irrelevant to winning; more of a stat |

### Recommendation: Ships Remaining (countdown)

**Count down from 5 to 0** for each side. This maps directly to the win condition ("sink all 5 ships"), is immediately understandable, and creates satisfying milestone moments each time a number ticks down.

### Display Design

#### Option A — Divider-Integrated Counter (recommended)

Embed the counters **into the existing turn divider**, one number on each end:

```
 [5]  ———— SELECT TARGET ————  [4]
  ^                              ^
player ships left          enemy ships left
```

| Detail | Value |
|---|---|
| Position | Left end = player ships remaining, right end = enemy ships remaining |
| Typography | Same as divider text: 10 px, weight 700, letter-spacing 3 |
| Color | Player count: blue-white (`rgba(180, 210, 255, 0.8)`). Enemy count: same, but flashes red briefly when a player ship is sunk, gold when an enemy ship is sunk |
| Number format | Single digit, no label — the position (left = yours, right = theirs) makes it clear |
| Animation on change | The number scales up to 1.4x and back to 1x over 400 ms, color briefly flashes gold (enemy sunk) or red (player sunk) before settling back |
| Icon | A small ship silhouette icon before each number (e.g. a tiny 8 px triangle/hull shape) to reinforce meaning without a text label |

**Pros:**
- No new UI real estate needed — the divider already spans the full width and has unused space at the edges
- Keeps the screen clean and focused on the grids
- The counters inherit the divider's color-shifting behavior (gold on player turn, red on enemy turn), creating visual unity
- Symmetric layout (left = you, right = them) is a common game convention

**Cons:**
- Small numbers in a small divider — could be hard to read on very small screens
- Limited space if we later want to add more stats

#### Option B — Floating Score Bar (top of screen)

A dedicated horizontal bar above the player grid:

```
 CAPTAIN: ■ ■ ■ ■ ■     ENEMY: ■ ■ ■ ■ □
```

Each square represents one ship. Filled = alive, hollow/crossed = sunk.

**Pros:**
- Very readable — ship status shown as discrete icons, no ambiguity
- Room for ship-type icons (a tiny carrier silhouette, a tiny destroyer, etc.) instead of generic squares, so you see *which* ships are sunk
- Could double as a status bar for other info later

**Cons:**
- Takes up precious vertical space — the two grids plus divider already fill most of the screen; adding a top bar pushes everything down or requires shrinking the grids
- Competes visually with the turn divider for attention
- More complex layout to animate

#### Option C — Per-Grid Counter (inside each grid's glow border)

A small badge in the top-right corner of each grid:

```
  ┌──────────────────┐
  │ A1 A2 A3 ...  [5]│  ← enemy ships remaining
  │                   │
```

**Pros:**
- Each counter is co-located with its grid — zero ambiguity about which number belongs to whom
- Doesn't require new layout space

**Cons:**
- Overlaps with the grid content area — could obscure the top-right cells
- Looks like a notification badge, which breaks the military aesthetic
- Two separate badges feel disconnected — harder to compare at a glance

### Recommendation

**Option A (Divider-Integrated)** is the cleanest fit. It adds information without adding UI chrome, respects the existing layout, and creates a natural "scoreboard" that the player glances at on every turn (since the divider already draws attention with its color/pulse).

---

## Implementation Priority

| Feature | Complexity | Impact | Suggested order |
|---|---|---|---|
| Counter (divider-integrated) | Low | Medium | 1st — lays groundwork for sunk detection |
| Ship sunk reveal (ghost reveal) | Medium | High | 2nd — needs sunk detection + new cell status |
| Shot resolution sequence | Medium | High | 3rd — benefits from sunk reveal being in place for the "SUNK!" beat |

The counter requires sunk-ship detection logic, which the sunk reveal also needs — so building the counter first forces that data model addition (`"sunk"` status, per-ship alive/sunk tracking), and the sunk reveal builds on top.

---

## Data Model Changes Required

```typescript
// Field.status gains a new value:
status: "empty" | "targeted" | "hit" | "miss" | "sunk"

// Ship gains a computed/tracked property:
isSunk: boolean  // true when every part.isHit === true
```

The `"sunk"` status replaces `"hit"` on all cells of a ship once the final part is hit. This lets the renderer distinguish sunk cells from hit cells with a simple status check — no need to traverse the ship's parts array on every render.
