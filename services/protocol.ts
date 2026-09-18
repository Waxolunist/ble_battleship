import {
  MULTIPLAYER_HELLO_MAGIC,
  MULTIPLAYER_HELLO_TIMEOUT_MS,
  MULTIPLAYER_PROTOCOL_VERSION,
} from '@/constants/multiplayer';

/**
 * Transport-agnostic game protocol.
 *
 * Both transports (LAN/TCP and NFC+WebRTC) speak the same message format and
 * run the same HELLO handshake, so the framing, handshake state machine, send
 * queue and handler registry live here rather than being reimplemented per
 * transport. Nothing in this module touches a socket, a native module or the
 * network — it is pure enough to unit test directly.
 */

// ─── Message format ───────────────────────────────────────────────────────

export type MultiplayerMessageType =
  | 'HELLO'
  | 'FLEET_READY'
  | 'FIRE'
  | 'SHOT_RESULT'
  | 'GAME_OVER'
  | 'REMATCH'
  | 'BYE'
  | 'PING'
  | 'PONG';

export interface MultiplayerMessage {
  type: MultiplayerMessageType;
  data?: Record<string, unknown>;
}

export type MultiplayerRole = 'host' | 'joiner';

export type MultiplayerEventHandler = (message: MultiplayerMessage) => void;

const MESSAGE_TYPES = new Set<string>([
  'HELLO',
  'FLEET_READY',
  'FIRE',
  'SHOT_RESULT',
  'GAME_OVER',
  'REMATCH',
  'BYE',
  'PING',
  'PONG',
]);

/**
 * Parse one wire line. Returns null for anything that is not a recognised
 * message — malformed JSON, a bare literal, or an unknown type — so a peer
 * cannot push an arbitrary object into the message handlers.
 */
export function parseMessage(raw: string): MultiplayerMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

  const candidate = parsed as Record<string, unknown>;
  if (typeof candidate.type !== 'string' || !MESSAGE_TYPES.has(candidate.type)) return null;

  const data = candidate.data;
  if (data !== undefined && (typeof data !== 'object' || data === null || Array.isArray(data))) {
    return null;
  }

  return {
    type: candidate.type as MultiplayerMessageType,
    ...(data === undefined ? {} : { data: data as Record<string, unknown> }),
  };
}

/**
 * Heartbeat frames are transport bookkeeping, not game traffic. At one ping a
 * second each way they would bury everything else in the debug trace, so they
 * are kept out of it — only a timeout is worth a line.
 */
export function isHeartbeatMessage(message: MultiplayerMessage): boolean {
  return message.type === 'PING' || message.type === 'PONG';
}

/** Short, log-safe rendering of a message's payload. */
export function describePayload(message: MultiplayerMessage): string | undefined {
  return message.data ? JSON.stringify(message.data) : undefined;
}

// ─── NDJSON framing (stream transports) ───────────────────────────────────

/** Encode a message as one newline-delimited JSON line. */
export function encodeNdjson(message: MultiplayerMessage): string {
  return JSON.stringify(message) + '\n';
}

/**
 * Reassembles newline-delimited JSON from a byte stream. TCP gives no message
 * boundaries: one read may carry half a message, three messages, or a message
 * plus the start of the next, so a partial trailing line is held back until
 * the rest of it arrives.
 */
export class NdjsonBuffer {
  private buffer = '';

  /** Feed a chunk; returns the complete lines it completed, in order. */
  push(chunk: string): string[] {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';
    return lines.map(line => line.trim()).filter(line => line.length > 0);
  }

  /** Bytes buffered so far awaiting their terminating newline. */
  get pending(): string {
    return this.buffer;
  }

  reset(): void {
    this.buffer = '';
  }
}

// ─── HELLO handshake ──────────────────────────────────────────────────────

/**
 * Build the HELLO both sides exchange once the transport link is up. Until it
 * is validated, any process that reaches the TCP port or the data channel is
 * indistinguishable from a real peer.
 */
export function buildHello(captainName: string): MultiplayerMessage {
  return {
    type: 'HELLO',
    data: {
      magic: MULTIPLAYER_HELLO_MAGIC,
      protocolVersion: MULTIPLAYER_PROTOCOL_VERSION,
      captainName,
    },
  };
}

export type HelloValidation =
  { ok: true; peerName: string } | { ok: false; reason: 'magic' | 'version'; detail: string };

/** Check a peer's HELLO against our magic and protocol version. */
export function validateHello(message: MultiplayerMessage): HelloValidation {
  const data = message.data ?? {};

  if (data.magic !== MULTIPLAYER_HELLO_MAGIC) {
    return { ok: false, reason: 'magic', detail: `bad magic: ${String(data.magic)}` };
  }
  if (data.protocolVersion !== MULTIPLAYER_PROTOCOL_VERSION) {
    return {
      ok: false,
      reason: 'version',
      detail: `version mismatch: ${String(data.protocolVersion)}`,
    };
  }

  return {
    ok: true,
    peerName: typeof data.captainName === 'string' ? data.captainName : '',
  };
}

interface HeartbeatOptions {
  intervalMs: number;
  timeoutMs: number;
  checkMs: number;
  /** Emit one PING on the transport. */
  sendPing: () => void;
  /** The peer has gone quiet for longer than timeoutMs. */
  onTimeout: (silentMs: number) => void;
  /** Injectable clock, for tests. */
  now?: () => number;
}

/**
 * Liveness watchdog, shared by both transports.
 *
 * A peer that leaves the network sends nothing to say so — no FIN on a TCP
 * socket, no close event on a data channel — so silence is the only signal
 * there is. Each side pings on an interval and measures how long it has been
 * since anything arrived.
 *
 * It compares timestamps rather than counting missed replies on purpose: a
 * blocked JS thread delays our own ping timer too, and a count would then
 * declare a perfectly live peer dead.
 */
export class Heartbeat {
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private lastInboundAt = 0;

  constructor(private readonly options: HeartbeatOptions) {}

  private clock(): number {
    return (this.options.now ?? Date.now)();
  }

  isRunning(): boolean {
    return this.pingTimer !== null;
  }

  start(): void {
    this.stop();
    this.lastInboundAt = this.clock();

    this.pingTimer = setInterval(() => this.options.sendPing(), this.options.intervalMs);
    this.watchdogTimer = setInterval(() => {
      const silentFor = this.clock() - this.lastInboundAt;
      if (silentFor < this.options.timeoutMs) return;
      // Stop first: onTimeout tears the link down, and a watchdog still armed
      // would fire again on the way out.
      this.stop();
      this.options.onTimeout(silentFor);
    }, this.options.checkMs);
  }

  stop(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.watchdogTimer) clearInterval(this.watchdogTimer);
    this.pingTimer = null;
    this.watchdogTimer = null;
  }

  /** Any byte from the peer proves it is still there, even a malformed one. */
  noteInbound(): void {
    this.lastInboundAt = this.clock();
  }
}

export type HandshakeState = 'idle' | 'awaiting' | 'complete';

interface HandshakeOptions {
  /** Called when the timer expires, before the handshake is failed. */
  onTimeout?: () => void;
  /** Tears the link down when the handshake fails. Not called on abort. */
  onFail?: (err: Error) => void;
  timeoutMs?: number;
}

/**
 * The HELLO handshake state machine, shared by both transports.
 *
 * `start()` arms a timeout and returns a promise that resolves with the peer's
 * captain name once `succeed()` is called. `fail()` rejects and tears the link
 * down; `abort()` rejects without teardown, for a local cancellation such as
 * the user navigating away.
 */
export class Handshake {
  private state: HandshakeState = 'idle';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private resolveFn: ((peerName: string) => void) | null = null;
  private rejectFn: ((err: Error) => void) | null = null;

  constructor(private readonly options: HandshakeOptions = {}) {}

  getState(): HandshakeState {
    return this.state;
  }

  isComplete(): boolean {
    return this.state === 'complete';
  }

  start(): Promise<string> {
    this.clearTimer();
    this.state = 'awaiting';
    return new Promise<string>((resolve, reject) => {
      this.resolveFn = resolve;
      this.rejectFn = reject;
      this.timer = setTimeout(() => {
        this.options.onTimeout?.();
        this.fail(new Error('HELLO timeout'));
      }, this.options.timeoutMs ?? MULTIPLAYER_HELLO_TIMEOUT_MS);
    });
  }

  succeed(peerName: string): void {
    const resolve = this.resolveFn;
    this.settle('complete');
    resolve?.(peerName);
  }

  fail(err: Error): void {
    const reject = this.rejectFn;
    this.settle('idle');
    this.options.onFail?.(err);
    reject?.(err);
  }

  /** Cancel a handshake in flight without tearing the link down. */
  abort(reason: string): void {
    if (this.state === 'idle') return;
    const reject = this.rejectFn;
    this.settle('idle');
    reject?.(new Error(`handshake aborted: ${reason}`));
  }

  private settle(state: HandshakeState): void {
    this.clearTimer();
    this.state = state;
    this.resolveFn = null;
    this.rejectFn = null;
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

// ─── Outbound queue ───────────────────────────────────────────────────────

/**
 * Holds messages sent before the link is ready. Both transports queue on
 * send and flush once the handshake completes, so a FLEET_READY raced against
 * the handshake is delivered rather than dropped.
 */
export class MessageQueue {
  private queued: MultiplayerMessage[] = [];

  push(message: MultiplayerMessage): void {
    this.queued.push(message);
  }

  /** Returns everything queued, in send order, and empties the queue. */
  drain(): MultiplayerMessage[] {
    const queued = this.queued;
    this.queued = [];
    return queued;
  }

  clear(): void {
    this.queued = [];
  }

  get size(): number {
    return this.queued.length;
  }
}

// ─── Handler registry ─────────────────────────────────────────────────────

/** Fan-out of inbound messages to the app-level subscribers. */
export class MessageEmitter {
  private handlers: MultiplayerEventHandler[] = [];

  subscribe(handler: MultiplayerEventHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter(h => h !== handler);
    };
  }

  emit(message: MultiplayerMessage): void {
    this.handlers.forEach(handler => handler(message));
  }

  clear(): void {
    this.handlers = [];
  }

  get size(): number {
    return this.handlers.length;
  }
}
