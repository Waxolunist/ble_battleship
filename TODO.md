- clipping on start screen, test renders
- clean up old branches
- max 10 chars name

## Findings from the single-player bot run (2026-09-19, S22, SDK 57)

From driving [the test plan](docs/how-to/single-player-bot-testing.md) on a Galaxy S22
(Android 15, Fabric) against SDK 57. Final run: **27 passed, 0 failed**, with both
endings reached by real play and no dev force-victory — victories in 60 and 56
shots, a defeat in 60, and a confirmed retreat. Crash buffer empty, no fatal
exceptions, no JS errors.

Every failure seen along the way was in the test harness, not the app. The app
did not fail a single case.

### Fixed in this pass

- **Rank line clipped its outer glyphs.** `CADET CEDRIC` lost the C at each end.
  Only shows up after three games, because the captain is addressed as `SIR`
  until then — which is why it went unseen. BlackOpsOne paints wider than it
  measures, so the text needs `paddingHorizontal`; `s(8)` was ~7 dp here and far
  too little. German is worse: `KOMMODORE` and `UNGETESTET` are longer still, so
  capping the name at 10 characters (above) helps this line as well.
- **The screen dimmed and locked mid-match.** Placement and battle are spent
  watching rather than touching. `useKeepAwake()` now holds the screen for that
  route only, released on the way out.

### Worth doing

- **expo-audio 57 throws on every playback state change.** 465
  `ExpoModulesCore` NullPointerExceptions in one session, all from
  `BaseAudioPlayer.sendStatusUpdate` → `SharedObject.emit` → JNI `emitEvent`.
  Inside the library, caught, and audio plays — but it is constant noise in
  logcat and buries real findings. Belongs upstream.
- **One JS warning with nothing in it.** `W/ReactNativeJS: Error: undefined`,
  no stack. It is what the dev warning banner points at. Needs a debugger
  session to trace.
- **The APK is ~175 MB.** Every ABI plus native symbol tables. This is what ran
  the CI runner out of heap in `packageRelease` (worked around by raising
  `-Xmx`). An ABI split, or leaving symbol tables out of CI builds, would cut
  build time, artifact size and memory pressure together — the heap bump treats
  the symptom.
- **The dev warning banner sits on top of `FIRE AT WILL`.** In a dev build the
  *"Open debugger to view warnings"* toast covers the placement screen's primary
  action, so taps land on the banner. Dev-only, but it makes the button
  unreachable while it shows.

### Still untested

Not covered by the bot, and not to be read as passing:

- Drag-and-drop placement, including overlap and off-grid rejection (TC-14–17).
  Needs reliable gesture synthesis.
- Device rotation on each screen (TC-51).
- Locale switching (TC-52) — though the app has been driven in both `de` and
  `en` incidentally.
- **TC-11 is a weak assertion.** It checks that `FIRE AT WILL` is present, not
  that it is disabled before the fleet is placed; uiautomator does not expose
  the dimmed state.

### Notes for whoever automates next

Each of these cost a run:

- A wireless adb reconnect silently drops both the reverse tunnel and
  `svc power stayon`. The app then falls back to a packaged bundle that a debug
  build does not have and shows a `JSBundleLoader` redbox — which looks exactly
  like an app crash.
- A dropped adb transport makes `pidof` return nothing, which looks exactly like
  a dead app.
- The Mac sleeps after one minute on these settings; `caffeinate -dims -w <pid>`
  bound to the runner holds it awake and releases itself.
- Turn timing varies (2.9–3.6 s: staged beats plus a random 900–1600 ms AI aim),
  so fixed sleeps silently drop shots. Poll for `SELECT TARGET`.
- The first turn may be the enemy's, so waiting only for `SELECT TARGET` after
  commencing marks a healthy launch as a failure.
- A bot that sweeps without chasing its hits cannot win: it scatters damage over
  five ships and finishes none, while the AI hunts *and* targets. Victory by
  real play needs the follow-up.
- `uiautomator dump` costs ~5 s here because it waits for an idle UI and the
  rain and swell never stop. A `screencap` is ~2 s, and a cell's verdict colour
  is settled at 450 ms, so the capture can overlap the enemy's turn rather than
  follow it. Hit is ~(240,112,5), miss ~(15,12,17), untouched ~(24,29,67). That
  took a game from ~10 minutes to ~3.
- Two nodes read `RETREAT` during the confirm dialog — the battle screen's own
  button and the dialog's confirm. Picking the last in tree order taps the one
  behind the modal and the dialog just sits there, which reads as the app
  ignoring the confirm.
- Decode adb output with `errors="replace"`: native logs carry raw bytes, and a
  stray `0xb4` in logcat killed an otherwise complete run at its final step.
- The stats tab does not exist during a battle, so a "before" reading taken
  mid-battle compares nothing. Take the baseline on the harbour.
