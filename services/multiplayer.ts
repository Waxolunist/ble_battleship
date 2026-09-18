import { lanService } from './lan';
import { multiplayerDebugLog } from './multiplayer-debug-log';
import {
  MessageEmitter,
  MessageQueue,
  type MultiplayerEventHandler,
  type MultiplayerMessage,
  type MultiplayerRole,
} from './protocol';

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
 * Every session runs over the LAN transport: react-native-zeroconf (mDNS) for
 * discovery, react-native-tcp-socket for the link. Callers never import from
 * lan.ts directly.
 *
 * A second, off-LAN path is planned (short code through a signalling relay
 * into WebRTC); webrtc.ts and the Handshake in protocol.ts are kept for it.
 */
class MultiplayerService {
  private messageQueue = new MessageQueue();
  private emitter = new MessageEmitter();
  private lanMessageUnsub: (() => void) | null = null;

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

  async startAdvertising(captainName: string): Promise<void> {
    multiplayerDebugLog.push('event', 'startAdvertising →');
    this.lanMessageUnsub?.();
    this.lanMessageUnsub = lanService.onMessage(msg => this._emitMessage(msg));
    lanService.setOnDisconnect(this.onDisconnectCb);
    lanService.setOnCentralConnected((peerName: string) => {
      this._flushQueue();
      this.onCentralConnectedCb?.(peerName);
    });
    await lanService.startAdvertising(captainName);
  }

  async stopAdvertising(): Promise<void> {
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

  async disconnect(): Promise<void> {
    multiplayerDebugLog.push('event', 'disconnect');
    this.lanMessageUnsub?.();
    this.lanMessageUnsub = null;
    await lanService.disconnect();
    this.messageQueue.clear();
  }

  async sendMessage(message: MultiplayerMessage): Promise<void> {
    if (!lanService.isConnectedToLAN()) {
      this.messageQueue.push(message);
      multiplayerDebugLog.push('warn', 'TX queued (not connected)', message.type);
      return;
    }
    await lanService.sendMessage(message);
  }

  onMessage(handler: MultiplayerEventHandler): () => void {
    return this.emitter.subscribe(handler);
  }

  getRole(): MultiplayerRole | null {
    return lanService.getRole();
  }

  isConnectedToMultiplayer(): boolean {
    return lanService.isConnectedToLAN();
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
