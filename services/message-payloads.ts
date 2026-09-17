import { isCompleteFleet } from '@/engine/fleet-conversion';
import type { GameOutcome, ShotResult } from '@/models/opponent';
import { GRID_SIZE, SHIP_FLEET, type ShipType } from '@/models/types';
import type { FleetPlacement } from '@/store/useMultiplayerStore';

/**
 * Validation for the game payloads carried inside a MultiplayerMessage.
 *
 * protocol.ts guarantees a message is well formed and of a known type; these
 * parsers decide whether its `data` is something we can act on. Everything a
 * peer sends is untrusted: a malformed payload must be dropped, never applied
 * to the grid, so each parser returns null rather than throwing or coercing.
 */

const SHIP_TYPES = new Set<string>(SHIP_FLEET);

export function isCoord(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < GRID_SIZE;
}

export function isShotResult(value: unknown): value is ShotResult {
  return value === 'hit' || value === 'miss' || value === 'sunk';
}

export function isOutcome(value: unknown): value is GameOutcome {
  return value === 'victory' || value === 'defeat';
}

export function isShipType(value: unknown): value is ShipType {
  return typeof value === 'string' && SHIP_TYPES.has(value);
}

/**
 * FLEET_READY. Every entry must be a legal placement, and the fleet as a whole
 * must hold each ship exactly once — the grid we build from this payload is
 * our mirror of the peer's board and the source of truth for shot verdicts.
 */
export function parseFleetReady(
  data: Record<string, unknown> | undefined,
): FleetPlacement[] | null {
  const value = data?.fleet;
  if (!Array.isArray(value)) return null;

  const fleet: FleetPlacement[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') return null;
    const e = entry as Record<string, unknown>;
    if (!isShipType(e.shipType)) return null;
    if (!isCoord(e.x) || !isCoord(e.y)) return null;
    if (e.orientation !== 'horizontal' && e.orientation !== 'vertical') return null;
    fleet.push({ shipType: e.shipType, x: e.x, y: e.y, orientation: e.orientation });
  }

  return isCompleteFleet(fleet) ? fleet : null;
}

/** FIRE — the square the peer is shooting at. */
export function parseFire(
  data: Record<string, unknown> | undefined,
): { x: number; y: number } | null {
  const { x, y } = data ?? {};
  return isCoord(x) && isCoord(y) ? { x, y } : null;
}

/** SHOT_RESULT — the peer's verdict on our last shot. */
export function parseShotResult(
  data: Record<string, unknown> | undefined,
): { x: number; y: number; result: ShotResult; shipType?: ShipType } | null {
  const { x, y, result, shipType } = data ?? {};
  if (!isCoord(x) || !isCoord(y) || !isShotResult(result)) return null;
  return { x, y, result, ...(isShipType(shipType) ? { shipType } : {}) };
}

/**
 * GAME_OVER — the outcome as the *sender* experienced it. Older builds sent no
 * payload and only announced a victory, so an absent or unreadable outcome is
 * read as the sender having won.
 */
export function parseGameOverOutcome(data: Record<string, unknown> | undefined): GameOutcome {
  return isOutcome(data?.outcome) ? data.outcome : 'victory';
}
