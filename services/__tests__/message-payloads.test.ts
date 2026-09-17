import { GRID_SIZE } from '@/models/types';
import {
  isCoord,
  isOutcome,
  isShipType,
  isShotResult,
  parseFire,
  parseFleetReady,
  parseGameOverOutcome,
  parseShotResult,
} from '@/services/message-payloads';
import type { FleetPlacement } from '@/store/useMultiplayerStore';

const FULL_FLEET: FleetPlacement[] = [
  { shipType: 'Carrier', x: 0, y: 0, orientation: 'horizontal' },
  { shipType: 'Battleship', x: 0, y: 2, orientation: 'horizontal' },
  { shipType: 'Cruiser', x: 0, y: 4, orientation: 'horizontal' },
  { shipType: 'Submarine', x: 0, y: 6, orientation: 'vertical' },
  { shipType: 'Destroyer', x: 5, y: 8, orientation: 'horizontal' },
];

describe('isCoord', () => {
  it.each([0, 5, GRID_SIZE - 1])('accepts %p', value => {
    expect(isCoord(value)).toBe(true);
  });

  it.each([-1, GRID_SIZE, 1.5, NaN, Infinity, '3', null, undefined, true, [3]])(
    'rejects %p',
    value => {
      expect(isCoord(value)).toBe(false);
    },
  );
});

describe('isShotResult / isOutcome / isShipType', () => {
  it.each(['hit', 'miss', 'sunk'])('accepts the shot result %s', value => {
    expect(isShotResult(value)).toBe(true);
  });

  it.each(['HIT', '', 'destroyed', null, 1])('rejects the shot result %p', value => {
    expect(isShotResult(value)).toBe(false);
  });

  it.each(['victory', 'defeat'])('accepts the outcome %s', value => {
    expect(isOutcome(value)).toBe(true);
  });

  it.each(['draw', 'VICTORY', null])('rejects the outcome %p', value => {
    expect(isOutcome(value)).toBe(false);
  });

  it.each(['Carrier', 'Battleship', 'Cruiser', 'Submarine', 'Destroyer'])(
    'accepts the ship type %s',
    value => {
      expect(isShipType(value)).toBe(true);
    },
  );

  it.each(['carrier', 'Dreadnought', '', null, 1])('rejects the ship type %p', value => {
    expect(isShipType(value)).toBe(false);
  });
});

describe('parseFleetReady', () => {
  it('accepts a complete fleet', () => {
    expect(parseFleetReady({ fleet: FULL_FLEET })).toEqual(FULL_FLEET);
  });

  it('accepts a fleet in any order', () => {
    const shuffled = [...FULL_FLEET].reverse();
    expect(parseFleetReady({ fleet: shuffled })).toEqual(shuffled);
  });

  it('strips unknown keys from each entry', () => {
    const fleet = FULL_FLEET.map(p => ({ ...p, sunk: true, hp: 99 }));
    expect(parseFleetReady({ fleet })).toEqual(FULL_FLEET);
  });

  it.each([
    ['a missing payload', undefined],
    ['no fleet key', {}],
    ['a fleet that is not an array', { fleet: 'Carrier' }],
    ['a fleet that is an object', { fleet: { shipType: 'Carrier' } }],
    ['an empty fleet', { fleet: [] }],
    ['a null entry', { fleet: [null] }],
  ])('rejects %s', (_label, data) => {
    expect(parseFleetReady(data as Record<string, unknown> | undefined)).toBeNull();
  });

  it('rejects a fleet missing a ship', () => {
    expect(parseFleetReady({ fleet: FULL_FLEET.slice(0, 4) })).toBeNull();
  });

  it('rejects a fleet with a repeated ship type', () => {
    const fleet = [...FULL_FLEET.slice(1), { ...FULL_FLEET[4], y: 9 }];
    expect(parseFleetReady({ fleet })).toBeNull();
  });

  it('rejects an unknown ship type', () => {
    const fleet = [{ ...FULL_FLEET[0], shipType: 'Dreadnought' }, ...FULL_FLEET.slice(1)];
    expect(parseFleetReady({ fleet })).toBeNull();
  });

  it('rejects an out-of-range coordinate', () => {
    const fleet = [{ ...FULL_FLEET[0], x: GRID_SIZE }, ...FULL_FLEET.slice(1)];
    expect(parseFleetReady({ fleet })).toBeNull();
  });

  it('rejects a negative coordinate', () => {
    const fleet = [{ ...FULL_FLEET[0], y: -1 }, ...FULL_FLEET.slice(1)];
    expect(parseFleetReady({ fleet })).toBeNull();
  });

  it('rejects a fractional coordinate', () => {
    const fleet = [{ ...FULL_FLEET[0], x: 1.5 }, ...FULL_FLEET.slice(1)];
    expect(parseFleetReady({ fleet })).toBeNull();
  });

  it('rejects a bad orientation', () => {
    const fleet = [{ ...FULL_FLEET[0], orientation: 'diagonal' }, ...FULL_FLEET.slice(1)];
    expect(parseFleetReady({ fleet })).toBeNull();
  });

  it('rejects a coordinate sent as a string', () => {
    const fleet = [{ ...FULL_FLEET[0], x: '0' }, ...FULL_FLEET.slice(1)];
    expect(parseFleetReady({ fleet })).toBeNull();
  });
});

describe('parseFire', () => {
  it('accepts a legal square', () => {
    expect(parseFire({ x: 3, y: 4 })).toEqual({ x: 3, y: 4 });
  });

  it('accepts the corners', () => {
    expect(parseFire({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(parseFire({ x: GRID_SIZE - 1, y: GRID_SIZE - 1 })).toEqual({
      x: GRID_SIZE - 1,
      y: GRID_SIZE - 1,
    });
  });

  it('drops extra keys', () => {
    expect(parseFire({ x: 1, y: 2, force: 9000 })).toEqual({ x: 1, y: 2 });
  });

  it.each([
    ['a missing payload', undefined],
    ['an empty payload', {}],
    ['a missing y', { x: 1 }],
    ['an off-grid x', { x: GRID_SIZE, y: 0 }],
    ['a negative y', { x: 0, y: -1 }],
    ['string coordinates', { x: '1', y: '2' }],
    ['a fractional coordinate', { x: 1.5, y: 2 }],
  ])('rejects %s', (_label, data) => {
    expect(parseFire(data as Record<string, unknown> | undefined)).toBeNull();
  });
});

describe('parseShotResult', () => {
  it('accepts a verdict without a ship type', () => {
    expect(parseShotResult({ x: 1, y: 2, result: 'hit' })).toEqual({ x: 1, y: 2, result: 'hit' });
  });

  it('accepts a sunk verdict carrying the ship type', () => {
    expect(parseShotResult({ x: 1, y: 2, result: 'sunk', shipType: 'Cruiser' })).toEqual({
      x: 1,
      y: 2,
      result: 'sunk',
      shipType: 'Cruiser',
    });
  });

  it('drops an unrecognised ship type but keeps the verdict', () => {
    expect(parseShotResult({ x: 1, y: 2, result: 'sunk', shipType: 'Dreadnought' })).toEqual({
      x: 1,
      y: 2,
      result: 'sunk',
    });
  });

  it('omits shipType entirely when absent', () => {
    const parsed = parseShotResult({ x: 1, y: 2, result: 'miss' })!;
    expect(Object.prototype.hasOwnProperty.call(parsed, 'shipType')).toBe(false);
  });

  it.each([
    ['a missing payload', undefined],
    ['a missing result', { x: 1, y: 2 }],
    ['an unknown result', { x: 1, y: 2, result: 'obliterated' }],
    ['an off-grid square', { x: GRID_SIZE, y: 2, result: 'hit' }],
    ['a null result', { x: 1, y: 2, result: null }],
  ])('rejects %s', (_label, data) => {
    expect(parseShotResult(data as Record<string, unknown> | undefined)).toBeNull();
  });
});

describe('parseGameOverOutcome', () => {
  it("reads the sender's victory", () => {
    expect(parseGameOverOutcome({ outcome: 'victory' })).toBe('victory');
  });

  it("reads the sender's defeat, as sent on a retreat", () => {
    expect(parseGameOverOutcome({ outcome: 'defeat' })).toBe('defeat');
  });

  it.each([
    ['a missing payload', undefined],
    ['an empty payload', {}],
    ['an unknown outcome', { outcome: 'draw' }],
    ['a null outcome', { outcome: null }],
  ])('treats %s as the sender having won, matching older builds', (_label, data) => {
    expect(parseGameOverOutcome(data as Record<string, unknown> | undefined)).toBe('victory');
  });
});
