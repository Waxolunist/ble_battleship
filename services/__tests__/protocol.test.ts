import {
  MULTIPLAYER_HELLO_MAGIC,
  MULTIPLAYER_HELLO_TIMEOUT_MS,
  MULTIPLAYER_PROTOCOL_VERSION,
} from '@/constants/multiplayer';
import {
  buildHello,
  describePayload,
  encodeNdjson,
  Handshake,
  MessageEmitter,
  MessageQueue,
  NdjsonBuffer,
  parseMessage,
  validateHello,
  type MultiplayerMessage,
} from '@/services/protocol';

const FIRE: MultiplayerMessage = { type: 'FIRE', data: { x: 3, y: 4 } };

describe('parseMessage', () => {
  it('parses a well-formed message', () => {
    expect(parseMessage('{"type":"FIRE","data":{"x":3,"y":4}}')).toEqual(FIRE);
  });

  it('parses a message with no payload', () => {
    expect(parseMessage('{"type":"BYE"}')).toEqual({ type: 'BYE' });
  });

  it('omits data entirely rather than setting it undefined', () => {
    expect(Object.prototype.hasOwnProperty.call(parseMessage('{"type":"BYE"}')!, 'data')).toBe(
      false,
    );
  });

  it.each([
    ['malformed JSON', '{"type":'],
    ['an empty string', ''],
    ['a bare string literal', '"FIRE"'],
    ['a bare number', '42'],
    ['null', 'null'],
    ['an array', '[{"type":"FIRE"}]'],
  ])('rejects %s', (_label, raw) => {
    expect(parseMessage(raw)).toBeNull();
  });

  it('rejects an object with no type', () => {
    expect(parseMessage('{"data":{"x":1}}')).toBeNull();
  });

  it('accepts the heartbeat types', () => {
    expect(parseMessage('{"type":"PING"}')).toEqual({ type: 'PING' });
    expect(parseMessage('{"type":"PONG"}')).toEqual({ type: 'PONG' });
  });

  it('round-trips a heartbeat through the NDJSON framing', () => {
    expect(parseMessage(encodeNdjson({ type: 'PING' }).trim())).toEqual({ type: 'PING' });
  });

  it('rejects an unknown message type', () => {
    expect(parseMessage('{"type":"DROP_TABLE"}')).toBeNull();
  });

  it('rejects a non-string type', () => {
    expect(parseMessage('{"type":7}')).toBeNull();
  });

  it.each([
    ['a string', '{"type":"FIRE","data":"nope"}'],
    ['an array', '{"type":"FIRE","data":[1,2]}'],
    ['null', '{"type":"FIRE","data":null}'],
  ])('rejects a payload that is %s', (_label, raw) => {
    expect(parseMessage(raw)).toBeNull();
  });

  it('drops unknown top-level keys rather than passing them through', () => {
    const parsed = parseMessage('{"type":"BYE","evil":true}');
    expect(parsed).toEqual({ type: 'BYE' });
  });

  it('round-trips everything encodeNdjson produces', () => {
    expect(parseMessage(encodeNdjson(FIRE).trim())).toEqual(FIRE);
  });
});

describe('describePayload', () => {
  it('renders a payload as JSON', () => {
    expect(describePayload(FIRE)).toBe('{"x":3,"y":4}');
  });

  it('returns undefined when there is no payload', () => {
    expect(describePayload({ type: 'BYE' })).toBeUndefined();
  });
});

describe('encodeNdjson', () => {
  it('terminates the line with a newline', () => {
    expect(encodeNdjson({ type: 'BYE' })).toBe('{"type":"BYE"}\n');
  });

  it('produces exactly one line per message', () => {
    expect(encodeNdjson(FIRE).match(/\n/g)).toHaveLength(1);
  });
});

describe('NdjsonBuffer', () => {
  it('returns a complete line', () => {
    expect(new NdjsonBuffer().push('{"a":1}\n')).toEqual(['{"a":1}']);
  });

  it('returns nothing until the newline arrives', () => {
    const buf = new NdjsonBuffer();
    expect(buf.push('{"a":')).toEqual([]);
    expect(buf.push('1}\n')).toEqual(['{"a":1}']);
  });

  it('reassembles a message split across three reads', () => {
    const buf = new NdjsonBuffer();
    expect(buf.push('{"ty')).toEqual([]);
    expect(buf.push('pe":"B')).toEqual([]);
    expect(buf.push('YE"}\n')).toEqual(['{"type":"BYE"}']);
  });

  it('returns several messages delivered in one read', () => {
    expect(new NdjsonBuffer().push('{"a":1}\n{"b":2}\n{"c":3}\n')).toEqual([
      '{"a":1}',
      '{"b":2}',
      '{"c":3}',
    ]);
  });

  it('holds back a trailing partial line', () => {
    const buf = new NdjsonBuffer();
    expect(buf.push('{"a":1}\n{"b":')).toEqual(['{"a":1}']);
    expect(buf.pending).toBe('{"b":');
    expect(buf.push('2}\n')).toEqual(['{"b":2}']);
  });

  it('preserves ordering across reads', () => {
    const buf = new NdjsonBuffer();
    const seen = [...buf.push('a\nb\nc'), ...buf.push('d\ne\n')];
    expect(seen).toEqual(['a', 'b', 'cd', 'e']);
  });

  it('skips blank lines', () => {
    expect(new NdjsonBuffer().push('\n\n{"a":1}\n\n')).toEqual(['{"a":1}']);
  });

  it('trims surrounding whitespace, including a stray carriage return', () => {
    expect(new NdjsonBuffer().push('  {"a":1}  \r\n')).toEqual(['{"a":1}']);
  });

  it('starts empty and reports pending bytes', () => {
    const buf = new NdjsonBuffer();
    expect(buf.pending).toBe('');
    buf.push('partial');
    expect(buf.pending).toBe('partial');
  });

  it('drops buffered bytes on reset', () => {
    const buf = new NdjsonBuffer();
    buf.push('{"a":');
    buf.reset();
    expect(buf.pending).toBe('');
    expect(buf.push('1}\n')).toEqual(['1}']);
  });

  it('survives a burst of encoded messages arriving as one chunk', () => {
    const messages: MultiplayerMessage[] = [
      { type: 'FIRE', data: { x: 1, y: 1 } },
      { type: 'SHOT_RESULT', data: { x: 1, y: 1, result: 'hit' } },
      { type: 'BYE' },
    ];
    const chunk = messages.map(encodeNdjson).join('');
    expect(new NdjsonBuffer().push(chunk).map(parseMessage)).toEqual(messages);
  });
});

describe('buildHello / validateHello', () => {
  it('builds a HELLO carrying the magic, version and captain name', () => {
    expect(buildHello('NELSON')).toEqual({
      type: 'HELLO',
      data: {
        magic: MULTIPLAYER_HELLO_MAGIC,
        protocolVersion: MULTIPLAYER_PROTOCOL_VERSION,
        captainName: 'NELSON',
      },
    });
  });

  it('accepts a HELLO it built itself', () => {
    expect(validateHello(buildHello('NELSON'))).toEqual({ ok: true, peerName: 'NELSON' });
  });

  it('survives the encode/parse round trip', () => {
    const parsed = parseMessage(encodeNdjson(buildHello('NELSON')).trim())!;
    expect(validateHello(parsed)).toEqual({ ok: true, peerName: 'NELSON' });
  });

  it('rejects a HELLO with the wrong magic', () => {
    const hello = buildHello('NELSON');
    hello.data!.magic = 'SOMETHING-ELSE';
    expect(validateHello(hello)).toMatchObject({ ok: false, reason: 'magic' });
  });

  it('rejects a HELLO with no payload at all', () => {
    expect(validateHello({ type: 'HELLO' })).toMatchObject({ ok: false, reason: 'magic' });
  });

  it('rejects a version mismatch', () => {
    const hello = buildHello('NELSON');
    hello.data!.protocolVersion = '99';
    expect(validateHello(hello)).toMatchObject({ ok: false, reason: 'version' });
  });

  it('checks magic before version, so a stranger is not told our version', () => {
    expect(
      validateHello({ type: 'HELLO', data: { magic: 'X', protocolVersion: '99' } }),
    ).toMatchObject({ reason: 'magic' });
  });

  it('rejects a numeric version that would coerce to the right string', () => {
    const hello = buildHello('NELSON');
    hello.data!.protocolVersion = Number(MULTIPLAYER_PROTOCOL_VERSION);
    expect(validateHello(hello)).toMatchObject({ ok: false, reason: 'version' });
  });

  it('reports the offending value in the detail', () => {
    const hello = buildHello('NELSON');
    hello.data!.magic = 'NOPE';
    const result = validateHello(hello);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.detail).toContain('NOPE');
  });

  it.each([[undefined], [42], [null], [{}]])(
    'falls back to an empty peer name for captainName %p',
    captainName => {
      const hello = buildHello('NELSON');
      hello.data!.captainName = captainName;
      expect(validateHello(hello)).toEqual({ ok: true, peerName: '' });
    },
  );
});

describe('Handshake', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('starts idle', () => {
    expect(new Handshake().getState()).toBe('idle');
  });

  it('is awaiting once started', () => {
    const hs = new Handshake();
    hs.start().catch(() => {});
    expect(hs.getState()).toBe('awaiting');
    expect(hs.isComplete()).toBe(false);
  });

  it('resolves with the peer name on success', async () => {
    const hs = new Handshake();
    const promise = hs.start();
    hs.succeed('NELSON');
    await expect(promise).resolves.toBe('NELSON');
    expect(hs.isComplete()).toBe(true);
  });

  it('clears the timeout on success, so a later tick cannot fail it', async () => {
    const onFail = jest.fn();
    const hs = new Handshake({ onFail });
    const promise = hs.start();
    hs.succeed('NELSON');
    await promise;
    jest.advanceTimersByTime(MULTIPLAYER_HELLO_TIMEOUT_MS * 2);
    expect(onFail).not.toHaveBeenCalled();
    expect(hs.isComplete()).toBe(true);
  });

  it('rejects and tears down on failure', async () => {
    const onFail = jest.fn();
    const hs = new Handshake({ onFail });
    const promise = hs.start();
    hs.fail(new Error('bad magic'));
    await expect(promise).rejects.toThrow('bad magic');
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(hs.getState()).toBe('idle');
  });

  it('times out after the configured window', async () => {
    const onTimeout = jest.fn();
    const hs = new Handshake({ onTimeout });
    const promise = hs.start();
    jest.advanceTimersByTime(MULTIPLAYER_HELLO_TIMEOUT_MS);
    await expect(promise).rejects.toThrow('HELLO timeout');
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('does not time out early', () => {
    const onTimeout = jest.fn();
    const hs = new Handshake({ onTimeout });
    hs.start().catch(() => {});
    jest.advanceTimersByTime(MULTIPLAYER_HELLO_TIMEOUT_MS - 1);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('honours a custom timeout', async () => {
    const hs = new Handshake({ timeoutMs: 50 });
    const promise = hs.start();
    jest.advanceTimersByTime(50);
    await expect(promise).rejects.toThrow('HELLO timeout');
  });

  it('tears the link down on timeout', async () => {
    const onFail = jest.fn();
    const hs = new Handshake({ onFail });
    const promise = hs.start();
    jest.advanceTimersByTime(MULTIPLAYER_HELLO_TIMEOUT_MS);
    await expect(promise).rejects.toThrow();
    expect(onFail).toHaveBeenCalledTimes(1);
  });

  it('aborts without tearing the link down', async () => {
    const onFail = jest.fn();
    const hs = new Handshake({ onFail });
    const promise = hs.start();
    hs.abort('user left');
    await expect(promise).rejects.toThrow('handshake aborted: user left');
    expect(onFail).not.toHaveBeenCalled();
    expect(hs.getState()).toBe('idle');
  });

  it('ignores an abort when idle', () => {
    const hs = new Handshake();
    expect(() => hs.abort('nothing in flight')).not.toThrow();
    expect(hs.getState()).toBe('idle');
  });

  it('clears the timeout on abort', () => {
    const onTimeout = jest.fn();
    const hs = new Handshake({ onTimeout });
    hs.start().catch(() => {});
    hs.abort('user left');
    jest.advanceTimersByTime(MULTIPLAYER_HELLO_TIMEOUT_MS * 2);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('aborting a completed handshake resets it without rejecting', async () => {
    const hs = new Handshake();
    const promise = hs.start();
    hs.succeed('NELSON');
    await promise;
    hs.abort('reset');
    expect(hs.getState()).toBe('idle');
  });

  it('can be restarted after a failure', async () => {
    const hs = new Handshake();
    const first = hs.start();
    hs.fail(new Error('nope'));
    await expect(first).rejects.toThrow('nope');

    const second = hs.start();
    hs.succeed('NELSON');
    await expect(second).resolves.toBe('NELSON');
  });

  it("a restart drops the previous attempt's timer", async () => {
    const onTimeout = jest.fn();
    const hs = new Handshake({ onTimeout });
    hs.start().catch(() => {});
    const second = hs.start();
    jest.advanceTimersByTime(MULTIPLAYER_HELLO_TIMEOUT_MS);
    await expect(second).rejects.toThrow('HELLO timeout');
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('survives onFail calling back into abort, as both transports do', async () => {
    // fail() -> onFail -> disconnect() -> teardown -> abort(). The handshake is
    // already settled by then, so the re-entrant abort must not reject twice.
    const hs: Handshake = new Handshake({ onFail: () => hs.abort('teardown') });
    const promise = hs.start();
    const rejection = expect(promise).rejects.toThrow('bad magic');
    hs.fail(new Error('bad magic'));
    await rejection;
    expect(hs.getState()).toBe('idle');
  });

  it('a re-entrant abort during onFail does not mask the original error', async () => {
    const hs: Handshake = new Handshake({ onFail: () => hs.abort('teardown') });
    const promise = hs.start();
    hs.fail(new Error('Protocol version mismatch'));
    await expect(promise).rejects.toThrow('Protocol version mismatch');
  });

  it('a second succeed after settling is a no-op', async () => {
    const hs = new Handshake();
    const promise = hs.start();
    hs.succeed('NELSON');
    await expect(promise).resolves.toBe('NELSON');
    expect(() => hs.succeed('IMPOSTOR')).not.toThrow();
  });
});

describe('MessageQueue', () => {
  it('starts empty', () => {
    expect(new MessageQueue().size).toBe(0);
  });

  it('drains in send order', () => {
    const q = new MessageQueue();
    q.push({ type: 'FLEET_READY' });
    q.push(FIRE);
    q.push({ type: 'BYE' });
    expect(q.drain().map(m => m.type)).toEqual(['FLEET_READY', 'FIRE', 'BYE']);
  });

  it('is empty after draining', () => {
    const q = new MessageQueue();
    q.push(FIRE);
    q.drain();
    expect(q.size).toBe(0);
    expect(q.drain()).toEqual([]);
  });

  it('can be refilled after a drain', () => {
    const q = new MessageQueue();
    q.push(FIRE);
    q.drain();
    q.push({ type: 'BYE' });
    expect(q.drain().map(m => m.type)).toEqual(['BYE']);
  });

  it('discards everything on clear', () => {
    const q = new MessageQueue();
    q.push(FIRE);
    q.clear();
    expect(q.size).toBe(0);
    expect(q.drain()).toEqual([]);
  });
});

describe('MessageEmitter', () => {
  it('delivers to a subscriber', () => {
    const emitter = new MessageEmitter();
    const handler = jest.fn();
    emitter.subscribe(handler);
    emitter.emit(FIRE);
    expect(handler).toHaveBeenCalledWith(FIRE);
  });

  it('delivers to every subscriber', () => {
    const emitter = new MessageEmitter();
    const a = jest.fn();
    const b = jest.fn();
    emitter.subscribe(a);
    emitter.subscribe(b);
    emitter.emit(FIRE);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('stops delivering after unsubscribe', () => {
    const emitter = new MessageEmitter();
    const handler = jest.fn();
    const unsubscribe = emitter.subscribe(handler);
    unsubscribe();
    emitter.emit(FIRE);
    expect(handler).not.toHaveBeenCalled();
    expect(emitter.size).toBe(0);
  });

  it('unsubscribing one leaves the others subscribed', () => {
    const emitter = new MessageEmitter();
    const a = jest.fn();
    const b = jest.fn();
    emitter.subscribe(a)();
    emitter.subscribe(b);
    emitter.emit(FIRE);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('unsubscribing twice is harmless', () => {
    const emitter = new MessageEmitter();
    const unsubscribe = emitter.subscribe(jest.fn());
    unsubscribe();
    expect(() => unsubscribe()).not.toThrow();
  });

  it('drops every subscriber on clear', () => {
    const emitter = new MessageEmitter();
    emitter.subscribe(jest.fn());
    emitter.clear();
    expect(emitter.size).toBe(0);
  });

  it('emitting with no subscribers is harmless', () => {
    expect(() => new MessageEmitter().emit(FIRE)).not.toThrow();
  });
});
