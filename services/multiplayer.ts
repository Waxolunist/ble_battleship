import {
  HEARTBEAT_CHECK_MS,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  MULTIPLAYER_HELLO_TIMEOUT_MS,
} from '@/constants/multiplayer';
import { lanService } from './lan';
import { multiplayerDebugLog } from './multiplayer-debug-log';
import {
  buildHello,
  describePayload,
  Handshake,
  Heartbeat,
  isHeartbeatMessage,
  MessageEmitter,
  MessageQueue,
  parseMessage,
  validateHello,
  type MultiplayerEventHandler,
  type MultiplayerMessage,
  type MultiplayerRole,
} from './protocol';
import { awaitAnswer, fetchOffer, publishAnswer, publishOffer } from './rendezvous';
import { webrtcService } from './webrtc';

/** Which transport carried the current session. */
export type TransportPath = 'lan' | 'relay';

// The wire format lives in protocol.ts; re-exported here so callers keep a
// single entry point into the multiplayer layer.
export type {
  MultiplayerEventHandler,
  MultiplayerMessage,
  MultiplayerMessageType,
  MultiplayerRole,
} from './protocol';

// ─── Service ──────────────────────────────────────────────────────────────

/**
 * Unified multiplayer transport façade.
 *
 * Two transports, raced rather than chosen. A host advertises on the LAN
 * (mDNS + TCP) and publishes a WebRTC offer under a short code at the same
 * time, because it cannot know which one the other phone can reach. Whichever
 * completes first wins and the other is torn down.
 *
 *   lan   → react-native-zeroconf (mDNS) + react-native-tcp-socket
 *   relay → rendezvous.ts (signalling) + react-native-webrtc (STUN/TURN)
 *
 * Callers never import from lan.ts / rendezvous.ts / webrtc.ts directly.
 */
class MultiplayerService {
  private messageQueue = new MessageQueue();
  private emitter = new MessageEmitter();
  private lanMessageUnsub: (() => void) | null = null;
  private webrtcRawUnsub: (() => void) | null = null;

  private path: TransportPath | null = null;
  private role: MultiplayerRole | null = null;
  private relayConnected = false;
  private localCaptainName = '';
  private relayCancel: { cancelled: boolean } | null = null;
  private pendingAnswerSdp: string | null = null;

  // The data channel goes quiet exactly like a TCP socket when a phone leaves
  // the network: onChannelClosed never fires, so the watchdog is the only
  // thing that notices. Same policy as the LAN transport.
  private heartbeat = new Heartbeat({
    intervalMs: HEARTBEAT_INTERVAL_MS,
    timeoutMs: HEARTBEAT_TIMEOUT_MS,
    checkMs: HEARTBEAT_CHECK_MS,
    sendPing: () => {
      if (this.relayConnected) webrtcService.sendRaw(JSON.stringify({ type: 'PING' }));
    },
    onTimeout: silentFor => {
      multiplayerDebugLog.push(
        'error',
        'relay heartbeat timeout → peer lost',
        `${silentFor}ms silent`,
      );
      this._relayLost();
    },
  });

  // HELLO over the data channel — the LAN transport runs its own.
  private handshake = new Handshake({
    onTimeout: () =>
      multiplayerDebugLog.push(
        'error',
        'WebRTC HELLO timeout',
        `no valid HELLO within ${MULTIPLAYER_HELLO_TIMEOUT_MS}ms`,
      ),
    onFail: () =>
      this.disconnect().catch(e =>
        multiplayerDebugLog.push('warn', 'disconnect during handshake fail', String(e)),
      ),
  });

  private onDisconnectCb: (() => void) | null = null;
  private onCentralConnectedCb: ((peerName: string) => void) | null = null;

  // ─── Public API ─────────────────────────────────────────────────────────

  setOnDisconnect(handler: (() => void) | null): void {
    this.onDisconnectCb = handler;
    lanService.setOnDisconnect(handler);
  }

  setOnCentralConnected(handler: ((peerName: string) => void) | null): void {
    this.onCentralConnectedCb = handler;
    lanService.setOnCentralConnected(handler);
  }

  /**
   * Host on both transports at once. `onCode` fires when the rendezvous hands
   * back a code — a beat after LAN advertising starts, since the offer has to
   * gather ICE first.
   */
  async startAdvertising(
    captainName: string,
    opts?: { onCode?: (code: string) => void; onCodeFailed?: (err: unknown) => void },
  ): Promise<void> {
    multiplayerDebugLog.push('event', 'startAdvertising →');
    this.role = 'host';
    this.localCaptainName = captainName;

    this.lanMessageUnsub?.();
    this.lanMessageUnsub = lanService.onMessage(msg => this._emitMessage(msg));
    lanService.setOnDisconnect(this.onDisconnectCb);
    lanService.setOnCentralConnected((peerName: string) => {
      // LAN won the race — stop waiting on a code nobody will type.
      this._cancelRelay();
      this.path = 'lan';
      this._flushQueue();
      this.onCentralConnectedCb?.(peerName);
    });
    await lanService.startAdvertising(captainName);

    this._runRelayHostFlow(captainName, opts).catch((err: unknown) => {
      multiplayerDebugLog.push('error', 'relay host flow failed', String(err));
      opts?.onCodeFailed?.(err);
    });
  }

  async stopAdvertising(): Promise<void> {
    this._cancelRelay();
    if (this.path !== 'relay') webrtcService.close();
    await lanService.stopAdvertising();
    multiplayerDebugLog.push('info', 'stopAdvertising');
  }

  /** Joiner: begin mDNS discovery; onDeviceFound fires per resolved service. */
  async startScanning(onDeviceFound: (id: string, name: string) => void): Promise<void> {
    multiplayerDebugLog.push('event', 'startScanning →');
    this.lanMessageUnsub?.();
    this.lanMessageUnsub = lanService.onMessage(msg => this._emitMessage(msg));
    await lanService.startScanning(onDeviceFound);
  }

  async stopScanning(): Promise<void> {
    await lanService.stopScanning();
    multiplayerDebugLog.push('info', 'stopScanning');
  }

  /** Joiner: open a TCP connection to a discovered peer. Returns its captain name. */
  async connect(peerId: string, captainName: string): Promise<string> {
    multiplayerDebugLog.push('event', 'connect →', peerId);
    const peerName = await lanService.connect(peerId, captainName);
    this._flushQueue();
    return peerName;
  }

  /**
   * Joiner: pair through a code instead of the LAN list. Returns the host's
   * captain name, same as connect().
   */
  async connectWithCode(code: string, captainName: string): Promise<string> {
    multiplayerDebugLog.push('event', 'connectWithCode →', code);
    this.role = 'joiner';
    this.localCaptainName = captainName;

    const offerSdp = await fetchOffer(code.toUpperCase());
    await webrtcService.setRemoteOffer(offerSdp);
    this.pendingAnswerSdp = await webrtcService.createAnswer();
    await publishAnswer(code.toUpperCase(), this.pendingAnswerSdp);
    this.pendingAnswerSdp = null;

    await webrtcService.waitForOpen();
    this._attachWebRTCHandlers();

    const helloPromise = this._awaitHello();
    this._sendWebRTCHello(captainName);
    const peerName = await helloPromise;

    this.path = 'relay';
    this.relayConnected = true;
    this.heartbeat.start();
    this._flushQueue();
    multiplayerDebugLog.push('info', 'relay joiner connected', `host "${peerName}"`);
    return peerName;
  }

  async disconnect(): Promise<void> {
    multiplayerDebugLog.push('event', 'disconnect');
    this._cancelRelay();
    this.heartbeat.stop();
    this.lanMessageUnsub?.();
    this.lanMessageUnsub = null;
    this.webrtcRawUnsub?.();
    this.webrtcRawUnsub = null;
    webrtcService.close();
    this.handshake.abort('disconnect');
    await lanService.disconnect();
    this.relayConnected = false;
    this.path = null;
    this.role = null;
    this.messageQueue.clear();
  }

  async sendMessage(message: MultiplayerMessage): Promise<void> {
    if (!this.isConnectedToMultiplayer()) {
      this.messageQueue.push(message);
      multiplayerDebugLog.push('warn', 'TX queued (not connected)', message.type);
      return;
    }
    if (this.path === 'relay') {
      webrtcService.sendRaw(JSON.stringify(message));
      multiplayerDebugLog.push('tx', message.type, describePayload(message));
      return;
    }
    await lanService.sendMessage(message);
  }

  onMessage(handler: MultiplayerEventHandler): () => void {
    return this.emitter.subscribe(handler);
  }

  getRole(): MultiplayerRole | null {
    return this.path === 'relay' ? this.role : lanService.getRole();
  }

  isConnectedToMultiplayer(): boolean {
    return this.path === 'relay' ? this.relayConnected : lanService.isConnectedToLAN();
  }

  getTransportPath(): TransportPath | null {
    return this.path;
  }

  // ─── Relay (rendezvous + WebRTC) ──────────────────────────────────────────

  private async _runRelayHostFlow(
    captainName: string,
    opts?: { onCode?: (code: string) => void },
  ): Promise<void> {
    const cancel = { cancelled: false };
    this.relayCancel = cancel;

    const offerSdp = await webrtcService.createOffer();
    if (cancel.cancelled) return;

    const code = await publishOffer(offerSdp);
    if (cancel.cancelled) return;
    opts?.onCode?.(code);

    const answerSdp = await awaitAnswer(code, cancel);
    if (cancel.cancelled) return;

    await webrtcService.setRemoteAnswer(answerSdp);
    await webrtcService.waitForOpen();
    if (cancel.cancelled) return;

    this._attachWebRTCHandlers();
    const peerName = await this._awaitHello();

    // Relay won the race — the LAN advert is no longer wanted.
    void lanService.stopAdvertising();
    this.path = 'relay';
    this.relayConnected = true;
    this.heartbeat.start();
    this._flushQueue();
    multiplayerDebugLog.push('info', 'relay host connected', `peer "${peerName}"`);
    this.onCentralConnectedCb?.(peerName);
  }

  /** The relay peer is gone — by a closed channel or by silence. */
  private _relayLost(): void {
    this.heartbeat.stop();
    this.relayConnected = false;
    this.path = null;
    this.handshake.abort('relay lost');
    webrtcService.close();
    this.onDisconnectCb?.();
  }

  private _cancelRelay(): void {
    if (this.relayCancel) this.relayCancel.cancelled = true;
    this.relayCancel = null;
    this.pendingAnswerSdp = null;
  }

  private _attachWebRTCHandlers(): void {
    this.webrtcRawUnsub?.();

    webrtcService.setOnChannelClosed(() => {
      if (!this.relayConnected) return;
      multiplayerDebugLog.push('event', 'WebRTC channel closed → disconnect');
      this._relayLost();
    });

    this.webrtcRawUnsub = webrtcService.onRawMessage(raw => {
      this.heartbeat.noteInbound();

      const message = parseMessage(raw);
      if (!message) {
        multiplayerDebugLog.push('error', 'WebRTC RX parse failed', raw.slice(0, 120));
        return;
      }

      if (!isHeartbeatMessage(message)) {
        multiplayerDebugLog.push('rx', message.type, describePayload(message));
      }

      if (message.type === 'HELLO') {
        this._handleIncomingHello(message);
        return;
      }

      if (!this.handshake.isComplete()) {
        multiplayerDebugLog.push('warn', `dropped pre-handshake ${message.type}`);
        return;
      }

      // Heartbeat traffic is transport bookkeeping; the game never sees it.
      if (message.type === 'PING') {
        webrtcService.sendRaw(JSON.stringify({ type: 'PONG' }));
        return;
      }
      if (message.type === 'PONG') return;

      this.emitter.emit(message);
    });
  }

  private _sendWebRTCHello(captainName: string): void {
    webrtcService.sendRaw(JSON.stringify(buildHello(captainName)));
    multiplayerDebugLog.push('info', 'WebRTC HELLO sent');
  }

  private _awaitHello(): Promise<string> {
    return this.handshake.start();
  }

  private _handleIncomingHello(message: MultiplayerMessage): void {
    const result = validateHello(message);
    if (!result.ok) {
      multiplayerDebugLog.push('error', 'WebRTC HELLO rejected', result.detail);
      this.handshake.fail(
        new Error(result.reason === 'magic' ? 'Invalid HELLO magic' : 'Protocol version mismatch'),
      );
      return;
    }

    multiplayerDebugLog.push('info', 'WebRTC HELLO accepted', `peer "${result.peerName}"`);

    // Host echoes its own HELLO first; the joiner's echo already resolved.
    if (this.role === 'host') this._sendWebRTCHello(this.localCaptainName);
    this.handshake.succeed(result.peerName);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private _emitMessage(message: MultiplayerMessage): void {
    this.emitter.emit(message);
  }

  private _flushQueue(): void {
    for (const msg of this.messageQueue.drain()) {
      this.sendMessage(msg).catch(e =>
        multiplayerDebugLog.push('error', 'flush failed', String(e)),
      );
    }
  }

  /** Test/mock hook — simulate receiving a message from the peer. */
  _simulateMessage(message: MultiplayerMessage): void {
    this._emitMessage(message);
  }
}

export const multiplayerService = new MultiplayerService();

// sendMessage resolves once the payload is handed to the socket, not once it
// is on the wire, so give BYE a beat to flush before tearing the link down.
const BYE_FLUSH_MS = 150;

/**
 * Leave a match deliberately: tell the peer with BYE so they see "opponent
 * left" rather than a dropped connection, then close the transport. Callers
 * reset the multiplayer store themselves.
 */
export async function leaveMultiplayerSession(): Promise<void> {
  try {
    await multiplayerService.sendMessage({ type: 'BYE' });
    await new Promise(resolve => setTimeout(resolve, BYE_FLUSH_MS));
  } catch (err) {
    multiplayerDebugLog.push('warn', 'BYE send failed on leave', String(err));
  }
  await multiplayerService.disconnect();
}
