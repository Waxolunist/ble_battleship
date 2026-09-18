import { Heartbeat } from '@/services/protocol';

describe('Heartbeat', () => {
  let now = 0;
  const clock = () => now;

  const build = (overrides: Partial<Parameters<typeof makeOpts>[0]> = {}) => {
    const sendPing = jest.fn();
    const onTimeout = jest.fn();
    const hb = new Heartbeat({ ...makeOpts({ sendPing, onTimeout }), ...overrides });
    return { hb, sendPing, onTimeout };
  };

  const makeOpts = (o: { sendPing: () => void; onTimeout: (ms: number) => void }) => ({
    intervalMs: 1000,
    timeoutMs: 3000,
    checkMs: 500,
    now: clock,
    ...o,
  });

  beforeEach(() => {
    jest.useFakeTimers();
    now = 0;
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  /** Advance both the fake timers and the injected clock together. */
  const advance = (ms: number) => {
    const step = 100;
    for (let elapsed = 0; elapsed < ms; elapsed += step) {
      now += step;
      jest.advanceTimersByTime(step);
    }
  };

  it('pings on the interval once started', () => {
    const { hb, sendPing } = build();
    hb.start();
    advance(3000);
    // Three intervals in 3s; the watchdog fires at the same moment, so allow it
    // to have stopped the timer on the last tick.
    expect(sendPing.mock.calls.length).toBeGreaterThanOrEqual(2);
    hb.stop();
  });

  it('does not fire while the peer keeps talking', () => {
    const { hb, onTimeout } = build();
    hb.start();
    for (let i = 0; i < 10; i++) {
      advance(1000);
      hb.noteInbound();
    }
    expect(onTimeout).not.toHaveBeenCalled();
    hb.stop();
  });

  it('fires once the peer goes silent past the timeout', () => {
    const { hb, onTimeout } = build();
    hb.start();
    advance(3500);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(onTimeout.mock.calls[0][0]).toBeGreaterThanOrEqual(3000);
  });

  it('only fires once — the watchdog stops before tearing down', () => {
    const { hb, onTimeout } = build();
    hb.start();
    advance(10000);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('stops pinging after stop()', () => {
    const { hb, sendPing } = build();
    hb.start();
    advance(1000);
    const before = sendPing.mock.calls.length;
    hb.stop();
    advance(5000);
    expect(sendPing.mock.calls.length).toBe(before);
  });

  it('measures silence by the clock, not by missed ticks', () => {
    // A blocked JS thread: timers all land at once, but no real time passed.
    const { hb, onTimeout } = build();
    hb.start();
    jest.advanceTimersByTime(10000); // timers fire, `now` stays put
    expect(onTimeout).not.toHaveBeenCalled();
    hb.stop();
  });

  it('restarting resets the silence window', () => {
    const { hb, onTimeout } = build();
    hb.start();
    advance(2500);
    hb.start();
    advance(2500);
    expect(onTimeout).not.toHaveBeenCalled();
    hb.stop();
  });

  it('reports not running before start and after stop', () => {
    const { hb } = build();
    expect(hb.isRunning()).toBe(false);
    hb.start();
    expect(hb.isRunning()).toBe(true);
    hb.stop();
    expect(hb.isRunning()).toBe(false);
  });
});
