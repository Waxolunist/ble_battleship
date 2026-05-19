import {
  MDNS_SERVICE_TYPE,
  MULTIPLAYER_HELLO_MAGIC,
  MULTIPLAYER_HELLO_TIMEOUT_MS,
  MULTIPLAYER_PROTOCOL_VERSION,
  TCP_PORT,
} from '@/constants/multiplayer';
import TcpSocket from 'react-native-tcp-socket';
import Zeroconf from 'react-native-zeroconf';
import { multiplayerDebugLog } from './multiplayer-debug-log';

// Zeroconf expects type and protocol split out from the service type string.
const [ZEROCONF_TYPE, ZEROCONF_PROTOCOL] = MDNS_SERVICE_TYPE.replace(/^_/, '').split('._');
const ZEROCONF_DOMAIN = 'local.';

interface Message {
  type: string;
  data?: Record<string, unknown>;
}

type MessageHandler = (message: Message) => void;

interface ResolvedPeer {
  host: string;
  port: number;
}

/**
 * LAN transport (Path 1).
 *
 * Host: publishes an mDNS service via Zeroconf and listens on a TCP port.
 * Joiner: scans for mDNS services and connects via TCP.
 *
 * After the TCP link is up, both sides perform the HELLO handshake:
 * the joiner sends HELLO first, the host validates and echoes its own HELLO,
 * then the link is promoted to a game session.
 *
 * Messages are newline-delimited JSON (NDJSON) over the TCP stream.
 */
class LanService {
  private zeroconf = new Zeroconf();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private server: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private socket: any = null;
  private role: 'host' | 'joiner' | null = null;
  private isConnected = false;
  private isAdvertising = false;
  private isScanning = false;
  private localCaptainName = '';
  private buffer = '';
  private messageQueue: Message[] = [];
  private messageHandlers: MessageHandler[] = [];
  private resolvedPeers = new Map<string, ResolvedPeer>();

  private handshakeState: 'idle' | 'awaiting' | 'complete' = 'idle';
  private handshakeTimer: ReturnType<typeof setTimeout> | null = null;
  private handshakeResolve: ((peerName: string) => void) | null = null;
  private handshakeReject: ((err: Error) => void) | null = null;

  private onDisconnectCb: (() => void) | null = null;
  private onCentralConnectedCb: ((peerName: string) => void) | null = null;
  private onDeviceFoundCb: ((id: string, name: string) => void) | null = null;

  // ─── Public API ───────────────────────────────────────────────────────────

  setOnDisconnect(handler: (() => void) | null): void {
    this.onDisconnectCb = handler;
  }

  setOnCentralConnected(handler: ((peerName: string) => void) | null): void {
    this.onCentralConnectedCb = handler;
  }

  async startAdvertising(captainName: string): Promise<void> {
    if (this.isAdvertising) return;
    this.localCaptainName = captainName;
    this.role = 'host';
    multiplayerDebugLog.push('event', 'LAN startAdvertising →', `captain "${captainName}"`);

    this.server = TcpSocket.createServer((socket: unknown) => {
      if (this.isConnected) {
        // Already have a peer — reject extra connections.
        (socket as { destroy(): void }).destroy();
        return;
      }
      multiplayerDebugLog.push('event', 'TCP client connected (awaiting HELLO)');
      this.socket = socket;
      this._attachSocketHandlers();
      // Close the server so no further clients can connect.
      this.server?.close();
      this.server = null;
      this._startHandshakeAwait().catch(e =>
        multiplayerDebugLog.push('warn', 'host handshake aborted', String(e)),
      );
    });

    (this.server as { on(event: string, cb: (e: Error) => void): void }).on(
      'error',
      (err: Error) => {
        multiplayerDebugLog.push('error', 'TCP server error', String(err));
      },
    );

    (this.server as { listen(opts: { port: number; host: string }, cb?: () => void): void }).listen(
      { port: TCP_PORT, host: '0.0.0.0' },
      () => {
        multiplayerDebugLog.push('info', `TCP server listening on :${TCP_PORT}`);
      },
    );

    this.zeroconf.publish(
      ZEROCONF_TYPE,
      ZEROCONF_PROTOCOL,
      ZEROCONF_DOMAIN,
      captainName,
      TCP_PORT,
      {},
    );

    this.isAdvertising = true;
    multiplayerDebugLog.push('info', 'LAN advertising started', captainName);
  }

  async stopAdvertising(): Promise<void> {
    if (!this.isAdvertising) return;
    this.zeroconf.unpublish(this.localCaptainName);
    this.server?.close();
    this.server = null;
    this.isAdvertising = false;
    if (this.role === 'host' && !this.isConnected) this.role = null;
    multiplayerDebugLog.push('info', 'LAN advertising stopped');
  }

  async startScanning(onDeviceFound: (id: string, name: string) => void): Promise<void> {
    if (this.isScanning) return;
    this.onDeviceFoundCb = onDeviceFound;
    this.role = 'joiner';
    multiplayerDebugLog.push('event', 'LAN startScanning →', MDNS_SERVICE_TYPE);

    this.zeroconf.on('resolved', (service: Record<string, unknown>) => {
      const name = String(service.name ?? '');
      const host = String(
        (service.addresses as string[] | undefined)?.[0] ?? service.host ?? '',
      );
      const port = Number(service.port ?? TCP_PORT);
      multiplayerDebugLog.push('event', 'mDNS resolved', `${name} @ ${host}:${port}`);
      this.resolvedPeers.set(name, { host, port });
      this.onDeviceFoundCb?.(name, name);
    });

    this.zeroconf.on('remove', (name: string) => {
      multiplayerDebugLog.push('event', 'mDNS removed', name);
      this.resolvedPeers.delete(name);
    });

    this.zeroconf.on('error', (err: Error) => {
      multiplayerDebugLog.push('error', 'mDNS error', String(err));
    });

    this.zeroconf.scan(ZEROCONF_TYPE, ZEROCONF_PROTOCOL, ZEROCONF_DOMAIN);
    this.isScanning = true;
    multiplayerDebugLog.push('info', 'LAN scanning started');
  }

  async stopScanning(): Promise<void> {
    if (!this.isScanning) return;
    this.zeroconf.stop();
    this.zeroconf.removeDeviceListeners();
    this.onDeviceFoundCb = null;
    this.isScanning = false;
    multiplayerDebugLog.push('info', 'LAN scanning stopped');
  }

  /**
   * Joiner: connect to the host identified by peerId (the captain name
   * returned by startScanning's onDeviceFound). Returns the host's captain
   * name once the HELLO handshake completes.
   */
  async connect(peerId: string, captainName: string): Promise<string> {
    if (this.isConnected) return '';
    const peer = this.resolvedPeers.get(peerId);
    if (!peer) throw new Error(`[LAN] Unknown peer: ${peerId}`);

    this.localCaptainName = captainName;
    multiplayerDebugLog.push('event', 'LAN connect →', `${peer.host}:${peer.port}`);

    await new Promise<void>((resolve, reject) => {
      this.socket = TcpSocket.createConnection(
        { port: peer.port, host: peer.host },
        () => {
          multiplayerDebugLog.push('info', 'TCP connected');
          resolve();
        },
      );
      (this.socket as { on(event: string, cb: (e: Error) => void): void }).on(
        'error',
        (err: Error) => {
          multiplayerDebugLog.push('error', 'TCP connect error', String(err));
          reject(err);
        },
      );
    });

    this._attachSocketHandlers();

    const helloPromise = this._startHandshakeAwait();
    this._writeRaw({
      type: 'HELLO',
      data: {
        magic: MULTIPLAYER_HELLO_MAGIC,
        protocolVersion: MULTIPLAYER_PROTOCOL_VERSION,
        captainName,
      },
    });
    multiplayerDebugLog.push('info', 'LAN HELLO sent, awaiting reply');

    const peerName = await helloPromise;
    this.isConnected = true;
    this._flushQueue();
    multiplayerDebugLog.push('info', 'LAN handshake complete', `host "${peerName}"`);
    return peerName;
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected && !this.isAdvertising) return;
    multiplayerDebugLog.push('event', 'LAN disconnect');
    await this.stopAdvertising();
    await this.stopScanning();
    this._teardown();
  }

  async sendMessage(message: Message): Promise<void> {
    if (!this.isConnected) {
      this.messageQueue.push(message);
      multiplayerDebugLog.push('warn', 'LAN TX queued (not connected)', message.type);
      return;
    }
    this._writeRaw(message);
    multiplayerDebugLog.push(
      'tx',
      message.type,
      message.data ? JSON.stringify(message.data) : undefined,
    );
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    };
  }

  getRole(): 'host' | 'joiner' | null {
    return this.role;
  }

  isConnectedToLAN(): boolean {
    return this.isConnected;
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  private _attachSocketHandlers(): void {
    const sock = this.socket as {
      on(event: string, cb: (data: Buffer | string) => void): void;
    } & {
      on(event: 'close', cb: (hadError: boolean) => void): void;
    } & {
      on(event: 'error', cb: (err: Error) => void): void;
    };

    sock.on('data', (raw: Buffer | string) => {
      const text = typeof raw === 'string' ? raw : raw.toString('utf8');
      this._handleData(text);
    });

    (
      this.socket as {
        on(event: 'close', cb: (hadError: boolean) => void): void;
      }
    ).on('close', () => {
      multiplayerDebugLog.push('event', 'TCP socket closed');
      if (this.isConnected) this._peerLeft();
    });

    (
      this.socket as {
        on(event: 'error', cb: (err: Error) => void): void;
      }
    ).on('error', (err: Error) => {
      multiplayerDebugLog.push('error', 'TCP socket error', String(err));
    });
  }

  private _writeRaw(message: Message): void {
    try {
      const line = JSON.stringify(message) + '\n';
      (this.socket as { write(data: string, encoding: string): void }).write(line, 'utf8');
    } catch (e) {
      multiplayerDebugLog.push('error', `LAN TX ${message.type} failed`, String(e));
    }
  }

  private _handleData(text: string): void {
    this.buffer += text;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) this._handleLine(trimmed);
    }
  }

  private _handleLine(line: string): void {
    try {
      const message = JSON.parse(line) as Message;
      multiplayerDebugLog.push(
        'rx',
        message.type,
        message.data ? JSON.stringify(message.data) : undefined,
      );

      if (message.type === 'HELLO') {
        this._handleHello(message);
        return;
      }

      if (this.handshakeState !== 'complete') {
        multiplayerDebugLog.push('warn', `dropped pre-handshake ${message.type}`);
        return;
      }

      this.messageHandlers.forEach(h => h(message));
    } catch (e) {
      multiplayerDebugLog.push('error', 'LAN RX parse failed', String(e));
    }
  }

  private _handleHello(message: Message): void {
    const data = message.data ?? {};
    const magic = data.magic;
    const version = data.protocolVersion;
    const peerName = typeof data.captainName === 'string' ? data.captainName : '';

    if (magic !== MULTIPLAYER_HELLO_MAGIC) {
      multiplayerDebugLog.push('error', 'HELLO rejected', `bad magic: ${String(magic)}`);
      this._failHandshake(new Error('Invalid HELLO magic'));
      return;
    }
    if (version !== MULTIPLAYER_PROTOCOL_VERSION) {
      multiplayerDebugLog.push('error', 'HELLO rejected', `version mismatch: ${String(version)}`);
      this._failHandshake(new Error('Protocol version mismatch'));
      return;
    }

    multiplayerDebugLog.push('info', 'HELLO accepted', `peer "${peerName}"`);

    if (this.role === 'host') {
      // Reply with our own HELLO, promote the link.
      this._writeRaw({
        type: 'HELLO',
        data: {
          magic: MULTIPLAYER_HELLO_MAGIC,
          protocolVersion: MULTIPLAYER_PROTOCOL_VERSION,
          captainName: this.localCaptainName,
        },
      });
      this.isConnected = true;
      this._succeedHandshake(peerName);
      this._flushQueue();
      this.onCentralConnectedCb?.(peerName);
    } else {
      // Joiner — host's echo resolves connect().
      this._succeedHandshake(peerName);
    }
  }

  private _startHandshakeAwait(): Promise<string> {
    this._clearHandshakeTimer();
    this.handshakeState = 'awaiting';
    return new Promise<string>((resolve, reject) => {
      this.handshakeResolve = resolve;
      this.handshakeReject = reject;
      this.handshakeTimer = setTimeout(() => {
        multiplayerDebugLog.push(
          'error',
          'LAN HELLO timeout',
          `no valid HELLO within ${MULTIPLAYER_HELLO_TIMEOUT_MS}ms`,
        );
        this._failHandshake(new Error('HELLO timeout'));
      }, MULTIPLAYER_HELLO_TIMEOUT_MS);
    });
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

  private _flushQueue(): void {
    const queued = this.messageQueue;
    this.messageQueue = [];
    for (const msg of queued) {
      this.sendMessage(msg).catch(e => multiplayerDebugLog.push('error', 'LAN flush failed', String(e)));
    }
  }

  private _peerLeft(): void {
    this._teardown();
    this.onDisconnectCb?.();
  }

  private _teardown(): void {
    this._abortHandshake('teardown');
    try {
      (this.socket as { destroy(): void } | null)?.destroy();
    } catch {
      // ignore
    }
    this.socket = null;
    this.isConnected = false;
    this.role = null;
    this.buffer = '';
    this.messageQueue = [];
  }
}

export const lanService = new LanService();
