# Story: Local Two-Player via BLE

## User Story

> As a **player with a friend nearby**, I want **to battle them head-to-head on our two devices without needing internet**
> so that **I can enjoy a real opponent instead of the AI when we're in the same room.**

---

## Background

Hulls & Hellfire is currently single-player — the opponent is always the AI. This story adds an offline two-player mode over Bluetooth Low Energy (BLE) so two players on separate devices can compete in the same physical space without any server infrastructure.

BLE is chosen over Wi-Fi peer-to-peer because:
- No network permissions or hotspot setup required from the user.
- Works in areas without Wi-Fi (planes, basements, outdoor events).
- Lower latency for the small, infrequent messages Battleship requires.
- Both iOS and Android expose BLE APIs through Expo-compatible native modules.

The library used is [`munim-bluetooth`](https://github.com/munimtechnologies/munim-bluetooth), a React Native BLE wrapper that handles the peripheral/central role duality and characteristic subscriptions.

The existing game engine (`engine/combat.ts`, `engine/placement.ts`), stores (`useGameStore`), and UI (`app/battle.tsx`) are **not modified**. BLE is wired in as an orthogonal layer that replaces the AI turn logic for the duration of a multiplayer session.

---

## Scope

| Area | Included |
|---|---|
| BLE discovery (host advertising, joiner scanning) | Yes |
| Peer selection UI on the home screen | Yes |
| Placement phase sync (fleet positions exchanged at ready) | Yes |
| Battle phase sync (shots and results transmitted) | Yes |
| Game-over detection and result screen | Yes |
| Rematch from the result screen | Yes |
| Graceful disconnect handling (mid-game BLE drop) | Yes |
| AI replaced by remote player in multiplayer mode | Yes |
| Stats recording for multiplayer games | Yes |
| Internet/server-based matchmaking | Out of scope |
| Spectator mode | Out of scope |
| Voice or text chat | Out of scope |
| More than two simultaneous players | Out of scope |
| Cross-platform version negotiation beyond a version field | Out of scope |

---

## BLE Roles

One device is the **host** (BLE peripheral — advertises a service). The other is the **joiner** (BLE central — scans for that service). After the initial connection, both roles are symmetric: each can read and write.

The host always takes the first turn in battle. This is deterministic and requires no coin-flip protocol.

---

## Service & Characteristics

```
Service UUID:          "HHFIRE-0001"
TX Characteristic:     "HHFIRE-TX-01"    (WRITE_WITHOUT_RESPONSE)
RX Characteristic:     "HHFIRE-RX-01"    (NOTIFY)
```

The advertisement payload includes the host's captain name in a manufacturer-specific field — up to 16 UTF-8 characters plus a 4-byte magic number (`0x48484648`, i.e. "HHFH") to distinguish Hulls & Hellfire sessions from other BLE devices.

Both constants live in `constants/ble.ts`.

---

## Message Protocol

All messages are UTF-8 JSON strings. MTU is negotiated on connect; messages must not exceed 512 bytes. Each message has a `type` discriminant. The full union:

```typescript
type BLEMessage =
  // Handshake — exchanged immediately after BLE connect
  | { type: 'HELLO'; name: string; version: string }

  // Placement phase — sent by each player once they tap "Fire at Will"
  // Contains only origin cell + orientation; the receiver reconstructs
  // full ship geometry using the existing placement engine.
  | { type: 'FLEET_READY'; ships: FleetPlacement[] }

  // Battle phase — sent by the active player to fire a shot
  | { type: 'FIRE'; x: number; y: number }

  // Battle phase — sent by the receiver after resolving the shot
  // against their own board using applyFire()
  | { type: 'SHOT_RESULT';
      x: number;
      y: number;
      result: 'hit' | 'miss' | 'sunk';
      shipType?: ShipType }    // present only when result === 'sunk'

  // End of game — sent by the player whose fleet was just sunk
  | { type: 'GAME_OVER' }

  // Post-game — first sender requests rematch; reply of same type accepts
  | { type: 'REMATCH' }

  // Graceful disconnect
  | { type: 'BYE' }

type FleetPlacement = {
  shipType: ShipType;
  x: number;          // origin column (0–9)
  y: number;          // origin row (0–9)
  orientation: Orientation;
};
```

**Why the receiver resolves shots:** Each player is the sole authority over their own board. The FIRE sender cannot see the opponent's grid (it was hidden during placement). The receiver calls `applyFire()` from `engine/combat.ts` and replies with `SHOT_RESULT`. The sender then updates `opponentFields` in `useGameStore` with the returned result. This keeps the existing engine intact and makes cheating structurally impossible.

**Version field:** If a `HELLO` message carries an unrecognised version, the recipient shows an error ("Please update Hulls & Hellfire to play multiplayer") and disconnects.

---

## State Machine

Both peers maintain the same state machine independently.

```
IDLE
  ├─ tap "HOST"  →  HOST_ADVERTISING
  └─ tap "JOIN"  →  SCANNING

HOST_ADVERTISING
  └─ joiner connects  →  HANDSHAKING

SCANNING
  ├─ discovers host(s) — list updates live
  └─ tap a host  →  CONNECTING → HANDSHAKING

HANDSHAKING
  └─ both HELLO messages exchanged  →  LOBBY

LOBBY
  ├─ both players confirm ready  →  PLACEMENT
  └─ either player cancels       →  IDLE (disconnect)

PLACEMENT
  └─ both FLEET_READY received   →  BATTLE

BATTLE
  ├─ local player fires          →  wait for SHOT_RESULT
  ├─ remote FIRE received        →  resolve, send SHOT_RESULT, update turn
  └─ fleet fully sunk            →  GAME_OVER

GAME_OVER
  ├─ both REMATCH                →  PLACEMENT (re-use connection)
  ├─ BYE or BLE disconnect       →  IDLE
  └─ navigate away               →  IDLE (send BYE)
```

BLE disconnect events (e.g. devices going out of range) at any state outside `IDLE` transition to `IDLE` and show an alert: "Connection lost — opponent disconnected."

---

## Turn Protocol

- The host fires first.
- After sending `FIRE`, the active player's turn state is `'waiting_for_result'` — no further shots can be fired.
- After receiving `SHOT_RESULT`, the active player applies the result and ends their turn (`setTurn('enemy')`).
- A `FIRE` message received out of turn is logged and silently discarded.

The existing `useCombat.ts` animation choreography (locked → impact → verdict beats) runs identically in multiplayer. The BLE hook triggers the same store actions at the same points in the sequence.

---

## New Files

```
constants/ble.ts                  — service UUID, characteristic UUIDs, magic bytes, version string
store/useBLEStore.ts              — BLE state machine, peer info (name, id), discovered peers list
hooks/useBLEGame.ts               — bridges BLE events to useGameStore actions; replaces AI turn logic
components/ble/
  BLEMultiplayerPanel.tsx         — discovery/lobby UI inserted into the home screen
  PlayerListItem.tsx              — single row in the discovered-peers list
```

No existing files are modified except `app/(tabs)/index.tsx` (one insertion above `<View style={styles.nameContainer}>`).

---

## Home Screen UI

`<BLEMultiplayerPanel />` is inserted immediately above `<View style={styles.nameContainer}>` in [app/(tabs)/index.tsx](app/(tabs)/index.tsx). It adapts its height to the current BLE state so it does not displace the name entry or the battle button when idle.

### Idle (collapsed)

```
┌──────────────────────────────────────┐
│  ⚔  2-PLAYER     [HOST]   [JOIN]     │
└──────────────────────────────────────┘
```

A single borderless row. The `⚔` glyph and "2-PLAYER" label use `Fonts.rounded`. HOST and JOIN are `HapticPressable` buttons styled like the existing confirm button (border, dark background, `letterSpacing: 3`).

### Host advertising

```
┌──────────────────────────────────────┐
│  AWAITING CHALLENGER...              │
│  Your callsign: ADMIRAL GREY         │
│                           [CANCEL]   │
└──────────────────────────────────────┘
```

"AWAITING CHALLENGER..." pulses in `GameColors.gold` (opacity 1.0 → 0.4 loop, 1.2 s). Callsign is the stored `captainName`.

### Scanning

```
┌──────────────────────────────────────┐
│  SCANNING...                         │
│  ▸  COMMODORE LEE         [JOIN]     │
│  ▸  ENSIGN FORD           [JOIN]     │
│                           [CANCEL]   │
└──────────────────────────────────────┘
```

Rows are `PlayerListItem` components. Signal strength is not displayed — BLE RSSI is unreliable at close range and adds noise. The list updates live as devices are discovered.

### Lobby / connected

```
┌──────────────────────────────────────┐
│  ✓  COMMODORE LEE  —  CONNECTED      │
└──────────────────────────────────────┘
```

One compact row. The name is in `GameColors.gold`. The existing "TO BATTLE STATION" button becomes active; tapping it sends `FLEET_READY` and transitions the game into multiplayer placement mode.

---

## Integration with Existing Game Flow

### Placement phase

The placement screen is unchanged. When the player taps "Fire at Will", `useBLEGame` intercepts and:
1. Serialises the placed fleet into `FleetPlacement[]`.
2. Sends `FLEET_READY`.
3. Waits for the opponent's `FLEET_READY`.
4. On receipt, reconstructs the opponent's fleet (for display in the defeat screen's "their fleet" view if desired) and calls `startBattle()` as normal.

### Battle phase

`useCombat.ts` drives the shot animation. `useBLEGame` hooks into the turn cycle:

- **Local turn:** Player taps a cell → `markTargeted`, animation starts → at the verdict beat, `FIRE` is sent → on `SHOT_RESULT` receipt, `resolveShot` is called with the returned result.
- **Remote turn:** On `FIRE` received, `useBLEGame` calls `applyFire()` directly, sends `SHOT_RESULT`, then triggers the same animation sequence as if the AI had fired (reusing the existing AI-shot animation path).

### Stats

`useStatsStore.recordGame()` is called identically at game over. Multiplayer wins and losses count the same as AI wins and losses in the rank system.

---

## Permissions

| Platform | Permission | When requested |
|---|---|---|
| iOS | `NSBluetoothAlwaysUsageDescription` | On first HOST or JOIN tap |
| Android 12+ | `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, `BLUETOOTH_ADVERTISE` | On first HOST or JOIN tap |
| Android < 12 | `BLUETOOTH`, `BLUETOOTH_ADMIN`, `ACCESS_FINE_LOCATION` | On first HOST or JOIN tap |

Permission strings must be added to `app.json` and translated in both `en` and `de` locale files.

---

## Error States

| Condition | Behaviour |
|---|---|
| Bluetooth off | Alert: "Bluetooth is off — enable it in Settings to play multiplayer." Deep-link to Settings. |
| Permission denied | Alert with explanation and a "Open Settings" button. |
| HELLO version mismatch | Alert: "Please update Hulls & Hellfire to play multiplayer." Both peers disconnect. |
| BLE disconnect mid-game | Alert: "Connection lost." Both peers return to IDLE. Game state is not saved. |
| Opponent takes > 30 s to place fleet | Timeout alert with option to cancel and return to IDLE. |
| Opponent takes > 60 s to fire | Timeout alert with option to cancel. |

---

## Acceptance Criteria

- [ ] Tapping HOST begins advertising; the device appears in a nearby device's JOIN list within 5 seconds.
- [ ] Tapping JOIN shows a live-updating list of advertising hosts.
- [ ] Tapping a host in the JOIN list connects and shows the LOBBY state on both devices.
- [ ] Mismatched app versions produce an error alert and disconnect cleanly on both sides.
- [ ] Both players can place their fleets independently; the game does not start until both send `FLEET_READY`.
- [ ] The host always fires first.
- [ ] A `FIRE` message is sent to the opponent on every player shot.
- [ ] The receiver resolves the shot with `applyFire()` and replies with `SHOT_RESULT`.
- [ ] The sender's `opponentFields` are updated to reflect hit / miss / sunk after `SHOT_RESULT` is received.
- [ ] A sunk ship triggers the sunk announcement on both devices.
- [ ] When all of a player's ships are sunk, `GAME_OVER` is sent, and both devices show the appropriate victory / defeat screen.
- [ ] "Rematch" on the result screen reconnects and returns both players to the placement phase without dropping the BLE connection.
- [ ] A BLE disconnect at any game phase shows an alert and returns the home screen to IDLE state.
- [ ] Bluetooth-off and permission-denied states produce clear, localised error messages.
- [ ] Multiplayer wins and losses are recorded in `useStatsStore` identically to AI games.
- [ ] The panel is hidden when Bluetooth is unavailable on the device (simulator, iPod touch without BLE).
- [ ] All strings in `BLEMultiplayerPanel` and `PlayerListItem` are translated in both `en` and `de` locale files.
- [ ] No hard-coded colour values are introduced — all colours reference `GameColors`.
- [ ] No hard-coded asset paths — any images added go through `IMAGES` or `LOCALE_IMAGES`.
- [ ] `npm run lint` and `npm run format` pass with no errors after implementation.

---

## Implementation Tasks

Each task leaves the app fully playable against the AI. BLE multiplayer is built incrementally on top, never blocking the single-player path.

---

### Task 1 — BLE constants

Create `constants/ble.ts` with the service UUID, TX/RX characteristic UUIDs, advertisement magic bytes, and the protocol version string.

No behaviour changes. The file is pure constants; nothing imports it yet.

---

### Task 2 — BLE store

Create `store/useBLEStore.ts` with the full BLE state machine type (`BLEState`) and its Zustand store. Initial state is `IDLE`. No UI, no BLE calls.

The store is the single source of truth for BLE phase, connected peer info, and the discovered-peers list. Nothing reads it yet.

---

### Task 3 — Multiplayer panel (shell)

Create `components/ble/BLEMultiplayerPanel.tsx` and `components/ble/PlayerListItem.tsx`. Insert `<BLEMultiplayerPanel />` above `<View style={styles.nameContainer}>` in `app/(tabs)/index.tsx`.

The panel renders the idle row ("⚔ 2-PLAYER [HOST] [JOIN]") but the buttons are no-ops. All existing AI game flows are unaffected.

---

### Task 4 — Bluetooth availability and permissions

Wire HOST and JOIN taps to check Bluetooth availability and request the required permissions (iOS `NSBluetoothAlwaysUsageDescription`; Android `BLUETOOTH_SCAN` / `BLUETOOTH_CONNECT` / `BLUETOOTH_ADVERTISE`).

If Bluetooth is off, show the "Bluetooth is off — enable it in Settings" alert. If permission is denied, show the explanation alert with an "Open Settings" button. If unavailable (simulator), hide the panel entirely.

No actual BLE advertising or scanning yet. The buttons are now live but do nothing after a successful permission grant.

---

### Task 5 — Discovery (HOST\_ADVERTISING and SCANNING)

Implement the HOST\_ADVERTISING and SCANNING states in `useBLEStore`. Tapping HOST starts `munim-bluetooth` advertising with the service UUID and the captain name in the manufacturer field. Tapping JOIN starts scanning for that service UUID.

The panel renders the advertising and scanning UI states (pulsing "AWAITING CHALLENGER..." and the live peer list). Tapping CANCEL stops advertising/scanning and returns to IDLE. No connection attempt yet.

---

### Task 6 — Connection and handshake (HANDSHAKING and LOBBY)

Implement CONNECTING → HANDSHAKING → LOBBY. Tapping a peer in the scanning list initiates a BLE connect. On connect, both devices immediately send a `HELLO` message. On receipt of the remote `HELLO`, both transition to LOBBY.

Version mismatch during handshake shows the update-required alert and disconnects. BLE disconnect at any state outside IDLE shows the "Connection lost" alert and returns to IDLE.

The panel renders the LOBBY row ("✓ OPPONENT NAME — CONNECTED"). The existing "TO BATTLE STATION" button remains active for AI play; the multiplayer path is not wired to it yet.

---

### Task 7 — Multiplayer game entry and placement

Create `hooks/useBLEGame.ts`. When the BLE store is in LOBBY and the player taps "TO BATTLE STATION", route into a multiplayer-flagged game session (a `mode: 'ble'` field in `useBLEStore` distinguishes it from the default `'ai'` session).

The placement screen is unchanged. The AI fleet is not pre-placed in BLE mode (no AI opponent exists). Both players place their own fleets normally. The `useBLEGame` hook listens for the "Fire at Will" tap; for now it only sets a local `localFleetReady` flag without sending anything. The opponent's grid is shown as empty and untargetable until Task 8 completes.

---

### Task 8 — Fleet exchange (FLEET\_READY)

On "Fire at Will", `useBLEGame` serialises the placed fleet into `FleetPlacement[]` and sends `FLEET_READY`. It then waits for the remote `FLEET_READY`. When both are received, `startBattle()` is called on both devices and the BATTLE state begins.

The opponent's initial fleet layout is stored in `useBLEStore` (for potential defeat-screen display). Turn is set to `'player'` on the host and `'enemy'` on the joiner — so the host fires first.

---

### Task 9 — Shot exchange (FIRE and SHOT\_RESULT)

Implement the full FIRE / SHOT\_RESULT turn loop in `useBLEGame`.

**Local turn:** player taps a cell → `markTargeted` → animation starts → at the verdict beat, send `FIRE { x, y }` → on `SHOT_RESULT` receipt, call `resolveShot` with the returned result and advance the turn.

**Remote turn:** on `FIRE` received, call `applyFire()` against local `fields`, send `SHOT_RESULT`, then trigger the same animation sequence used for AI shots. A `FIRE` received out of turn is silently discarded.

Sunk ship events propagate identically to the single-player path (`setSunkEvent`).

---

### Task 10 — Game over and rematch

On `SHOT_RESULT` that sinks the last ship, the losing device sends `GAME_OVER` and both devices show their respective victory/defeat screens. `useStatsStore.recordGame()` is called on both sides.

The result screen "PLAY AGAIN" button sends `REMATCH`. The first device to send it waits; on receipt of the remote `REMATCH`, both transition back to PLACEMENT using the existing BLE connection (no reconnect needed). Tapping any other exit path sends `BYE` and transitions both devices to IDLE.

---

## Out of Scope

- Server-based or internet matchmaking
- More than two players
- Spectator mode
- In-game chat
- Cross-version gameplay (beyond version-mismatch detection)
- Reconnection after a mid-game BLE drop (disconnect = game abandoned)
- Leaderboards or cloud sync of multiplayer stats
