# Sound effects

## The game

**Hulls & Hellfire** is a naval duel on two ten-by-ten grids. You place a fleet
of five ships on your own waters, the enemy hides theirs, and the two of you
trade salvoes — coordinate by coordinate — until one fleet is on the bottom.
The opponent is either the AI or a real captain over the local network.

The mood is a storm-lashed WWII gunnery deck, not a board game on a kitchen
table. The backdrop is rain over a heavy sea, the palette is gunmetal, navy,
gold and warning red, and the type is military stencil. The game addresses the
player by rank and takes itself entirely seriously: shots resolve in three
staged beats — reticle **lock**, **impact**, **verdict** — each one carrying its
own haptic, and the screen shakes when a shell lands. Losing is *LOST AT SEA*.

Sound follows that register. Every cue should read as **brass, iron, water and
ordnance** — dry, weighty, mechanical. Nothing chiptune, nothing cute, no
melodic jingles outside the two endgame stingers. The ambient UI stays quiet and
understated so the drama moments have room to hit.

## The files

All eighteen cues live in this folder. They are **synthesised placeholders** —
correct in length, shape and relative loudness, ready to be swapped for real
recordings under the same filenames without touching any code.

- Mono, 44.1 kHz, 16-bit WAV.
- Levelled by **RMS, not peak**, so a klaxon and a water splash sit at sensible
  relative volumes. Match the loudness column when replacing a file.
- Declared in the `SOUNDS` map in [`constants/assets.ts`](../../constants/assets.ts)
  and played only through `playSound()` in [`services/audio.ts`](../../services/audio.ts).

### Launch

| File | Key | Fires when | Character | Length | RMS |
|---|---|---|---|---|---|
| `app_launch.wav` | `appLaunch` | The splash artwork has loaded and begins its cross-fade into the app | An engine room swelling up to pressure on a low D, with one struck ship's bell over it and the sea underneath. The ship waking up, not a fanfare — it sits well below the endgame stingers. | 1.80 s | 0.130 |

### Interface

| File | Key | Fires when | Character | Length | RMS |
|---|---|---|---|---|---|
| `ui_tap.wav` | `uiTap` | Any `HapticPressable` is pressed, plus the "hold the line" button | A single dry switch click with a short low thump under it. Deliberately the quietest cue in the set — it fires constantly. | 0.06 s | 0.060 |

### Placement — arranging the fleet

| File | Key | Fires when | Character | Length | RMS |
|---|---|---|---|---|---|
| `ship_pickup.wav` | `shipPickup` | A ship is lifted off the tray or off the grid | A short rising chirp with a scrape of noise — something heavy coming off its cradle. | 0.14 s | 0.080 |
| `ship_drop.wav` | `shipDrop` | A ship settles into a valid berth, or is stowed back in the tray | A descending thud with a small wash of noise. The pitch falls, so it reads as *settled* against the pickup's rise. | 0.24 s | 0.090 |
| `ship_blocked.wav` | `shipBlocked` | A drop is rejected — overlap, or off the grid | Two low, flat buzzes. Unmistakably negative, but low and brief rather than shrill; a misplaced ship is a small mistake, not an alarm. | 0.26 s | 0.080 |
| `ship_rotate.wav` | `shipRotate` | A ship is turned between horizontal and vertical | Three quick mechanical clicks at rising pitch — a ratchet turning a gun mount one notch. | 0.20 s | 0.043 |
| `fleet_shuffle.wav` | `fleetShuffle` | The shuffle button re-scatters the whole fleet | Six of those ratchet clicks in a rising run — the rotate sound multiplied, so the two obviously belong to the same mechanism. | 0.60 s | 0.045 |

### Transitions

| File | Key | Fires when | Character | Length | RMS |
|---|---|---|---|---|---|
| `battle_start.wav` | `battleStart` | Placement ends, the fleets are exchanged, and the COMMENCE FIRING card slams in | A brass power chord over two drum hits. The one triumphal-sounding cue before the fighting starts; it plays under a 2.5 s animation, so it swells rather than stabs. | 2.00 s | 0.200 |
| `sonar_ping.wav` | `sonarPing` | The turn is handed back to the player after the enemy's shot | A clean sonar ping with one soft echo behind it. Suppressed when the player's last ship has just gone down, so it never collides with the defeat horn. | 1.10 s | 0.090 |

### Combat — the three shot beats

A player shot runs `target_lock` (0 ms) → `cannon_fire` (200 ms) → verdict
(450 ms). An enemy shot runs `incoming_shell` (400 ms) → verdict (750 ms); the
whistle is timed so it lands exactly on the verdict.

| File | Key | Fires when | Character | Length | RMS |
|---|---|---|---|---|---|
| `target_lock.wav` | `targetLock` | The targeting reticle locks onto an enemy cell | Two short high beeps, the second higher — fire-control gear acquiring. Quiet and clipped; it's a preamble, not an event. | 0.30 s | 0.080 |
| `cannon_fire.wav` | `cannonFire` | The player's shell leaves the barrel | A crack of transient over a deep boom that pitches down hard. The player's own guns — the loudest thing on their side of the exchange. | 0.70 s | 0.149 |
| `incoming_shell.wav` | `incomingShell` | An enemy shell is on its way to the player's grid | A long descending whistle, slightly detuned against itself. Pure dread — it announces a hit the player cannot prevent, and it runs the full length of the enemy's beat. | 0.80 s | 0.120 |
| `shot_hit.wav` | `shotHit` | Verdict: the shell struck a hull | An explosion with a low body and a tail of debris noise. Noticeably heavier than the miss — the verdict should be audible without looking. | 0.80 s | 0.171 |
| `shot_miss.wav` | `shotMiss` | Verdict: the shell hit open water | A band-limited splash with one low bubble under it. Soft, wet, anticlimactic. | 0.55 s | 0.093 |
| `ship_sunk.wav` | `shipSunk` | Verdict: that hit finished a ship off | The largest blast in the set, with metal groaning down in pitch beneath it and a long wash of noise. Twice the length of a plain hit — a ship going under is the loudest moment in the exchange. | 1.60 s | 0.196 |

### Endgame

| File | Key | Fires when | Character | Length | RMS |
|---|---|---|---|---|---|
| `victory_fanfare.wav` | `victoryFanfare` | The last enemy ship is sunk | Three rising notes into a sustained major chord over a drum hit. Earned and martial, not celebratory — the game does not do confetti. | 2.40 s | 0.200 |
| `defeat_horn.wav` | `defeatHorn` | The player's last ship is sunk, or they confirm the retreat | Two foghorn blasts, the second lower and longer, over a bed of sea noise. Final and slow; it plays under the fleet submerging column by column. | 2.60 s | 0.200 |
| `retreat_alarm.wav` | `retreatAlarm` | The retreat confirmation is raised, or the player leaves during placement | A two-sweep klaxon with a harsh edge on it. This one asks a question — *are you sure* — so it is urgent rather than conclusive. | 1.40 s | 0.140 |

## Replacing a placeholder

1. Drop the new file in this folder under the **same name**. Keep it mono WAV;
   the `SOUNDS` map and every call site stay as they are.
2. Match the length roughly. The combat cues in particular are timed against
   animation beats — a whistle much longer than 0.8 s arrives after the shell.
3. Match the RMS column, not the peak. Peak-normalising every file makes the
   splash as loud as the klaxon.
4. Update the character description above so the row still describes the file.
