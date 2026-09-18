# How to run on two devices (wireless only)

This guide covers installing, running, and debugging Hulls & Hellfire on two physical Android
devices at once — needed for testing the multiplayer transport (`services/multiplayer.ts`,
`services/lan.ts`, `services/webrtc.ts`).

The app targets **both** Android and iOS — `app.json` configures the iOS bundle identifier and the
multiplayer permissions (`NSLocalNetworkUsageDescription`, `NFCReaderUsageDescription`,
`NSBonjourServices`), and `npm run ios` is wired up. Both `ios/` and `android/` are prebuild
outputs and are gitignored, so a missing `ios/` folder only means `npx expo prebuild -p ios` has
not been run locally — it is not a statement about platform support.

**This guide is Android-specific** because the wireless install and log flow below is built on
Android's wireless ADB. The iOS equivalent (pairing a device over Wi-Fi in Xcode → Devices and
Simulators, and running from Xcode or `npm run ios`) is not covered here and needs a Mac with
Xcode plus a signing identity.

Everything below works **without a USB cable**. Android 11+ wireless debugging is used for
install and log access; the Mac and both phones must be on the same Wi-Fi network (not a guest
network — client isolation breaks both `adb` and the game's mDNS discovery).

Reference devices for this guide: **Samsung Galaxy S22** (One UI) and **Google Pixel 7**. Both are
arm64 (`arm64-v8a`), so the APK can be built for that ABI alone.

## Which build do you want?

| | Release APK | Dev build + Metro |
|---|---|---|
| Runs standalone (Mac can be off) | ✅ | ❌ — needs Metro reachable |
| Fast reload / React DevTools | ❌ | ✅ |
| JS logs via `adb logcat` | ✅ | ✅ |
| Build time | slower (bundles JS) | faster after first build |

Use the **release APK** to just play a two-device match. Use the **dev build** when you are
iterating on code. Both install the same way (section 2).

---

## 1. One-time phone setup

Do this on **both** phones.

### 1a. Enable developer options

- **Pixel 7:** Settings → About phone → tap **Build number** 7 times → enter PIN.
- **Galaxy S22:** Settings → About phone → **Software information** → tap **Build number** 7 times
  → enter PIN.

### 1b. Enable wireless debugging

- **Pixel 7:** Settings → System → **Developer options** → **Wireless debugging** → toggle **On**.
- **Galaxy S22:** Settings → **Developer options** → **Wireless debugging** → toggle **On**.

Confirm "Allow wireless debugging on this network?" and tick **Always allow on this network**.

### 1c. Pair each phone with the Mac (once per phone)

On the phone, inside **Wireless debugging**, tap **Pair device with pairing code**. A dialog shows
an IP\:PORT and a 6-digit code. Keep the dialog open, and on the Mac:

```bash
adb pair <IP>:<PAIRING_PORT>
# paste the 6-digit code when prompted
```

Then close the dialog and read the **different** IP\:PORT on the main Wireless debugging screen
(under the phone's name) and connect:

```bash
adb connect <IP>:<CONNECT_PORT>
adb devices -l    # both phones should be listed as "device"
```

> The pairing port and the connect port are different, and the connect port changes every time
> wireless debugging is toggled off and on. Pairing itself is permanent — after a Wi-Fi drop you
> only need `adb connect` again, never `adb pair`.

Give the two endpoints shell names so the rest of this guide is copy-pasteable:

```bash
S22=<IP_S22>:<CONNECT_PORT_S22>
PIXEL=<IP_PIXEL>:<CONNECT_PORT_PIXEL>
```

### 1d. Permissions the game needs

On first launch, grant the runtime prompts on both phones. The app declares `NFC`,
`ACCESS_WIFI_STATE`, `CHANGE_WIFI_MULTICAST_STATE` and `INTERNET` (see `app.json`). For the NFC
path, also make sure **NFC is toggled on** in quick settings on both phones.

---

## 2. Build and install

### Release APK (standalone play)

```bash
cd android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
cd ..
```

Output: `android/app/build/outputs/apk/release/app-release.apk`. It is signed with the checked-in
**debug keystore** (`android/app/build.gradle` → `signingConfigs.release`), so it installs directly
and both phones get the same signature — fine for testing, not for distribution.

Install to both phones over Wi-Fi:

```bash
adb -s $S22   install -r android/app/build/outputs/apk/release/app-release.apk
adb -s $PIXEL install -r android/app/build/outputs/apk/release/app-release.apk
```

Launch:

```bash
adb -s $S22   shell monkey -p com.vcollaborate.hulls_and_hellfire -c android.intent.category.LAUNCHER 1
adb -s $PIXEL shell monkey -p com.vcollaborate.hulls_and_hellfire -c android.intent.category.LAUNCHER 1
```

If an install fails with `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, a differently-signed build (e.g. an
older debug APK) is already there — uninstall first:

```bash
adb -s $S22 uninstall com.vcollaborate.hulls_and_hellfire
```

### Dev build + Metro (iterating on code)

**Order matters here.** A debug build has no JS baked in — it fetches the bundle from Metro at
launch. Starting it before Metro is up and `reverse` is set gives you
`Unable to load script`, so run the three steps below in order.

Step 1 — build the debug APK once and install it on both phones:

```bash
cd android && ./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a && cd ..
adb -s $S22   install -r android/app/build/outputs/apk/debug/app-debug.apk
adb -s $PIXEL install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Step 2 — start Metro and leave it running in its own terminal:

```bash
npx expo start --dev-client
```

Step 3 — point both phones at it and launch. Wireless adb still supports `reverse`, which is the
most reliable option — it keeps `localhost:8081` valid on the phone:

```bash
adb -s $S22   reverse tcp:8081 tcp:8081
adb -s $PIXEL reverse tcp:8081 tcp:8081

adb -s $S22   shell monkey -p com.vcollaborate.hulls_and_hellfire -c android.intent.category.LAUNCHER 1
adb -s $PIXEL shell monkey -p com.vcollaborate.hulls_and_hellfire -c android.intent.category.LAUNCHER 1
```

Metro has to stay running for as long as the dev build is in use. The `reverse` tunnel is tied to
the adb connection, so after any Wi-Fi drop or `adb connect`, re-run step 3 for that phone before
reloading the app. If the app is already showing the error screen, fix the tunnel and then
force-stop and relaunch it:

```bash
adb -s $S22 shell am force-stop com.vcollaborate.hulls_and_hellfire
```

If `reverse` is not available, shake the phone (or `adb -s $S22 shell input keyevent 82`) →
**Settings → Debug server host & port for device** → enter `<MAC_LAN_IP>:8081` (currently
`192.168.178.80:8081`) → reload. Redo this whenever the Mac's LAN IP changes.

`npm run android` also works, but it targets a single device — if both are connected it will ask
which one, so it is only convenient for the first phone.

---

## 3. No-adb fallback: install over HTTP

If you would rather not pair a phone at all, serve the APK from the repo and download it in the
phone's browser:

```bash
cd android/app/build/outputs/apk/release
python3 -m http.server 8000
```

On the phone, open `http://192.168.178.80:8000/app-release.apk` and tap the download. Android will
ask to allow installs from Chrome — **Settings → Apps → Chrome → Install unknown apps → Allow**
(on the S22: Settings → Apps → Chrome → **Install unknown apps**). This works only for the release
APK; a dev build still needs Metro reachable.

---

## 4. Logs

Per device, in separate terminals:

```bash
adb -s $S22   logcat -s ReactNativeJS:V
adb -s $PIXEL logcat -s ReactNativeJS:V
```

The in-app `MultiplayerDebugPanel` shows TX/RX message traces on both transports and is usually
faster to read than logcat during a live test.

---

## 5. Testing the two network paths

`services/network-detector.ts` picks a transport based on connectivity:

- **`lan`** (Wi-Fi/other) — `react-native-zeroconf` (mDNS discovery) + `react-native-tcp-socket`.
  Both devices must be on the same subnet/SSID.
- **`nfc-webrtc`** (cellular/no Wi-Fi) — `react-native-nfc-manager` for the pairing handshake, then
  `react-native-webrtc`. Requires physically tapping the two phones back-to-back to complete the
  NFC handshake before WebRTC negotiation starts.

To force the NFC/WebRTC path, turn Wi-Fi off on both phones and use mobile data — note that this
also drops wireless adb, so start logcat before switching, or rely on the in-app debug panel.

## 6. Force-kill / disconnect testing

```bash
adb -s $PIXEL shell am force-stop com.vcollaborate.hulls_and_hellfire
```

The other device should surface a connection-lost state within a couple of seconds.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `adb devices` shows nothing after a while | Wireless debugging port changed (phone rebooted / toggled). Re-read the port and `adb connect` again. |
| `failed to authenticate` on pair | The pairing dialog timed out — reopen **Pair device with pairing code** and retry immediately. |
| Phone disappears when the screen locks | Disable battery optimisation for wireless debugging, or keep **Stay awake** on in Developer options. |
| Devices can't see each other in-game | Guest/isolated Wi-Fi, or the two phones are on different bands of a mesh with client isolation. Put both on the same SSID. |
| Gradle fails with a JDK error | The build is pinned to JDK 17 via `org.gradle.java.home` in `android/gradle.properties`. |
