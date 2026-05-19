import type { FleetPlacement } from '@/store/useMultiplayerStore';
import type { Field } from './types';

export type ShotResult = 'hit' | 'miss' | 'sunk';
export type Turn = 'player' | 'enemy';
export type GameOutcome = 'victory' | 'defeat';

export interface PreparedBattle {
  opponentFields: Field[][];
  firstTurn: Turn;
}

export interface Opponent {
  /**
   * Resolve a shot the local player fired at (x, y). Invoked at the verdict
   * beat (900 ms) of the player-fire animation. AI resolves locally and
   * returns synchronously-as-a-promise; BLE sends FIRE and resolves when the
   * peer's SHOT_RESULT arrives.
   */
  resolvePlayerShot(x: number, y: number): Promise<ShotResult>;

  /**
   * Subscribe to enemy-initiated shots. Returns an unsubscribe.
   * AI: handler fires when turn flips to 'enemy' (with pickAiTarget).
   * BLE: handler fires when a FIRE message arrives from the peer.
   */
  onEnemyShot(handler: (x: number, y: number) => void): () => void;

  /**
   * Called from the enemy-fire animation at the verdict beat so BLE can ship
   * a SHOT_RESULT back to the peer. AI: no-op.
   */
  reportEnemyShotResolution(x: number, y: number, result: ShotResult): void;

  /**
   * Prepare the opponent for battle. AI: randomizes a fleet and returns
   * immediately (player goes first). BLE: sends FLEET_READY, awaits peer's
   * FLEET_READY, returns (host goes first).
   */
  prepareBattle(localFleet: FleetPlacement[]): Promise<PreparedBattle>;

  /** Notify the opponent that the local game ended. BLE sends GAME_OVER. */
  notifyGameOver(outcome: GameOutcome): void;

  /** Subscribe to remote-initiated game over (BLE GAME_OVER from peer). */
  onGameOver(handler: (outcome: GameOutcome) => void): () => void;
}
