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


Here's a detailed Phase 4 playbook. Android-only — there's no ios/ folder and BLE advertising on iOS Simulator is unreliable anyway.

0. Pre-flight (one-time, on your Mac)

cd /Users/csterzl/Development/ble_battleship

# Confirm deps & native project are intact
npm install
ls android/app/build.gradle              # native android project exists ✓

# Confirm two physical Android devices are visible (USB-debugging on, cable in)
adb devices                              # expect two lines with "device" status
If only one phone shows up, plug in the second and accept the "Allow USB debugging" prompt on it.

1. Build the app (debug build, recommended for Phase 4)
The debug build keeps __DEV__ true so the BLEDebugPanel overlay shows full TX/RX traces — exactly what AC checkbox #2 needs.


# Build & install on the FIRST device. Picks the only connected device,
# or prompts you to choose if multiple are connected.
npm run android
When prompted "Multiple devices found, which one?", pick device A (your designated HOST).

After it finishes you'll have:

An APK at android/app/build/outputs/apk/debug/app-debug.apk
The app installed and running on device A
Metro bundler running in this terminal — leave it running for the whole test session
2. Install on the second device
In a second terminal:


cd /Users/csterzl/Development/ble_battleship

# List devices, copy the second device's serial
adb devices

# Install the APK you just built onto device B (replace <SERIAL_B>)
adb -s <SERIAL_B> install -r android/app/build/outputs/apk/debug/app-debug.apk

# Launch the app on device B
adb -s <SERIAL_B> shell monkey -p com.anonymous.hulls_and_hellfire -c android.intent.category.LAUNCHER 1
Both phones will connect to the Metro bundler on your Mac over USB; no LAN needed.

3. Watch logs while testing (optional but useful)
Two more terminals, one per device:


# Terminal 3 — HOST logs
adb -s <SERIAL_A> logcat -s ReactNativeJS:V

# Terminal 4 — JOIN logs
adb -s <SERIAL_B> logcat -s ReactNativeJS:V
ReactNativeJS is where console.log from the JS side lands. Useful if the on-screen BLEDebugPanel misses something.

4. Run the AC walkthrough
With both apps open, follow AC 1–9 from the story. Quick cheat-sheet for what to watch on each device's BLEDebugPanel:

Step	Expect to see (TX / RX)
HELLO exchange	→ HELLO then ← HELLO on each side
Fire at Will pressed	→ FLEET_READY then ← FLEET_READY
Player fires	Firer: → FIRE then ← SHOT_RESULT. Peer: ← FIRE then → SHOT_RESULT
Last ship sunk	Loser: → GAME_OVER. Winner: ← GAME_OVER
Force-kill joiner	Host should see disconnect → connection-lost alert
REMATCH	Both: → REMATCH / ← REMATCH → returns to PLACEMENT
5. Force-kill test (AC #3)
While mid-battle on device B (the joiner):


adb -s <SERIAL_B> shell am force-stop com.anonymous.hulls_and_hellfire
On device A, the <BLEConnectionGuard> should fire the connection-lost alert within a couple of seconds.

6. AI regression check (AC #4)
On each device individually: home screen → start single-player game → play a few turns → confirm the AI fires and verdicts resolve normally. The BLEDebugPanel should show no TX/RX in AI mode.

7. Optional — release build
If you want to test on devices that aren't tethered to Metro:


cd android
./gradlew assembleRelease

# APK lands at:
#   android/app/build/outputs/apk/release/app-release.apk
adb -s <SERIAL_A> install -r app/build/outputs/apk/release/app-release.apk
adb -s <SERIAL_B> install -r app/build/outputs/apk/release/app-release.apk
Caveat: the BLEDebugPanel still renders in release, but console.log traces won't reach logcat. Stick with debug for Phase 4 unless you specifically need release behaviour.

Troubleshooting
adb devices shows "unauthorized" → Unlock the phone, tap "Allow" on the USB-debugging prompt, replug if needed.
App installs but BLE permission dialog never appears → Settings → Apps → Hulls & Hellfire → Permissions → grant Nearby devices & Location manually, then relaunch.
HOST advertises but JOIN can't find it → Toggle Bluetooth off/on on both devices; Android's BLE stack gets wedged surprisingly often. Also confirm both devices are within ~5m.
Metro fails after a code change mid-test → In the npm run android terminal, press r to reload, or just shake the device and tap "Reload".
When you finish the walkthrough, the four Phase 4 checkboxes in the story can be ticked off.

Device A opens the host. Everything seems to work. Device B The join does not find any devices.
Let me look at the BLE code to diagnose. Several things commonly break BLE discovery on Android.

Bash List BLE-related files
IN
ls services/ 2>&1; echo "---"; ls hooks/ | grep -i ble 2>&1

OUT
ble-debug-log.ts
ble.ts
---
useBLEOpponent.ts
useBLEPermissions.ts
Read ble.ts
Read useBLEPermissions.ts
Read ble.ts
Bash Find where scan/advertise are called
IN
grep -rln "startScanning\|startAdvertising" app/ components/ hooks/ 2>&1

OUT
components/ble/BLEMultiplayerPanel.tsx
Read BLEMultiplayerPanel.tsx
Bash Read AndroidManifest.xml
IN
cat android/app/src/main/AndroidManifest.xml 2>&1

OUT
<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools">
  <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
  <uses-permission android:name="android.permission.BLUETOOTH"/>
  <uses-permission android:name="android.permission.BLUETOOTH_ADMIN"/>
  <uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE"/>
  <uses-permission android:name="android.permission.BLUETOOTH_CONNECT"/>
  <uses-permission android:name="android.permission.BLUETOOTH_SCAN"/>
  <uses-permission android:name="android.permission.INTERNET"/>
  <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" tools:replace="android:maxSdkVersion"/>
  <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW"/>
  <uses-permission android:name="android.permission.VIBRATE"/>
  <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="32" tools:replace="android:maxSdkVersion"/>
  <queries>
    <intent>
      <action android:name="android.intent.action.VIEW"/>
      <category android:name="android.intent.category.BROWSABLE"/>
      <data android:scheme="https"/>
    </intent>
  </queries>
  <application android:name=".MainApplication" android:label="@string/app_name" android:icon="@mipmap/ic_launcher" android:roundIcon="@mipmap/ic_launcher_round" android:allowBackup="true" android:theme="@style/AppTheme" android:supportsRtl="true" android:enableOnBackInvokedCallback="false">
    <meta-data android:name="expo.modules.updates.ENABLED" android:value="false"/>
    <meta-data android:name="expo.modules.updates.EXPO_UPDATES_CHECK_ON_LAUNCH" android:value="ALWAYS"/>
    <meta-data android:name="expo.modules.updates.EXPO_UPDATES_LAUNCH_WAIT_MS" android:value="0"/>
    <activity android:name=".MainActivity" android:configChanges="keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode|smallestScreenSize|locale|layoutDirection" android:launchMode="singleTask" android:windowSoftInputMode="adjustResize" android:theme="@style/Theme.App.SplashScreen" android:exported="true" android:screenOrientation="portrait">
      <intent-filter>
        <action android:name="android.intent.action.MAIN"/>
        <category android:name="android.intent.category.LAUNCHER"/>
      </intent-filter>
      <intent-filter>
        <action android:name="android.intent.action.VIEW"/>
        <category android:name="android.intent.category.DEFAULT"/>
        <category android:name="android.intent.category.BROWSABLE"/>
        <data android:scheme="hullsandhellfire"/>
      </intent-filter>
    </activity>
  </application>
</manifest>
Found the likely culprit. The Android manifest declares BLUETOOTH_SCAN without the neverForLocation flag, so on Android 12+ the OS gates BLE scanning behind the system-level Location toggle (not just app permission). Combine that with a handful of other common Android BLE quirks and you have a few things to check.

What to check on Device B (in order of likelihood)
1. Location services ON (system-wide toggle)
Settings → Location → ON at the top level. The app's "Allow location" permission is not enough — Android 12+ also needs the global Location switch on, because this build's BLUETOOTH_SCAN is not declared with neverForLocation.

This single setting fixes the "JOIN sees nothing" problem about 80% of the time.

2. App permissions
Settings → Apps → Hulls & Hellfire → Permissions — confirm both granted:

Nearby devices (covers BLUETOOTH_SCAN/CONNECT/ADVERTISE)
Location → "Allow only while using the app" or "Allow all the time"
3. Bluetooth actually on
Both devices, Bluetooth toggle on. Sounds obvious but worth eliminating.

4. Check the BLEDebugPanel on Device B
When you press JOIN, what shows up?

Log line	Means
startScanning → then scanning started	Scan engaged successfully — keep looking
device seen (ignored — no magic prefix)	Scan IS working, but Device A's advertisement isn't reaching it intact → see #5
Nothing at all after "scanning started"	Permission/location problem — go back to #1–2
startScanning failed	Read the error — usually permission denial
5. If scan works but A is invisible
Force-stop the app on both devices, toggle Bluetooth off-and-on on both, then host A and join from B again. Android's BLE stack caches stale advertisers aggressively, and a host that restarted advertising can fail to re-broadcast until the stack is reset.

Also pull logs from device B during scanning:


adb -s <SERIAL_B> logcat -s ReactNativeJS:V BluetoothLeScanner:V BluetoothAdapter:V
BluetoothLeScanner errors like "App is scanning too frequently" or "ScanFilter cannot match advertisement" point at OS-side rejection.

If you want the easy fix
The cleanest code fix is to add neverForLocation to the scan permission so the user doesn't have to enable system Location at all. I can apply it now — it requires editing app.json and rebuilding. Want me to do that?