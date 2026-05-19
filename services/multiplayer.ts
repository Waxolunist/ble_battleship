import {
  MULTIPLAYER_HELLO_MAGIC,
  MULTIPLAYER_HELLO_TIMEOUT_MS,
  MULTIPLAYER_PROTOCOL_VERSION,
} from '@/constants/multiplayer';
import { getNetworkPath, type NetworkPath } from './network-detector';
import { lanService } from './lan';
import { multiplayerDebugLog } from './multiplayer-debug-log';
import * as nfc from './nfc';
import { webrtcService } from './webrtc';

// ─── Exported types (replace the old BLE types) ───────────────────────────

export type MultiplayerMessageType =
  | 'HELLO'
  | 'FLEET_READY'
  | 'FIRE'
  | 'SHOT_RESULT'
  | 'GAME_OVER'
  | 'REMATCH'
  | 'BYE';

export interface MultiplayerMessage {
  type: MultiplayerMessageType;
  data?: Record<string, unknown>;
}

export type MultiplayerRole = 'host' | 'joiner';

export type MultiplayerEventHandler = (message: MultiplayerMessage) => void;

/** Sentinel peer ID used on the NFC+WebRTC path where there is no discovery step. */
export const NFC_PEER_ID = 'nfc';

// ─── Service ──────────────────────────────────────────────────────────────

/**
 * Unified multiplayer transport façade.
 *
 * On `startAdvertising` / `startScanning` this service calls
 * `getNetworkPath()` and routes to the appropriate transport:
 *
 *   lan        → react-native-zeroconf (mDNS) + react-native-tcp-socket
 *   nfc-webrtc → react-native-nfc-manager + react-native-webrtc
 *
 * Callers never import from lan.ts / nfc.ts / webrtc.ts directly.
 */
class MultiplayerService {
  private path: NetworkPath | null = null;
  private role: MultiplayerRole | null = null;
  private isConnected = false;
  private localCaptainName = '';
  private messageQueue: MultiplayerMessage[] = [];
  private messageHandlers: MultiplayerEventHandler[] = [];
  private lanMessageUnsub: (() => void) | null = null;
  private webrtcRawUnsub: (() => void) | null = null;

  // HELLO state — used only on the NFC+WebRTC path.
  private handshakeState: 'idle' | 'awaiting' | 'complete' = 'idle';
  private handshakeTimer: ReturnType<typeof setTimeout> | null = null;
  private handshakeResolve: ((peerName: string) => void) | null = null;
  private handshakeReject: ((err: Error) => void) | null = null;

  private onDisconnectCb: (() => void) | null = null;
  private onCentralConnectedCb: ((peerName: string) => void) | null = null;

  // ─── Public API (mirrors the old BLEService) ────────────────────────────

  setOnDisconnect(handler: (() => void) | null): void {
    this.onDisconnectCb = handler;
    lanService.setOnDisconnect(handler);
  }

  setOnCentralConnected(handler: ((peerName: string) => void) | null): void {
    this.onCentralConnectedCb = handler;
    lanService.setOnCentralConnected(handler);
  }

  async startAdvertising(captainName: string): Promise<void> {
    this.localCaptainName = captainName;
    this.role = 'host';
    this.path = await getNetworkPath();
    multiplayerDebugLog.push('event', 'startAdvertising →', `path=${this.path}`);

    if (this.path === 'lan') {
      this.lanMessageUnsub?.();
      this.lanMessageUnsub = lanService.onMessage(msg =>
        this._emitMessage(msg as MultiplayerMessage),
      );
      lanService.setOnDisconnect(this.onDisconnectCb);
      lanService.setOnCentralConnected(this.onCentralConnectedCb);
      await lanService.startAdvertising(captainName);
    } else {
      // NFC+WebRTC host flow — runs in the background; UI shows "TAP PHONES".
      this._runNFCHostFlow(captainName).catch(err =>
        multiplayerDebugLog.push('error', 'NFC host flow failed', String(err)),
      );
    }
  }

  async stopAdvertising(): Promise<void> {
    if (this.path === 'lan') {
      await lanService.stopAdvertising();
    } else if (this.path === 'nfc-webrtc') {
      webrtcService.close();
      this._abortHandshake('stopAdvertising');
    }
    if (this.role === 'host') this.role = null;
    multiplayerDebugLog.push('info', 'stopAdvertising');
  }

  /**
   * Joiner: begin discovery.
   *
   * LAN path    — starts mDNS scan; onDeviceFound is called for each resolved
   *               service.
   * NFC path    — arms NFC reader; when the first tap completes (offer read),
   *               onDeviceFound is called with `NFC_PEER_ID`. The caller must
   *               then call connect(NFC_PEER_ID, captainName) to write the
   *               answer and complete the WebRTC handshake.
   */
  async startScanning(onDeviceFound: (id: string, name: string) => void): Promise<void> {
    this.role = 'joiner';
    this.path = await getNetworkPath();
    multiplayerDebugLog.push('event', 'startScanning →', `path=${this.path}`);

    if (this.path === 'lan') {
      this.lanMessageUnsub?.();
      this.lanMessageUnsub = lanService.onMessage(msg =>
        this._emitMessage(msg as MultiplayerMessage),
      );
      await lanService.startScanning(onDeviceFound);
    } else {
      // NFC+WebRTC joiner — read the host's offer on tap 1.
      this._runNFCScanFlow(onDeviceFound).catch(err =>
        multiplayerDebugLog.push('error', 'NFC scan flow failed', String(err)),
      );
    }
  }

  async stopScanning(): Promise<void> {
    if (this.path === 'lan') {
      await lanService.stopScanning();
    }
    // NFC: cancelTechnologyRequest is handled inside nfc.ts if the user navigates away.
    // WebRTC resources are cleaned up in disconnect() / close().
    multiplayerDebugLog.push('info', 'stopScanning');
  }

  /**
   * Joiner: connect to a discovered peer.
   *
   * LAN path  — looks up the resolved host/port and opens a TCP connection.
   * NFC path  — writes the WebRTC answer to the NFC tag (tap 2), then waits
   *             for the data channel to open and completes the HELLO handshake.
   *
   * Returns the peer's captain name.
   */
  async connect(peerId: string, captainName: string): Promise<string> {
    this.localCaptainName = captainName;
    multiplayerDebugLog.push('event', 'connect →', peerId);

    if (this.path === 'lan') {
      const peerName = await lanService.connect(peerId, captainName);
      this.isConnected = true;
      return peerName;
    }

    // NFC+WebRTC joiner path — answer was already created in _runNFCScanFlow;
    // retrieve it from the stored promise.
    const peerName = await this._completeNFCJoinerFlow(captainName);
    return peerName;
  }

  async disconnect(): Promise<void> {
    multiplayerDebugLog.push('event', 'disconnect');
    this.lanMessageUnsub?.();
    this.lanMessageUnsub = null;
    this.webrtcRawUnsub?.();
    this.webrtcRawUnsub = null;

    if (this.path === 'lan') {
      await lanService.disconnect();
    } else if (this.path === 'nfc-webrtc') {
      webrtcService.close();
      this._abortHandshake('disconnect');
    }

    this._reset();
  }

  async sendMessage(message: MultiplayerMessage): Promise<void> {
    if (!this.isConnected) {
      this.messageQueue.push(message);
      multiplayerDebugLog.push('warn', 'TX queued (not connected)', message.type);
      return;
    }

    if (this.path === 'lan') {
      await lanService.sendMessage(message as Parameters<typeof lanService.sendMessage>[0]);
    } else {
      const json = JSON.stringify(message);
      webrtcService.sendRaw(json);
      multiplayerDebugLog.push(
        'tx',
        message.type,
        message.data ? JSON.stringify(message.data) : undefined,
      );
    }
  }

  onMessage(handler: MultiplayerEventHandler): () => void {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    };
  }

  getRole(): MultiplayerRole | null {
    return this.path === 'lan' ? lanService.getRole() : this.role;
  }

  isConnectedToMultiplayer(): boolean {
    return this.path === 'lan' ? lanService.isConnectedToLAN() : this.isConnected;
  }

  getConnectionPath(): NetworkPath | null {
    return this.path;
  }

  // ─── NFC+WebRTC host flow ─────────────────────────────────────────────────

  private async _runNFCHostFlow(captainName: string): Promise<void> {
    multiplayerDebugLog.push('info', 'NFC host flow started');

    const offerSdp = await webrtcService.createOffer();

    // Tap 1: joiner reads the offer from our NFC tag.
    await nfc.writeOffer(offerSdp);
    multiplayerDebugLog.push('info', 'NFC offer written — waiting for joiner to tap');

    // Tap 2: host reads the answer from joiner's NFC tag.
    const answerSdp = await nfc.readAnswer();
    await webrtcService.setRemoteAnswer(answerSdp);
    multiplayerDebugLog.push('info', 'NFC answer received — waiting for WebRTC channel');

    await webrtcService.waitForOpen();
    this._attachWebRTCHandlers();

    // HELLO — wait for joiner's HELLO then reply with ours.
    const peerName = await this._awaitHello();
    this.isConnected = true;
    this._flushQueue();
    multiplayerDebugLog.push('info', 'NFC host flow complete', `peer "${peerName}"`);
    this.onCentralConnectedCb?.(peerName);
  }

  // ─── NFC+WebRTC joiner flow ───────────────────────────────────────────────

  // Intermediate state between tap 1 (offer read) and tap 2 (answer written).
  private nfcAnswerSdp: string | null = null;

  private async _runNFCScanFlow(onDeviceFound: (id: string, name: string) => void): Promise<void> {
    multiplayerDebugLog.push('info', 'NFC joiner scan started — waiting for tap 1');

    // Tap 1: read the host's offer.
    const offerSdp = await nfc.readOffer();
    await webrtcService.setRemoteOffer(offerSdp);
    this.nfcAnswerSdp = await webrtcService.createAnswer();

    multiplayerDebugLog.push('info', 'NFC offer read — notifying UI');
    // Signal the UI that a peer was found; it will call connect(NFC_PEER_ID, ...).
    onDeviceFound(NFC_PEER_ID, '');
  }

  private async _completeNFCJoinerFlow(captainName: string): Promise<string> {
    if (!this.nfcAnswerSdp) throw new Error('[Multiplayer] NFC answer SDP not ready');

    // Tap 2: write our answer so the host can read it.
    await nfc.writeAnswer(this.nfcAnswerSdp);
    this.nfcAnswerSdp = null;
    multiplayerDebugLog.push('info', 'NFC answer written — waiting for WebRTC channel');

    await webrtcService.waitForOpen();
    this._attachWebRTCHandlers();

    // HELLO — send ours, wait for host's echo.
    const helloPromise = this._awaitHello();
    this._sendWebRTCHello(captainName);

    const peerName = await helloPromise;
    this.isConnected = true;
    this._flushQueue();
    multiplayerDebugLog.push('info', 'NFC joiner flow complete', `peer "${peerName}"`);
    return peerName;
  }

  // ─── HELLO (NFC+WebRTC path) ──────────────────────────────────────────────

  private _attachWebRTCHandlers(): void {
    this.webrtcRawUnsub?.();
    this.webrtcRawUnsub = webrtcService.onRawMessage(raw => {
      try {
        const message = JSON.parse(raw) as MultiplayerMessage;
        multiplayerDebugLog.push(
          'rx',
          message.type,
          message.data ? JSON.stringify(message.data) : undefined,
        );

        if (message.type === 'HELLO') {
          this._handleIncomingHello(message);
          return;
        }

        if (this.handshakeState !== 'complete') {
          multiplayerDebugLog.push('warn', `dropped pre-handshake ${message.type}`);
          return;
        }

        this._emitMessage(message);
      } catch (e) {
        multiplayerDebugLog.push('error', 'WebRTC RX parse failed', String(e));
      }
    });
  }

  private _sendWebRTCHello(captainName: string): void {
    const msg: MultiplayerMessage = {
      type: 'HELLO',
      data: {
        magic: MULTIPLAYER_HELLO_MAGIC,
        protocolVersion: MULTIPLAYER_PROTOCOL_VERSION,
        captainName,
      },
    };
    webrtcService.sendRaw(JSON.stringify(msg));
    multiplayerDebugLog.push('info', 'WebRTC HELLO sent');
  }

  /** Returns a promise that resolves with the peer's captain name once HELLO completes. */
  private _awaitHello(): Promise<string> {
    this._clearHandshakeTimer();
    this.handshakeState = 'awaiting';
    return new Promise<string>((resolve, reject) => {
      this.handshakeResolve = resolve;
      this.handshakeReject = reject;
      this.handshakeTimer = setTimeout(() => {
        multiplayerDebugLog.push(
          'error',
          'WebRTC HELLO timeout',
          `no valid HELLO within ${MULTIPLAYER_HELLO_TIMEOUT_MS}ms`,
        );
        this._failHandshake(new Error('HELLO timeout'));
      }, MULTIPLAYER_HELLO_TIMEOUT_MS);
    });
  }

  private _handleIncomingHello(message: MultiplayerMessage): void {
    const data = message.data ?? {};
    const magic = data.magic;
    const version = data.protocolVersion;
    const peerName = typeof data.captainName === 'string' ? data.captainName : '';

    if (magic !== MULTIPLAYER_HELLO_MAGIC) {
      multiplayerDebugLog.push('error', 'WebRTC HELLO rejected', `bad magic: ${String(magic)}`);
      this._failHandshake(new Error('Invalid HELLO magic'));
      return;
    }
    if (version !== MULTIPLAYER_PROTOCOL_VERSION) {
      multiplayerDebugLog.push(
        'error',
        'WebRTC HELLO rejected',
        `version mismatch: ${String(version)}`,
      );
      this._failHandshake(new Error('Protocol version mismatch'));
      return;
    }

    multiplayerDebugLog.push('info', 'WebRTC HELLO accepted', `peer "${peerName}"`);

    if (this.role === 'host') {
      // Echo our HELLO, then resolve.
      this._sendWebRTCHello(this.localCaptainName);
      this._succeedHandshake(peerName);
    } else {
      // Joiner — host's echo resolves connect().
      this._succeedHandshake(peerName);
    }
  }

  private _clearHandshakeTimer(): void {
    if (this.handshakeTimer) {
      clearTimeout(this.handshakeTimer);
      this.handshakeTimer = null;
    }
  }

  private _succeedHandshake(peerName: string): void {
    const resolve = this.handshakeResolve;
    this._clearHandshakeTimer();
    this.handshakeState = 'complete';
    this.handshakeResolve = null;
    this.handshakeReject = null;
    resolve?.(peerName);
  }

  private _failHandshake(err: Error): void {
    const reject = this.handshakeReject;
    this._clearHandshakeTimer();
    this.handshakeState = 'idle';
    this.handshakeResolve = null;
    this.handshakeReject = null;
    this.disconnect().catch(e =>
      multiplayerDebugLog.push('warn', 'disconnect during handshake fail', String(e)),
    );
    reject?.(err);
  }

  private _abortHandshake(reason: string): void {
    if (this.handshakeState === 'idle') return;
    const reject = this.handshakeReject;
    this._clearHandshakeTimer();
    this.handshakeState = 'idle';
    this.handshakeResolve = null;
    this.handshakeReject = null;
    reject?.(new Error(`handshake aborted: ${reason}`));
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private _emitMessage(message: MultiplayerMessage): void {
    this.messageHandlers.forEach(h => h(message));
  }

  private _flushQueue(): void {
    const queued = this.messageQueue;
    this.messageQueue = [];
    for (const msg of queued) {
      this.sendMessage(msg).catch(e =>
        multiplayerDebugLog.push('error', 'flush failed', String(e)),
      );
    }
  }

  private _reset(): void {
    this.isConnected = false;
    this.role = null;
    this.path = null;
    this.messageQueue = [];
    this.nfcAnswerSdp = null;
    this._abortHandshake('reset');
  }

  /** Test/mock hook — simulate receiving a message from the peer. */
  _simulateMessage(message: MultiplayerMessage): void {
    this._emitMessage(message);
  }
}

export const multiplayerService = new MultiplayerService();
