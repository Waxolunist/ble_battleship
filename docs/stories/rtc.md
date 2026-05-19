## User Story

**As a player, I want to start a multiplayer game with someone nearby as quickly and effortlessly as possible, without needing to configure any network settings or rely on an internet connection.**

---

### Scenario 1 — Same WiFi or Hotspot

Chris and Anna want to play together. Chris opens the app and taps **Create Game**. The app silently detects they are on WiFi and starts advertising the game room on the local network. Anna opens the app, taps **Join Game**, and immediately sees *"Chris's Game Room"* in a list. She taps it and the game starts. Neither of them touched a network setting.

---

### Scenario 2 — Mobile Data, No Shared WiFi

Chris and Anna are on the train, each on their own mobile data. Chris taps **Create Game** and the app detects no WiFi — it shows a *"Tap phones together to connect"* screen. Anna taps **Join Game** and sees the same screen. They tap their phones together once, then once more, and the game starts. The app handled everything in the background via NFC and WebRTC.

---

### Scenario 3 — WiFi Available but No Local Games Found

Chris creates a game at home on WiFi. Anna arrives and opens **Join Game** — the app scans for local games for a few seconds, finds nothing, and automatically falls back to the NFC screen. They tap phones and connect seamlessly.

---

### Acceptance Criteria

- Player never needs to enter an IP address or connection code
- Player never needs to manually select a network or enable a hotspot
- On WiFi, discovery is automatic and instantaneous
- On mobile data, connection requires exactly two phone taps
- App detects the best path automatically with no input from the player
- App works without internet when both players are on the same local network


## React Native Packages

| Package | Purpose |
|---------|---------|
| `react-native-webrtc` | Peer-to-peer game data connection |
| `react-native-nfc-manager` | NFC signaling / handshake |
| `react-native-tcp-socket` | Game data over LAN |
| `react-native-zeroconf` | mDNS discovery on LAN |
| `@react-native-community/netinfo` | Detect wifi vs cellular |
| `pako` | Compress WebRTC offer/answer for NFC payload |

---

## Connection Paths

### Path 1 — LAN (WiFi or Hotspot)
```
Detect WiFi → mDNS discovery → TCP socket connection → game starts
```
- No internet needed
- No STUN needed
- Automatic discovery

### Path 2 — NFC + WebRTC
```
Detect cellular (or no LAN games found) → NFC tap × 2 → WebRTC connection → game starts
```
- Works on mobile data
- Works across different networks
- Needs Google STUN (free)
- Players must be physically together

---

## UI Elements

### Home screen
- **Create Game** button
- **Join Game** button

### Create Game screen
- Network detection (automatic, show status to user)
- If WiFi → "Waiting for players..." + game room name visible
- If cellular → "Tap phones to connect" + NFC ready state

### Join Game screen
- If WiFi → scrollable list of discovered nearby games
- If cellular → "Tap phones to connect" + NFC ready state

### Transition / permission screens
- Local network permission prompt explanation (iOS)
- NFC not supported fallback message
- "No network found — please enable hotspot or WiFi" message

### In-game
- No networking UI needed — connection is invisible to player

---

## Migration Task List

The current implementation uses `munim-bluetooth` (BLE/GATT) for peer discovery and data transport. The tasks below replace it with the two-path system described in the story (LAN via mDNS+TCP, or NFC+WebRTC). The wire protocol (HELLO / FLEET_READY / FIRE / SHOT_RESULT / GAME_OVER / REMATCH / BYE), the `Opponent` strategy pattern, and the battle/placement engine are **unchanged**.

---

### 1 — Dependencies

- [x] Remove `munim-bluetooth` from `package.json`
- [x] Add `@react-native-community/netinfo`
- [x] Add `react-native-zeroconf`
- [x] Add `react-native-tcp-socket`
- [x] Add `react-native-nfc-manager`
- [x] Add `react-native-webrtc`
- [x] Add `pako` (+ `@types/pako`)

---

### 2 — Native configuration

- [x] **iOS `Info.plist`** — remove Bluetooth keys (`NSBluetoothAlwaysUsageDescription`, `NSBluetoothPeripheralUsageDescription`); add `NSLocalNetworkUsageDescription`, `NFCReaderUsageDescription`, and the Bonjour service entry for mDNS
- [x] **Android `AndroidManifest.xml`** — remove `BLUETOOTH_*` permissions; add `NFC`, `ACCESS_WIFI_STATE`, `CHANGE_WIFI_MULTICAST_STATE`, and `INTERNET`

---

### 3 — Constants

- [x] Delete `constants/ble.ts`
- [x] Create `constants/multiplayer.ts` with:
  - mDNS service type and domain (e.g. `_hhfh._tcp.local.`)
  - TCP port number
  - STUN server URL (`stun:stun.l.google.com:19302`)
  - Protocol version and HELLO magic (carry over from BLE)
  - HELLO timeout

---

### 4 — Services

- [x] Delete `services/ble.ts` and `services/ble-debug-log.ts`
- [x] Create `services/network-detector.ts` — wraps `@react-native-community/netinfo`; exports `getNetworkPath()` → `'lan' | 'nfc-webrtc'` and an `onNetworkChange` subscriber
- [x] Create `services/lan.ts` — mDNS advertising and discovery via `react-native-zeroconf`; TCP socket creation and message framing via `react-native-tcp-socket`; exposes the same public surface as the old `ble.ts` (startAdvertising / stopAdvertising / startScanning / stopScanning / connect / disconnect / sendMessage / onMessage)
- [x] Create `services/nfc.ts` — writes a compressed (pako) WebRTC offer/answer to the NFC tag on the first tap and reads the peer's payload on the second tap; exposes `writeOffer(sdp)`, `readAnswer()` → Promise, `readOffer()` → Promise, `writeAnswer(sdp)`
- [x] Create `services/webrtc.ts` — creates a `RTCPeerConnection` with the STUN config; exposes `createOffer()`, `setRemoteOffer(sdp)`, `createAnswer()`, `setRemoteAnswer(sdp)`, `sendRaw()`, `onRawMessage()`; uses the data-channel for game messages
- [x] Create `services/multiplayer.ts` — unified transport façade; on `startAdvertising()` / `startScanning()` calls `network-detector` to pick a path, then delegates to `lan.ts` (WiFi) or `nfc.ts` + `webrtc.ts` (cellular); all callers only touch this file

---

### 5 — Store

- [x] Rename `store/useBLEStore.ts` → `store/useMultiplayerStore.ts`; update all imports
- [x] Rename the store hook export (`useBLEStore` → `useMultiplayerStore`) and the Zustand store name
- [x] Replace mode value `'ble'` with `'multiplayer'` throughout the store and all consumers
- [x] Add `connectionPath: 'lan' | 'nfc-webrtc' | null` field to store state, set by the multiplayer service when a path is chosen

---

### 6 — Permissions hook

- [ ] Delete `hooks/useBLEPermissions.ts`
- [ ] Create `hooks/useMultiplayerPermissions.ts` — requests local-network permission (iOS prompt) and NFC permission; returns `{ available, permissionsGranted, requestPermissions }`

---

### 7 — Opponent hook

- [ ] Rename `hooks/useBLEOpponent.ts` → `hooks/useMultiplayerOpponent.ts`; update all imports
- [ ] Replace all `bleService` references with `multiplayerService` (from `services/multiplayer.ts`)
- [ ] Replace all `useBLEStore` references with `useMultiplayerStore`

---

### 8 — UI components

- [ ] Rename `components/ble/` directory → `components/multiplayer/`
- [ ] Rename `BLEMultiplayerPanel.tsx` → `MultiplayerPanel.tsx`; update all imports
  - [ ] On mount, call `network-detector` and store the detected path in local state
  - [ ] **WiFi / HOST state** — show "WAITING FOR PLAYERS…" with the game room name; no NFC prompt
  - [ ] **WiFi / SCAN state** — show scrollable list of discovered nearby games (reuse `PlayerListItem`)
  - [ ] **Cellular / HOST or JOIN state** — show "TAP PHONES TOGETHER" screen; arm NFC via `nfc.ts`
  - [ ] **Scenario 3 fallback** — if WiFi scan finds nothing after a timeout, transition to the NFC screen automatically
- [ ] Rename `BLEConnectionGuard.tsx` → `MultiplayerConnectionGuard.tsx`; update all imports and internal `useBLEStore` / `bleService` references
- [ ] Rename `BLEDebugPanel.tsx` → `MultiplayerDebugPanel.tsx`; wire to the new multiplayer service log
- [ ] Keep `PlayerListItem.tsx` as-is (used for the LAN game list)

---

### 9 — Screen wiring

- [ ] In `app/(tabs)/index.tsx` — replace `<BLEMultiplayerPanel>` with `<MultiplayerPanel>` and update the `bleState === 'LOBBY'` / `mode: 'ble'` guards to use the renamed store and mode value
- [ ] In `app/battle.tsx` — replace `mode === 'ble'` checks with `mode === 'multiplayer'`; replace `<BLEConnectionGuard>` / `<BLEBattleContent>` with renamed counterparts; replace `useBLEOpponent` with `useMultiplayerOpponent`

---

### 10 — Translations

- [ ] Search `locales/en/` and `locales/de/` for any keys whose values mention Bluetooth; update copy to be transport-neutral (e.g. "AWAITING CHALLENGER…" is fine; anything that says "Bluetooth" is not)

---

### 11 — Cleanup

- [ ] Delete `constants/ble.ts` (covered in task 3, confirm removal)
- [ ] Remove BLE-related entries from `package.json` native module lists / Podfile if present
- [ ] Run `npm run lint` and `npm run format` after all changes