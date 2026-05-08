# Hulls & Hellfire - Battleship Game Implementation Plan

## Overview

Transform the existing Expo app into a Battleship game called "Hulls & Hellfire". The app uses file-based routing with Expo Router and bottom-tab navigation.

---

## 1. Tab & Navigation Changes

### Rename Tabs

| Current Tab | New Name | Route File              | Purpose               |
|-------------|----------|-------------------------|------------------------|
| Home        | Home     | `app/(tabs)/index.tsx`  | Start screen & game    |
| Explore     | Stats    | `app/(tabs)/stats.tsx`  | Player statistics      |

- Rename `app/(tabs)/explore.tsx` to `app/(tabs)/stats.tsx`.
- Update `app/(tabs)/_layout.tsx`: change the tab label from "Explore" to "Stats" and update the route name and icon accordingly.

---

## 2. Home Tab - Screen Flow

The Home tab progresses through a series of screens managed by local state (no additional routes needed).

### Screen 1: Name Entry

- Displayed when no player name is stored.
- Shows:
  - Game title / logo ("Hulls & Hellfire").
  - A text input field for the player name.
  - A "Confirm" button to store the name.
- On confirm:
  - Persist the name (e.g. `AsyncStorage` or React context).
  - Advance to Screen 2.

### Screen 2: Start Screen

- Displayed when a player name is stored but no game is active.
- Shows:
  - Game title / logo.
  - Greeting with the stored player name.
  - A "Start Game" button.
- On "Start Game":
  - Create a new `Game` instance (see Model section).
  - Advance to the game screens (ship placement, then battle).

### Screen 3: Ship Placement (future)

- Player places their ships on their own grid.

### Screen 4: Battle (future)

- Turn-based gameplay against an AI opponent.

---

## 3. Stats Tab

- Displays player statistics: games played, wins, losses, hit/miss ratio.
- Data is read from persisted storage.
- Initially shows empty/zero stats until games are completed.

---

## 4. Data Model

### 4.1 Game

A `Game` represents a single match between two players.

```
Game
  id: string
  status: "placement" | "playing" | "finished"
  currentTurn: Player        // reference to the player whose turn it is
  winner: Player | null
  players: [Player, Player]  // exactly two players
  gameFields: [GameField, GameField]  // one per player
```

- A `Game` holds exactly **two players** and **two game fields** (one per player).
- `status` tracks the lifecycle of the match.
- `currentTurn` alternates between players each round.

### 4.2 Player

```
Player
  id: string
  name: string
  isAI: boolean
```

- The human player uses the name entered on the Home screen.
- The AI opponent is created automatically when a game starts.

### 4.3 GameField

A `GameField` is the 10x10 grid belonging to one player.

```
GameField
  owner: Player
  fields: Field[][]          // 10x10 matrix
  ships: Ship[]
```

- Contains the grid of individual `Field` cells.
- Contains the list of `Ship` instances placed on this grid.

### 4.4 Field

A `Field` is a single cell on the grid.

```
Field
  x: number                  // column (0-9)
  y: number                  // row (0-9)
  status: "empty" | "miss" | "hit"
  shipPart: ShipPart | null  // reference if a ship part occupies this cell
```

- `status` starts as `"empty"`.
- When an opponent fires at this cell:
  - If `shipPart` is `null` -> status becomes `"miss"`.
  - If `shipPart` is set -> status becomes `"hit"`, and the associated `ShipPart` is marked as hit.

### 4.5 Ship

A `Ship` is composed of multiple `ShipPart` instances laid out contiguously on the grid.

```
Ship
  id: string
  type: ShipType
  parts: ShipPart[]
  orientation: "horizontal" | "vertical"
```

**Ship Types and Sizes:**

| Type         | Size (parts) | Count per player |
|--------------|-------------|------------------|
| Carrier      | 5           | 1                |
| Battleship   | 4           | 1                |
| Cruiser      | 3           | 1                |
| Submarine    | 3           | 1                |
| Destroyer    | 2           | 1                |

A ship is **sunk** when all of its parts are hit.

### 4.6 ShipPart

A `ShipPart` is one segment of a ship, occupying exactly one `Field`.

```
ShipPart
  ship: Ship                 // back-reference to parent ship
  field: Field               // the field this part occupies
  isHit: boolean
```

- `isHit` starts as `false`.
- When the field is attacked and this part exists, `isHit` becomes `true`.

### Entity Relationships

```
Game
 ├── Player[2]
 └── GameField[2]
      ├── Field[10][10]
      │    └── ShipPart? ──► Ship
      └── Ship[]
           └── ShipPart[]
                └── Field (back-ref)
```

- `Game` owns two `Player`s and two `GameField`s (one-to-one mapping between player and field).
- Each `GameField` owns a 10x10 grid of `Field`s and a list of `Ship`s.
- Each `Ship` owns its `ShipPart`s.
- `ShipPart` and `Field` have a bidirectional reference: a `Field` optionally points to a `ShipPart`, and a `ShipPart` points back to its `Field`.

---

## 5. Implementation Order

1. **Rename Explore tab to Stats** - file rename + layout update.
2. **Define the data model** - TypeScript types/interfaces in a `models/` directory.
3. **Home Screen 1: Name Entry** - text input, persist name with AsyncStorage.
4. **Home Screen 2: Start Screen** - greeting + start button, create Game instance.
5. **Stats Tab** - read and display persisted stats (stub with empty data initially).
6. **Ship Placement Screen** - interactive grid for placing ships.
7. **Battle Screen** - turn-based firing, AI logic, win/loss detection.
8. **Polish** - animations, sound effects, theming.
