# BLE game loop wiring

## Problem

The BLE handshake works (HELLO exchange validates the peer) and the LOBBY screen displays the connected captain. But once the user presses **TO BATTLE STATION** and goes through placement → "Fire at Will" → battle, **the opponent is still the AI**, not the connected BLE peer. There is no wire between the BLE session and the battle screen — multiplayer mode is dead code.

This story tracks the work to actually connect them, and replaces the original ad-hoc `mode === 'ble'` branching with a single strategy interface so future opponent types (networked AI, replay, difficulty levels) plug in without re-touching the combat loop.

## Diagnosis — four real gaps

Each gap is verified against the current code. Closing them in isolation, as the first draft of this story proposed, scatters `mode === 'ble'` branches across the combat hook, the game store, the battle view, and the battle screen. The redesign below collapses all four into one composition point.

### 1. `useBLEGame` is never mounted

[hooks/useBLEGame.ts](../../hooks/useBLEGame.ts) is the bridge between BLE messages (FLEET_READY, FIRE, SHOT_RESULT, GAME_OVER, REMATCH, BYE) and the game store. `grep -rn "useBLEGame()"` returns zero call sites — it is defined and never invoked. Its `bleService.onMessage` subscription never runs, so no incoming BLE message reaches the game.

### 2. `bleState` never advances LOBBY → PLACEMENT

[hooks/useBLEGame.ts:99](../../hooks/useBLEGame.ts#L99) guards the "both fleets ready → start battle" effect on `bleState === 'PLACEMENT'`. Nothing in the battle-screen path pushes the state out of `LOBBY`, so even with `useBLEGame` mounted the gate never opens.

### 3. `useCombat` is AI-only

[hooks/useCombat.ts](../../hooks/useCombat.ts) does two things that are wrong for BLE:

- `onPlayerFire` (lines 20–73) resolves the shot **locally** at the 900 ms verdict beat (`resolveShot('opponent', x, y)`). In BLE mode the player must instead send `FIRE` and apply the peer's `SHOT_RESULT`.
- The `useEffect(turn === 'enemy')` block (lines 75–124) runs `pickAiTarget` and auto-fires. In BLE mode the peer's `FIRE` message drives the enemy turn; the AI must not run.

[hooks/useBLEGame.ts:109-166](../../hooks/useBLEGame.ts#L109-L166) already contains a parallel `handlePlayerFire` / `handleRemoteFire` pair that duplicates the combat lifecycle for BLE. The duplication is the symptom; the cause is that `useCombat` has no way to delegate.

### 4. `startBLEGame` seeds a random AI fleet

[store/useGameStore.ts:149-159](../../store/useGameStore.ts#L149-L159) initializes `opponentFields` from `createGameField(AI_PLAYER).fields` — a random local fleet. In BLE the opponent's fleet must come from the peer's `FLEET_READY` payload (already captured into [useBLEStore.opponentFleet](../../store/useBLEStore.ts) by `handleRemoteFleetReady`).

## The shape of the fix: an Opponent strategy

All four gaps share one missing concept — **the thing the player is fighting**. AI and BLE-peer are two implementations of the same role. Expose that role as an interface and the combat loop, the battle view, and the game store stop caring which one is plugged in.

### The interface

```ts
// models/opponent.ts
export interface Opponent {
  /**
   * Called from the player-fire animation at the verdict beat (900 ms).
   * AI: resolves locally from opponentFields and returns synchronously.
   * BLE: sends FIRE, awaits SHOT_RESULT, resolves the promise on arrival.
   */
  resolvePlayerShot(x: number, y: number): Promise<ShotResult>;

  /**
   * Subscribe to enemy-initiated shots. Returns an unsubscribe.
   * AI: handler fires when turn === 'enemy' with pickAiTarget().
   * BLE: handler fires when a FIRE message arrives from the peer.
   */
  onEnemyShot(handler: (x: number, y: number) => void): () => void;

  /**
   * Called from the enemy-fire animation at the verdict beat so BLE can
   * ship a SHOT_RESULT back to the peer. AI: no-op.
   */
  reportEnemyShotResolution(x: number, y: number, result: ShotResult): void;

  /**
   * Prepare the opponent for battle. Returns the opponent's grid and
   * who fires first.
   * AI: randomizes a fleet immediately, player goes first.
   * BLE: sends FLEET_READY, awaits peer's FLEET_READY, host goes first.
   */
  prepareBattle(localFleet: FleetPlacement[]): Promise<{
    opponentFields: GameField;
    firstTurn: Turn;
  }>;

  /** Notify the opponent that the local game ended (BLE sends GAME_OVER). */
  notifyGameOver(outcome: 'victory' | 'defeat'): void;

  /** Subscribe to remote-initiated game over (BLE GAME_OVER from peer). */
  onGameOver(handler: (outcome: 'victory' | 'defeat') => void): () => void;
}
```

### Two implementations, both hooks

- `useAIOpponent()` — wraps `pickAiTarget`, `applyFire`, `createGameField(AI_PLAYER)`. Synchronous; no subscriptions.
- `useBLEOpponent()` — what `useBLEGame` becomes. Owns the `bleService.onMessage` subscription, the pending-shot promise, the FLEET_READY rendezvous, and the GAME_OVER/REMATCH/BYE lifecycle.

### One composition point

```tsx
// app/battle.tsx
export default function BattleScreen() {
  const mode = useBLEStore(s => s.mode);
  return mode === 'ble'
    ? <BattleScreenBody opponent={useBLEOpponent()} />
    : <BattleScreenBody opponent={useAIOpponent()} />;
}
```

This is the **only** `mode === 'ble'` check in the runtime path. The conditional branch is necessary because the two opponent hooks have different subscription footprints and we don't want the BLE one mounted in single-player; using two sibling components keeps rules-of-hooks happy while keeping the mode decision in one place.

Downstream:

- `useCombat(opponent)` calls `opponent.resolvePlayerShot(x, y)` at the verdict beat instead of `resolveShot('opponent', x, y)`, and replaces the AI enemy-turn `useEffect` with an `opponent.onEnemyShot(...)` subscription that drives the same animation pipeline.
- `useGameStore.startBattle({ opponentFields, firstTurn })` takes both as arguments. `startBLEGame` deletes.
- `BattleView` is unchanged — `onEnemyCellPress` still flows into the combat hook, which now does the right thing for both modes.

### How each diagnosed gap collapses

| Gap | Without the abstraction | With the abstraction |
|---|---|---|
| 1. `useBLEGame` unmounted | Manually mount it from the battle screen. | `useBLEOpponent()` is mounted by the screen factory. |
| 2. LOBBY → PLACEMENT never fires | Add a mount effect on the battle screen. | Lives inside `useBLEOpponent.prepareBattle()`; the screen `await`s. |
| 3. `useCombat` AI-only | Branch on `mode` inside `useCombat`. | `useCombat` takes `opponent`; zero mode awareness. |
| 4. Random AI fleet in `startBLEGame` | Add a BLE branch to `startBLEGame` or pre-populate from the store. | `startBattle` accepts `opponentFields`; the opponent supplies it. |

### Things the abstraction does NOT try to hide

A few BLE-specific concerns are legitimate and don't belong on the interface:

- **"Waiting for peer to finish placement" overlay** — meaningful only in multiplayer. Either let `Opponent` optionally expose a `useWaitingOverlay()` (AI returns `null`), or render it from a small `<BLEOnly>` wrapper at the screen level. Don't pretend AI has a placement gate.
- **Disconnect / BYE / out-of-range alerts** — BLE-only. Belong in a `<BLEConnectionGuard>` mounted above the battle screen, not inside the combat loop.

If those two stay in their own files, the battle screen itself stays at exactly one mode check.

## Acceptance criteria

End-to-end happy path on two phones:

1. Phone A: HOST → advertises → HELLO accepted → LOBBY shows Phone B's captain.
2. Phone B: JOIN → finds A → tap → HELLO accepted → LOBBY shows A's captain.
3. Either phone: TO BATTLE STATION → placement screen on both.
4. Both place fleets → Fire at Will on both → FLEET_READY exchanged → battle starts simultaneously on both phones.
5. Host fires first (`turn === 'player'`); joiner sees the shot resolve on its grid; the peer's grid shows a hit/miss/sunk verdict matching what the firer's screen showed.
6. Turns alternate. The AI never fires in BLE mode.
7. When one fleet is sunk, GAME_OVER propagates and both screens show victory/defeat correctly.
8. REMATCH from either side, when matched by the peer, returns both to PLACEMENT.
9. BYE / out-of-range → both return to IDLE with the existing connection-lost alert.

And the architectural acceptance criterion:

10. `grep -rn "mode === 'ble'" app/ hooks/ components/ store/` returns at most **one** match outside of the BLE store itself and the BLE-only overlay/guard components.

## Implementation tasks

Tackle in order — each step leaves the AI path green so regressions are caught immediately.

### Phase 1 — Introduce the abstraction (AI-only, no behaviour change)

- [ ] **Define the interface.** Create `models/opponent.ts` with the `Opponent` type plus shared `ShotResult` / `Turn` aliases.
- [ ] **Implement `useAIOpponent`.** Create `hooks/useAIOpponent.ts`. Wraps `pickAiTarget`, `applyFire`, and `createGameField(AI_PLAYER)`. Synchronous `resolvePlayerShot`. `onEnemyShot` subscription is driven by a turn-watcher effect that calls the handler once per `turn === 'enemy'`.
- [ ] **Refactor `startBattle`.** Change `useGameStore.startBattle` to accept `{ opponentFields, firstTurn }`. Delete `startBLEGame`. Update all current callers (single-player path) to pass the AI-generated values.
- [ ] **Refactor `useCombat`.** Accept `opponent: Opponent`. Replace `resolveShot('opponent', x, y)` at the verdict beat with `await opponent.resolvePlayerShot(x, y)` and apply the returned result via `resolveShot`. Replace the enemy-turn `useEffect` with `opponent.onEnemyShot(handler)` subscribing on mount; the handler runs the existing enemy-fire animation, then calls `opponent.reportEnemyShotResolution`.
- [ ] **Wire the screen factory.** Split `app/battle.tsx` into `BattleScreen` (chooses opponent) and `BattleScreenBody` (the existing JSX, now taking `opponent` as a prop and threading it into `useCombat`).
- [ ] **Verify AI mode unchanged.** `npm run lint && npm run format`. Play a full AI game end-to-end. Tour, retreat, victory, defeat must all still work.

### Phase 2 — Implement the BLE opponent

- [ ] **Create `hooks/useBLEOpponent.ts`.** This is `useBLEGame` recast against the `Opponent` interface. Inside:
  - `resolvePlayerShot(x, y)` — store a pending `{ resolve, reject }`; send `FIRE`; resolve when matching `SHOT_RESULT` arrives. Reject on disconnect.
  - `onEnemyShot(handler)` — store the handler; invoke it from the `FIRE` message branch.
  - `reportEnemyShotResolution(x, y, result)` — send `SHOT_RESULT`. Apply `setSunkEvent` when `result === 'sunk'`.
  - `prepareBattle(localFleet)` — send `FLEET_READY`; `await` peer's `FLEET_READY`; build `opponentFields` from the payload; return `{ opponentFields, firstTurn: bleService.getRole() === 'host' ? 'player' : 'enemy' }`. Sets `bleState` to `PLACEMENT` on entry and `BATTLE` on success.
  - `notifyGameOver` / `onGameOver` — wrap the existing `GAME_OVER` send/receive paths.
- [ ] **Build the opponent's grid.** Add a helper (in `engine/placement.ts` or `models/game-factory.ts`) that converts a `FleetPlacement[]` payload into a populated `GameField`. Reuse for AI mode if it simplifies `createGameField`.
- [ ] **Delete `useBLEGame`.** Migrate any lingering responsibilities (REMATCH, BYE) into either `useBLEOpponent` or the new `<BLEConnectionGuard>` (see Phase 3).
- [ ] **Mount the BLE opponent in the screen factory.** `app/battle.tsx`: when `mode === 'ble'`, render `<BattleScreenBody opponent={useBLEOpponent()} />`.

### Phase 3 — BLE-only UI

- [ ] **Placement-gate overlay.** Add either an `Opponent.useWaitingOverlay()` member (AI returns `null`) or a `<BLEOnly>` wrapper that renders "Waiting for opponent to finish placement" when `localFleetReady && !remoteFleetReady`.
- [ ] **`<BLEConnectionGuard>`.** A component that wraps `BattleScreen`, listens for disconnect / BYE, shows the existing connection-lost alert, and routes back to `/`. Owns the REMATCH UI as well, since rematch only exists in BLE.
- [ ] **Confirm the rule.** `grep -rn "mode === 'ble'" app/ hooks/ components/ store/` should return ≤ 1 match (the screen factory) plus matches inside BLE-only modules.

### Phase 4 — End-to-end verification on two devices

- [ ] Walk through acceptance criteria 1–9 on a HOST + JOIN device pair.
- [ ] Confirm the BLE debug overlay shows the expected message sequence: HELLO ↔ HELLO → FLEET_READY ↔ FLEET_READY → FIRE/SHOT_RESULT pairs → GAME_OVER.
- [ ] Force-kill the joiner mid-game and confirm the host's `<BLEConnectionGuard>` fires the connection-lost flow.
- [ ] Run a single-player game on each device to confirm Phase 1 did not regress AI mode.

## Files likely to change

- New: `models/opponent.ts`, `hooks/useAIOpponent.ts`, `hooks/useBLEOpponent.ts`, `components/ble/BLEConnectionGuard.tsx` (or equivalent), and a fleet-placement-to-`GameField` helper.
- [hooks/useCombat.ts](../../hooks/useCombat.ts) — takes `opponent`; no mode awareness.
- [app/battle.tsx](../../app/battle.tsx) — split into screen factory and body; single mode check.
- [store/useGameStore.ts](../../store/useGameStore.ts) — `startBattle({ opponentFields, firstTurn })`; delete `startBLEGame`.
- [hooks/useBLEGame.ts](../../hooks/useBLEGame.ts) — deleted.
- [components/views/battle-view.tsx](../../components/views/battle-view.tsx) — unchanged (the abstraction makes this true; verify and resist the urge to branch here).

## Out of scope (do later)

- Rematch token / re-pairing UX after a disconnect mid-game.
- Disagreement reconciliation: what if SHOT_RESULT says "hit" but the local fleet doesn't agree? (Trust the peer for now; revisit if cheating becomes a concern.)
- Showing the peer's full fleet on game-over for a "fleet reveal" beat — would need the peer to retransmit on GAME_OVER, or for `useBLEOpponent` to retain the placement it already received.
- A networked-AI opponent (a third `Opponent` implementation). The abstraction is designed to make this trivial; building it is not in this story.

## Background

- The radio layer ([services/ble.ts](../../services/ble.ts)) is solid and gated by HELLO — see the BLE handshake hardening landed earlier on this branch.
- The debug overlay ([components/ble/BLEDebugPanel.tsx](../../components/ble/BLEDebugPanel.tsx)) logs every TX/RX with payload; use it on both devices during Phase 4.
- The wire protocol is documented in [BLE_INTEGRATION.md](../../BLE_INTEGRATION.md) — still accurate at the message level, just unimplemented in the UI hooks until this story lands.
