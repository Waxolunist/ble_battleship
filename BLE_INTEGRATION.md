# BLE Integration Complete ✅

## Installed Dependencies
- `munim-bluetooth` - Native BLE library for iOS/Android
- `react-native-nitro-modules` - Required by munim-bluetooth

## Architecture Overview

### 1. **BLE Service** (`services/ble.ts`)
Core abstraction layer using munim-bluetooth for native BLE operations:

#### Host (Advertiser)
- Encodes captain name in manufacturer data (4-byte magic + UTF-8 name)
- `BLE.startAdvertising()` advertises service UUID with manufacturer data
- `BLE.onCharacteristicWrite()` receives incoming client messages on RX characteristic

#### Joiner (Scanner)
- `BLE.startScan()` discovers devices advertising the service UUID
- Filters by BLE_ADVERTISEMENT_MAGIC prefix in manufacturer data
- Extracts captain name from manufacturer data bytes
- `BLE.connectPeripheral()` connects to selected device
- `BLE.discoverAllServicesAndCharacteristics()` discovers GATT services
- `BLE.startNotification()` listens for messages on RX characteristic

#### Message Protocol
- Converts JSON messages to byte arrays using `String.charCodeAt()`
- `BLE.writeCharacteristicWithoutResponse()` sends to TX characteristic
- Incoming byte data parsed back to JSON via `String.fromCharCode()`

### 2. **Message Flow** (`hooks/useBLEGame.ts`)
Orchestrates multiplayer game lifecycle:

```
PLACEMENT PHASE:
  Player 1 (Host) → "Fire at Will" → bleService.sendMessage(FLEET_READY)
  Player 2 (Joiner) receives FLEET_READY → handleRemoteFleetReady()
  Both ready → setState('BATTLE')

BATTLE PHASE:
  Player 1's turn → taps opponent grid → animation plays (900ms)
  At 900ms (verdict beat) → bleService.sendMessage(FIRE)
  Player 2 receives FIRE → handleRemoteFire()
  Player 2 evaluates shot → bleService.sendMessage(SHOT_RESULT)
  Player 1 receives SHOT_RESULT → handleShotResult() → advance turn

GAME OVER:
  Fleet sunk → bleService.sendMessage(GAME_OVER)
  Opponent receives → setState('GAME_OVER')

REMATCH:
  Both players send REMATCH → setState('PLACEMENT')
```

### 3. **UI Integration** (`components/ble/BLEMultiplayerPanel.tsx`)
Connects UI state to BLE operations:

- **HOST button** → `bleService.startAdvertising(captainName)`
- **JOIN button** → `bleService.startScanning()` + `onDeviceFound(id, name)`
- **Peer selection** → `bleService.connect(deviceId)`
- **CANCEL button** → `bleService.stopAdvertising/Scanning/disconnect()`

### 4. **Role Detection**
- Host (advertiser) fires first: `turn='player'`
- Joiner (connector) fires second: `turn='enemy'`
- Role tracked via `bleService.getRole()`

## Message Types

| Type | Direction | Payload | Timing |
|------|-----------|---------|--------|
| FLEET_READY | Both | `{ fleet: FleetPlacement[] }` | After placement complete |
| FIRE | Both | `{ x, y }` | At 900ms verdict beat |
| SHOT_RESULT | Both | `{ x, y, result, shipType? }` | After evaluation |
| GAME_OVER | Both | (empty) | When opponent fleet sunk |
| REMATCH | Both | (empty) | On replay request |
| BYE | Both | (empty) | On disconnect |
| HELLO | Both | (empty) | Initial handshake (reserved) |

## Error Handling
- All BLE operations wrapped in try-catch
- Connection failures gracefully return to IDLE state
- Message parse errors logged but don't crash
- Queue system for offline message buffering

## Testing

To test the integration:

1. **Android**: Build with `npm run android` after installing munim-bluetooth native modules
2. **iOS**: Build with `npm run ios` after installing munim-bluetooth CocoaPods
3. **Web**: Falls back to mock (logs to console)

### Mock Testing
Use `bleService._simulateMessage()` to test message routing without real hardware:

```typescript
bleService._simulateMessage({
  type: 'FLEET_READY',
  data: { fleet: [] }
});
```

## Deployment Notes

1. **Native Modules**: munim-bluetooth requires EAS build or native builds
2. **Permissions**: Already configured in app.json:
   - iOS: NSBluetoothAlwaysUsageDescription
   - Android: BLUETOOTH, BLUETOOTH_ADMIN, BLUETOOTH_SCAN, BLUETOOTH_CONNECT, BLUETOOTH_ADVERTISE, ACCESS_FINE_LOCATION
3. **Supported Platforms**: iOS 13+, Android 5+
4. **Web**: Mock implementation (no real BLE support)

## Status

✅ Complete munim-bluetooth integration
✅ Message protocol implemented
✅ UI wired to BLE operations
✅ Animation timing synchronized
✅ Role detection functional
✅ Error handling in place
✅ Lint/Format passing

Ready for native build and testing!
