import { MDNS_SERVICE_TYPE, MULTIPLAYER_HELLO_TIMEOUT_MS, TCP_PORT } from '@/constants/multiplayer';
import TcpSocket from 'react-native-tcp-socket';
import Zeroconf from 'react-native-zeroconf';
import { multiplayerDebugLog } from './multiplayer-debug-log';
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
  type MultiplayerEventHandler,
  type MultiplayerMessage,
} from './protocol';

// Zeroconf expects type and protocol split out from the service type string.
const [ZEROCONF_TYPE, ZEROCONF_PROTOCOL] = MDNS_SERVICE_TYPE.replace(/^_/, '').split('._');
const ZEROCONF_DOMAIN = 'local.';

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
  private buffer = new NdjsonBuffer();
  private messageQueue = new MessageQueue();
  private emitter = new MessageEmitter();
  private resolvedPeers = new Map<string, ResolvedPeer>();
  private zeroconfListenersBound = false;

  private handshake = new Handshake({
    onTimeout: () =>
      multiplayerDebugLog.push(
        'error',
        'LAN HELLO timeout',
        `no valid HELLO within ${MULTIPLAYER_HELLO_TIMEOUT_MS}ms`,
      ),
    onFail: () =>
      this.disconnect().catch(e =>
        multiplayerDebugLog.push('warn', 'disconnect during handshake fail', String(e)),
      ),
  });

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
      this.handshake
        .start()
        .catch(e => multiplayerDebugLog.push('warn', 'host handshake aborted', String(e)));
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

    this.zeroconf.publishService(
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
    this.zeroconf.unpublishService(this.localCaptainName);
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

    // Bound once for the life of the instance: the handlers read
    // onDeviceFoundCb at call time, and re-registering per scan would stack
    // duplicates (nothing removes them — see stopScanning).
    if (!this.zeroconfListenersBound) {
      this.zeroconfListenersBound = true;

      this.zeroconf.on('resolved', (service: Record<string, unknown>) => {
        const name = String(service.name ?? '');
        const host = String((service.addresses as string[] | undefined)?.[0] ?? service.host ?? '');
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
    }

    this.zeroconf.scan(ZEROCONF_TYPE, ZEROCONF_PROTOCOL, ZEROCONF_DOMAIN);
    this.isScanning = true;
    multiplayerDebugLog.push('info', 'LAN scanning started');
  }

  async stopScanning(): Promise<void> {
    if (!this.isScanning) return;
    this.zeroconf.stop();
    // Deliberately not removeDeviceListeners(): that tears down the native
    // event bridges the Zeroconf constructor installs and nothing re-adds
    // them, so every later scan would run but never resolve a service.
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
      this.socket = TcpSocket.createConnection({ port: peer.port, host: peer.host }, () => {
        multiplayerDebugLog.push('info', 'TCP connected');
        resolve();
      });
      (this.socket as { on(event: string, cb: (e: Error) => void): void }).on(
        'error',
        (err: Error) => {
          multiplayerDebugLog.push('error', 'TCP connect error', String(err));
          reject(err);
        },
      );
    });

    this._attachSocketHandlers();

    const helloPromise = this.handshake.start();
    this._writeRaw(buildHello(captainName));
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

  async sendMessage(message: MultiplayerMessage): Promise<void> {
    if (!this.isConnected) {
      this.messageQueue.push(message);
      multiplayerDebugLog.push('warn', 'LAN TX queued (not connected)', message.type);
      return;
    }
    this._writeRaw(message);
    multiplayerDebugLog.push('tx', message.type, describePayload(message));
  }

  onMessage(handler: MultiplayerEventHandler): () => void {
    return this.emitter.subscribe(handler);
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
      on(event: string, cb: (data: Uint8Array | string) => void): void;
    } & {
      on(event: 'close', cb: (hadError: boolean) => void): void;
    } & {
      on(event: 'error', cb: (err: Error) => void): void;
    };

    sock.on('data', (raw: Uint8Array | string) => {
      const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
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

  private _writeRaw(message: MultiplayerMessage): void {
    try {
      (this.socket as { write(data: string, encoding: string): void }).write(
        encodeNdjson(message),
        'utf8',
      );
    } catch (e) {
      multiplayerDebugLog.push('error', `LAN TX ${message.type} failed`, String(e));
    }
  }

  private _handleData(text: string): void {
    for (const line of this.buffer.push(text)) this._handleLine(line);
  }

  private _handleLine(line: string): void {
    const message = parseMessage(line);
    if (!message) {
      multiplayerDebugLog.push('error', 'LAN RX parse failed', line.slice(0, 120));
      return;
    }

    multiplayerDebugLog.push('rx', message.type, describePayload(message));

    if (message.type === 'HELLO') {
      this._handleHello(message);
      return;
    }

    if (!this.handshake.isComplete()) {
      multiplayerDebugLog.push('warn', `dropped pre-handshake ${message.type}`);
      return;
    }

    this.emitter.emit(message);
  }

  private _handleHello(message: MultiplayerMessage): void {
    const result = validateHello(message);
    if (!result.ok) {
      multiplayerDebugLog.push('error', 'HELLO rejected', result.detail);
      this.handshake.fail(
        new Error(result.reason === 'magic' ? 'Invalid HELLO magic' : 'Protocol version mismatch'),
      );
      return;
    }

    multiplayerDebugLog.push('info', 'HELLO accepted', `peer "${result.peerName}"`);

    if (this.role === 'host') {
      // Reply with our own HELLO, promote the link.
      this._writeRaw(buildHello(this.localCaptainName));
      this.isConnected = true;
      this.handshake.succeed(result.peerName);
      this._flushQueue();
      this.onCentralConnectedCb?.(result.peerName);
    } else {
      // Joiner — host's echo resolves connect().
      this.handshake.succeed(result.peerName);
    }
  }

  private _flushQueue(): void {
    for (const msg of this.messageQueue.drain()) {
      this.sendMessage(msg).catch(e =>
        multiplayerDebugLog.push('error', 'LAN flush failed', String(e)),
      );
    }
  }

  private _peerLeft(): void {
    this._teardown();
    this.onDisconnectCb?.();
  }

  private _teardown(): void {
    this.handshake.abort('teardown');
    try {
      (this.socket as { destroy(): void } | null)?.destroy();
    } catch {
      // ignore
    }
    this.socket = null;
    this.isConnected = false;
    this.role = null;
    this.buffer.reset();
    this.messageQueue.clear();
    // Discovery is still live here when the peer vanished mid-session (the
    // joiner never stops scanning once connected). Leaving the flags set makes
    // the next startScanning/startAdvertising a silent no-op.
    void this.stopAdvertising();
    void this.stopScanning();
  }
}

export const lanService = new LanService();
