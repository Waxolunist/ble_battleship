# How to test single-player with a bot

A plan for driving Hulls & Hellfire end to end through its UI, without a human, and deciding
afterwards whether it worked. It covers every single-player path: placement, both endings,
retreat from both screens, the endgame actions, and what the stats screen should say once the
dust settles.

Multiplayer is out of scope — that needs two devices and is covered by
[two-device debugging](two-device-debugging.md).

## What the bot is driving

Single-player is a five-screen state machine. Everything below is written against these names.

```
harbour ──"TO THE BATTLE STATION"──> placement ──"FIRE AT WILL"──> battle
   ^                                     │                            │
   │                                     │ RETREAT                    │ RETREAT -> confirm
   │                                     v                            v
   └──────── MAKE PORT ──────────── (straight home)            VICTORY | LOST AT SEA
                                                                       │
                                                        PLAY AGAIN / REVENGE -> placement
```

The fleet is five ships over **17 cells** — Carrier 5, Battleship 4, Cruiser 3, Submarine 3,
Destroyer 2 (`models/types.ts`). Seventeen hits ends the game, from either side.

## Before the first run

These are setup steps, not test cases, and skipping them produces failures that look like bugs.

| Step | Why |
|---|---|
| `adb shell svc power stayon true` | A full game runs several minutes. The screen locks mid-run otherwise and every tap lands on the lock screen. |
| Pin the locale with `EXPO_PUBLIC_DEV_FORCE_LANGUAGE=en` (or `de`) | Text anchors are the bot's only reliable handle. Without this it inherits the device locale and every anchor is a coin flip. |
| Check `adb devices` for duplicates | A device paired twice over wireless appears as two transports. Always pass `-s <serial>`, and re-read the list if calls start failing — a dropped transport looks exactly like a dead app. |
| Dismiss the dev warning banner | See [traps](#traps-that-cost-real-time). |
| Decide about tutorials | First launch runs the placement and battle tours. Either script through them (TC-03) or clear them first. |

Tour state lives under `@tour_guide:placement` and `@tour_guide:battle`; `resetTutorials()` in
`store/tutorialStorage.ts` clears both. Stats persist through `fileSystemStorage`, so a run
inherits whatever the last one recorded — reset via **reset stats** on the stats tab when a case
depends on a clean record.

## How to drive it

**Anchor on text, never on coordinates.** Dump the tree and resolve the element you want:

```
adb -s "$SERIAL" shell uiautomator dump /sdcard/ui.xml
adb -s "$SERIAL" shell cat /sdcard/ui.xml
```

Every node carries `text` and `bounds`; tap the centre of the bounds. Grid cells have no text, so
derive them from the row labels (`A`–`J`) and column labels (`1`–`10`), which do. In battle both
grids are on screen at once — the **enemy grid is the lower one**, so take the column-label band
with the larger `y` and the ten row labels below it.

**Wait for states, not for durations.** The shot sequence is deliberately staged
(`hooks/useCombat.ts`):

| Beat | Player shot | Enemy shot |
|---|---|---|
| Lock / incoming | 0 ms | 400 ms |
| Fire | 200 ms | 550 ms |
| Verdict | 450 ms | 750 ms |
| Turn hands over | 900 ms | 1100 ms |

Plus the AI takes 900–1600 ms to aim (`hooks/useAIOpponent.ts`), so **one full cycle is roughly
2.9–3.6 seconds and varies every turn**. A fixed 3-second sleep works most of the time and then
silently drops a shot, which is worse than failing. Poll for `SELECT TARGET` before every tap
instead.

## Test cases

Anchors below are the English strings; the German column of `locales/de/` has the equivalents.

### Harbour

| ID | Case | Steps | Expected |
|---|---|---|---|
| TC-01 | No captain name | Fresh install, open app | `ENTER YOUR NAME` prompt; HOST/JOIN panel hidden until a name exists |
| TC-02 | Name accepted | Type a name, submit | Harbour shows `⚓ ALL HANDS ON DECK!` and the name with its rank |
| TC-03 | Change name | Tap `change name` | Returns to entry; new name shows on the harbour and on the placement subtitle |
| TC-04 | Tabs | Tap `Stats`, tap `Play` | Both tabs render; returning to Play does not restart a battle |

### Placement

| ID | Case | Steps | Expected |
|---|---|---|---|
| TC-10 | Entry | `TO THE BATTLE STATION` | `⚔ BATTLE STATION ⚔`, empty 10×10 grid, `FLEET` tray with five ships |
| TC-11 | Fire disabled while incomplete | Observe `FIRE AT WILL` before placing | Dimmed/disabled; tapping it does nothing |
| TC-12 | Shuffle | Tap the shuffle control (`⇄`) | All five ships land on the grid, each tray row shows its check, `FIRE AT WILL` becomes enabled |
| TC-13 | Rotate | Tap a ship's orientation toggle | Arrow flips between horizontal and vertical; a placed ship re-orients on the grid |
| TC-14 | Drag placement | Drag a ship from the tray to a valid berth | Ship occupies exactly `SHIP_SIZES[ship]` cells; tray row checks off |
| TC-15 | Overlap rejected | Drag a ship onto cells another occupies | Drop refused, ship returns, board unchanged |
| TC-16 | Off-grid rejected | Drag so the ship would overhang an edge | Same — refused, board unchanged |
| TC-17 | Re-place a placed ship | Drag a ship already on the grid elsewhere | Moves; total placed count stays 5 |
| TC-18 | Retreat from placement | Tap `RETREAT` | Returns to harbour. **No game is recorded** — verify the stats engagement count is unchanged |
| TC-19 | Commence | Tap `FIRE AT WILL` | Battle screen; divider reads `SELECT TARGET` or `INCOMING FIRE` |

TC-19 matters more than it looks: **the first turn may be the enemy's**, so a bot that waits only
for `SELECT TARGET` will call a perfectly good launch a failure.

### Battle

| ID | Case | Steps | Expected |
|---|---|---|---|
| TC-20 | Miss | Fire at open water | `MISS` verdict, cell marked, turn passes to enemy |
| TC-21 | Hit | Fire at an occupied cell | `HIT!` verdict, cell marked hit |
| TC-22 | Sink | Fire the last cell of a ship | `SUNK!` plus `<SHIP> SUNK`; enemy counter decrements |
| TC-23 | Enemy shot | Wait through the enemy turn | `INCOMING FIRE`, a cell resolves on the player grid, turn returns |
| TC-24 | Ship lost | Let the AI finish one of yours | `<SHIP> LOST`; player counter decrements |
| TC-25 | Tap during enemy turn | Tap an enemy cell while `INCOMING FIRE` | Ignored — no shot, no state change |
| TC-26 | Tap a resolved cell | Tap a cell already hit or missed | Ignored; the turn does not pass |
| TC-27 | Counters | Track both counters all game | Each starts at 5 and only ever decreases, once per sink |

### Endings

| ID | Case | Steps | Expected |
|---|---|---|---|
| TC-30 | Victory | Sink all 17 enemy cells | `VICTORY` / `Enemy fleet destroyed.` with `PLAY AGAIN` and `MAKE PORT` |
| TC-31 | Defeat | Let the AI sink all 17 of yours | `LOST AT SEA` / `Your fleet was lost.` with `REVENGE` and `MAKE PORT` |
| TC-32 | Retreat confirm | Tap `RETREAT` in battle | Dialog: `Abandon battle?` with `HOLD THE LINE` and `RETREAT` |
| TC-33 | Retreat cancelled | Tap `HOLD THE LINE` | Dialog closes, battle continues, turn state intact |
| TC-34 | Retreat confirmed | Tap `RETREAT` in the dialog | Defeat sequence runs; counts as a **loss** in stats |
| TC-35 | Play again | `PLAY AGAIN` / `REVENGE` | Fresh placement screen, empty grid, full tray |
| TC-36 | Make port | `MAKE PORT` | Harbour; no battle left running underneath |

**Reaching victory cheaply.** Sinking 17 cells by sweeping takes 40–60 turns, roughly three
minutes of wall clock. For victory-path cases, set `DEV_SHOW_FORCE_VICTORY = true` in
`constants/dev.ts` — it adds `V` and `L` buttons bottom-right that force either ending
immediately. Use the sweep for at least one full end-to-end run per release, and the dev buttons
for everything downstream of the ending.

To sweep: fire every cell where `(row + col) % 2 == 0` first. Every ship is at least two cells
long, so that parity covers all of them; then fill in the rest to finish off what you found.

### Stats

| ID | Case | Steps | Expected |
|---|---|---|---|
| TC-40 | Empty state | Reset stats, open Stats | `NO COMBAT DATA` / `Complete a battle to see your record.` |
| TC-41 | Win recorded | Win, open Stats | Engagements +1, victories +1, streak +1 |
| TC-42 | Loss recorded | Lose, open Stats | Engagements +1, defeats +1, current streak resets to 0 |
| TC-43 | Retreat recorded | Retreat mid-battle, open Stats | Counts as a defeat (TC-34), not as a discarded game |
| TC-44 | Accuracy | Count your own shots during a game | `SHOTS FIRED`, `HITS`, `MISSES` agree with what the bot fired |
| TC-45 | Rank thresholds | Play enough games to cross a boundary | `UNPROVEN` at 0 games, `RECRUIT` under 3, then CADET 0% / ENSIGN 30% / CAPTAIN 45% / COMMODORE 60% / ADMIRAL 70% |
| TC-46 | Persistence | Force-stop the app, reopen | Record survives — it is written through `fileSystemStorage` |
| TC-47 | Reset | Tap `reset stats` | Returns to TC-40's empty state |

### Robustness

| ID | Case | Steps | Expected |
|---|---|---|---|
| TC-50 | Background mid-battle | Home, wait 30 s, reopen | Battle intact, turn state sane, no duplicate shot |
| TC-51 | Rotate | Rotate the device on each screen | Layout holds; no crash |
| TC-52 | Locale switch | Restart pinned to `de` | Every anchor has its German equivalent; no raw keys like `battle.victory.title` on screen |
| TC-53 | Rapid taps | Tap the same enemy cell five times fast | Exactly one shot resolves |
| TC-54 | Kill and relaunch | `am force-stop`, relaunch | Returns to harbour cleanly; stats intact |

## What to assert

UI text alone is a weak oracle — the app can be visibly fine and throwing every frame. Assert on
three channels per case:

1. **Screen** — the expected anchor is present, and the anchor from the previous state is gone.
2. **Log** — `adb logcat -b crash` empty, and no `FATAL EXCEPTION`, `ReactNativeJS: Error`, or
   redbox in the main buffer.
3. **State** — for anything that records, read the stats screen before and after and diff it.

Known log noise to filter, so it does not drown real findings:

- `E/ExpoModulesCore … BaseAudioPlayer.sendStatusUpdate … NullPointerException` — an expo-audio 57
  bug, fires on every playback state change, caught and harmless.
- `W/ziparchive … base.dm: No such file or directory` — normal for a debug install.

Audio and haptics cannot be asserted through adb. The best available check is that cues do not
throw: `playSound()` never raises by contract, so a crash near a cue is a real finding.

## Traps that cost real time

Each of these was hit while automating this app, and each looks like an application bug until you
know better.

- **The dev warning banner covers `FIRE AT WILL`.** In a dev build the *"Open debugger to view
  warnings"* toast sits exactly over the bottom buttons on the placement screen. Taps land on the
  banner. Dismiss it first, or test a release build.
- **Navigation is slower than it looks.** Harbour → placement regularly takes longer than six
  seconds on a mid-range device. A tap that landed is indistinguishable from one that missed until
  the next screen appears, so wait for the destination anchor rather than sleeping.
- **A dropped adb transport looks like a dead app.** `pidof` returning nothing means the transport
  went away at least as often as it means the process did. Re-check `adb devices` before
  concluding anything.
- **The screen locks.** Covered above, and it silently converts the rest of the run into taps on a
  lock screen.

## Exit criteria

A single-player pass is green when every case above passes on one device, **with at least one
victory and one defeat reached by real play** rather than the dev buttons, and the crash buffer is
empty across the whole session.
