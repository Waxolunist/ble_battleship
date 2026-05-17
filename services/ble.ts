import {
  BLE_ADVERTISEMENT_MAGIC,
  BLE_HELLO_MAGIC,
  BLE_HELLO_TIMEOUT_MS,
  BLE_PROTOCOL_VERSION,
  BLE_RX_CHARACTERISTIC_UUID,
  BLE_SERVICE_UUID,
  BLE_TX_CHARACTERISTIC_UUID,
} from '@/constants/ble';
import { bleDebugLog } from './ble-debug-log';

// Lazy-load munim-bluetooth (native module, only available on iOS/Android after build)
type MunimBLE = typeof import('munim-bluetooth');
let BLE: MunimBLE | null = null;
let bleLoaded = false;

const getBLE = (): MunimBLE | null => {
  if (bleLoaded) return BLE;
  bleLoaded = true;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    BLE = require('munim-bluetooth') as MunimBLE;
    console.log('[BLE] munim-bluetooth loaded');
    bleDebugLog.push('info', 'native module loaded');
  } catch {
    console.log('[BLE] munim-bluetooth not available (expected on web/development)');
    bleDebugLog.push('warn', 'native module unavailable', 'web/Expo Go fallback');
    BLE = null;
  }

  return BLE;
};

export type BLEMessageType =
  | 'HELLO'
  | 'FLEET_READY'
  | 'FIRE'
  | 'SHOT_RESULT'
  | 'GAME_OVER'
  | 'REMATCH'
  | 'BYE';

export interface BLEMessage {
  type: BLEMessageType;
  data?: Record<string, any>;
}

export type BLERole = 'host' | 'joiner';

export type BLEEventHandler = (message: BLEMessage) => void;

interface DeviceFoundPayload {
  id: string;
  name?: string;
  advertisingData?: {
    manufacturerData?: string;
  };
}

interface CharacteristicChangedPayload {
  deviceId: string;
  serviceUUID: string;
  characteristicUUID: string;
  value: string;
}

interface PeripheralWritePayload {
  centralId: string;
  serviceUUID: string;
  characteristicUUID: string;
  value: string;
}

interface PeripheralSubscribePayload {
  centralId: string;
  serviceUUID: string;
  characteristicUUID: string;
}

interface DeviceDisconnectedPayload {
  deviceId: string;
}

const bytesToHex = (bytes: number[] | Uint8Array): string => {
  const arr = bytes instanceof Uint8Array ? Array.from(bytes) : bytes;
  return arr.map(b => (b & 0xff).toString(16).padStart(2, '0')).join('');
};

const hexToBytes = (hex: string): number[] => {
  const bytes: number[] = [];
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  for (let i = 0; i < clean.length; i += 2) {
    bytes.push(parseInt(clean.slice(i, i + 2), 16));
  }
  return bytes;
};

const stringToHex = (str: string): string => {
  const encoder = new TextEncoder();
  return bytesToHex(Array.from(encoder.encode(str)));
};

const hexToString = (hex: string): string => {
  const bytes = hexToBytes(hex);
  const decoder = new TextDecoder();
  return decoder.decode(new Uint8Array(bytes));
};

const sameUUID = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * BLE Communication Service.
 *
 * Host = peripheral: setServices() + startAdvertising(). Receives joiner writes via
 * the `peripheralWriteRequest` event; pushes data to the joiner via
 * `updateCharacteristicValue(...notify=true)` on the TX characteristic.
 *
 * Joiner = central: startScan() → connect → subscribeToCharacteristic on TX.
 * Receives via `characteristicValueChanged`, sends via writeCharacteristic on RX.
 */
class BLEService {
  private isAdvertising = false;
  private isScanning = false;
  private isConnected = false;
  private role: BLERole | null = null;
  private connectedDeviceId: string | null = null;
  private subscribedCentralId: string | null = null;
  private eventHandlers: BLEEventHandler[] = [];
  private messageQueue: BLEMessage[] = [];
  private localCaptainName = '';

  // HELLO handshake state. We don't trust an OS-level subscribe — only after
  // both sides exchange a HELLO with BLE_HELLO_MAGIC do we expose the link.
  private handshakeState: 'idle' | 'awaiting' | 'complete' = 'idle';
  private handshakeTimer: ReturnType<typeof setTimeout> | null = null;
  private handshakeResolve: ((peerName: string) => void) | null = null;
  private handshakeReject: ((err: Error) => void) | null = null;

  private deviceFoundUnsub: (() => void) | null = null;
  private valueChangedUnsub: (() => void) | null = null;
  private deviceDisconnectedUnsub: (() => void) | null = null;
  private peripheralWriteUnsub: (() => void) | null = null;
  private peripheralSubscribedUnsub: (() => void) | null = null;
  private peripheralUnsubscribedUnsub: (() => void) | null = null;

  private onDeviceFound: ((id: string, name: string) => void) | null = null;
  private onDisconnect: (() => void) | null = null;
  private onCentralConnected: ((peerName: string) => void) | null = null;

  /**
   * Host: register the GATT service (TX notify + RX write) and start advertising
   * the captain name in manufacturer data.
   */
  async startAdvertising(captainName: string): Promise<void> {
    if (this.isAdvertising) {
      bleDebugLog.push('warn', 'startAdvertising skipped', 'already advertising');
      return;
    }

    const ble = getBLE();
    if (!ble) {
      console.warn('[BLE] munim-bluetooth not available');
      bleDebugLog.push('error', 'startAdvertising aborted', 'native module unavailable');
      return;
    }

    bleDebugLog.push('event', 'startAdvertising →', `captain "${captainName}"`);
    this.localCaptainName = captainName;

    try {
      ble.setServices([
        {
          uuid: BLE_SERVICE_UUID,
          characteristics: [
            {
              uuid: BLE_TX_CHARACTERISTIC_UUID,
              properties: ['notify', 'read'],
            },
            {
              uuid: BLE_RX_CHARACTERISTIC_UUID,
              properties: ['write', 'writeWithoutResponse'],
            },
          ],
        },
      ]);

      this.peripheralWriteUnsub?.();
      this.peripheralWriteUnsub = ble.addEventListener(
        'peripheralWriteRequest',
        (payload: PeripheralWritePayload) => {
          if (sameUUID(payload.characteristicUUID, BLE_RX_CHARACTERISTIC_UUID)) {
            bleDebugLog.push('event', 'peripheralWriteRequest', `central ${payload.centralId}`);
            this._handleIncomingHex(payload.value);
          }
        },
      );

      this.peripheralSubscribedUnsub?.();
      this.peripheralSubscribedUnsub = ble.addEventListener(
        'peripheralSubscribed',
        (payload: PeripheralSubscribePayload) => {
          if (sameUUID(payload.characteristicUUID, BLE_TX_CHARACTERISTIC_UUID)) {
            const firstSubscription = !this.subscribedCentralId;
            this.subscribedCentralId = payload.centralId;
            bleDebugLog.push(
              'event',
              firstSubscription ? 'central subscribed (awaiting HELLO)' : 'central re-subscribed',
              payload.centralId,
            );
            if (firstSubscription) {
              // Don't trust the link yet — wait for HELLO. _handleIncomingHello
              // will fire onCentralConnected and flush the queue once the
              // peer proves it's a real game client.
              this._startHandshakeAwait().catch(e => {
                bleDebugLog.push('warn', 'host handshake aborted', String(e));
              });
            }
          }
        },
      );

      this.peripheralUnsubscribedUnsub?.();
      this.peripheralUnsubscribedUnsub = ble.addEventListener(
        'peripheralUnsubscribed',
        (payload: PeripheralSubscribePayload) => {
          if (
            sameUUID(payload.characteristicUUID, BLE_TX_CHARACTERISTIC_UUID) &&
            payload.centralId === this.subscribedCentralId
          ) {
            bleDebugLog.push('event', 'central unsubscribed', payload.centralId);
            this._handlePeerLeft();
          }
        },
      );

      const nameHex = stringToHex(captainName.slice(0, 16));
      const magicHex = bytesToHex(BLE_ADVERTISEMENT_MAGIC);
      const manufacturerDataHex = magicHex + nameHex;

      ble.startAdvertising({
        serviceUUIDs: [BLE_SERVICE_UUID],
        localName: captainName.slice(0, 16),
        manufacturerData: manufacturerDataHex,
      });

      this.isAdvertising = true;
      this.role = 'host';
      console.log('[BLE] Started advertising as host:', captainName);
      bleDebugLog.push('info', 'advertising started', `as "${captainName}" (host)`);
    } catch (error) {
      console.error('[BLE] Failed to start advertising:', error);
      bleDebugLog.push('error', 'startAdvertising failed', String(error));
      throw error;
    }
  }

  async stopAdvertising(): Promise<void> {
    if (!this.isAdvertising) return;
    const ble = getBLE();
    try {
      ble?.stopAdvertising();
      this.peripheralWriteUnsub?.();
      this.peripheralWriteUnsub = null;
      this.peripheralSubscribedUnsub?.();
      this.peripheralSubscribedUnsub = null;
      this.peripheralUnsubscribedUnsub?.();
      this.peripheralUnsubscribedUnsub = null;
      this.subscribedCentralId = null;
      this.isAdvertising = false;
      if (this.role === 'host') {
        this.isConnected = false;
        this.role = null;
      }
      console.log('[BLE] Stopped advertising');
      bleDebugLog.push('info', 'advertising stopped');
    } catch (error) {
      console.error('[BLE] Failed to stop advertising:', error);
      bleDebugLog.push('error', 'stopAdvertising failed', String(error));
      throw error;
    }
  }

  /**
   * Joiner: scan for hosts advertising the Hulls & Hellfire service. Decodes
   * captain name from the manufacturer-data magic prefix.
   */
  async startScanning(onDeviceFound: (id: string, name: string) => void): Promise<void> {
    if (this.isScanning) {
      bleDebugLog.push('warn', 'startScanning skipped', 'already scanning');
      return;
    }
    const ble = getBLE();
    if (!ble) {
      console.warn('[BLE] munim-bluetooth not available');
      bleDebugLog.push('error', 'startScanning aborted', 'native module unavailable');
      return;
    }

    bleDebugLog.push('event', 'startScanning →', BLE_SERVICE_UUID);

    try {
      this.onDeviceFound = onDeviceFound;
      this.deviceFoundUnsub?.();
      this.deviceFoundUnsub = ble.addDeviceFoundListener((device: DeviceFoundPayload) => {
        const name = this._extractCaptainName(device);
        if (name !== null) {
          bleDebugLog.push('event', 'device found', `${name || '(unnamed)'} · ${device.id}`);
          this.onDeviceFound?.(device.id, name);
        } else {
          bleDebugLog.push(
            'event',
            'device seen (ignored — no magic prefix)',
            `${device.name ?? '?'} · ${device.id}`,
          );
        }
      });

      ble.startScan({
        serviceUUIDs: [BLE_SERVICE_UUID],
        allowDuplicates: false,
        scanMode: 'lowLatency',
      });

      this.isScanning = true;
      console.log('[BLE] Started scanning for devices');
      bleDebugLog.push('info', 'scanning started');
    } catch (error) {
      console.error('[BLE] Failed to start scanning:', error);
      bleDebugLog.push('error', 'startScanning failed', String(error));
      throw error;
    }
  }

  async stopScanning(): Promise<void> {
    if (!this.isScanning) return;
    const ble = getBLE();
    try {
      ble?.stopScan();
      this.deviceFoundUnsub?.();
      this.deviceFoundUnsub = null;
      this.onDeviceFound = null;
      this.isScanning = false;
      console.log('[BLE] Stopped scanning');
      bleDebugLog.push('info', 'scanning stopped');
    } catch (error) {
      console.error('[BLE] Failed to stop scanning:', error);
      bleDebugLog.push('error', 'stopScanning failed', String(error));
      throw error;
    }
  }

  /**
   * Joiner: connect to a host, discover services, subscribe to its TX
   * characteristic for inbound notifications.
   */
  /**
   * Joiner: connect, subscribe to TX, then exchange HELLO with the host
   * before treating the link as a real game session. Returns the peer's
   * captain name once the handshake completes. Throws if HELLO doesn't
   * arrive within BLE_HELLO_TIMEOUT_MS.
   */
  async connect(deviceId: string, captainName: string): Promise<string> {
    if (this.isConnected) {
      bleDebugLog.push('warn', 'connect skipped', 'already connected');
      return '';
    }
    const ble = getBLE();
    if (!ble) {
      console.warn('[BLE] munim-bluetooth not available');
      bleDebugLog.push('error', 'connect aborted', 'native module unavailable');
      return '';
    }

    bleDebugLog.push('event', 'connect →', deviceId);
    this.localCaptainName = captainName;

    try {
      await ble.connect(deviceId);
      bleDebugLog.push('info', 'connected', deviceId);
      await ble.discoverServices(deviceId);
      bleDebugLog.push('info', 'services discovered');

      this.valueChangedUnsub?.();
      this.valueChangedUnsub = ble.addEventListener(
        'characteristicValueChanged',
        (payload: CharacteristicChangedPayload) => {
          if (
            payload.deviceId === deviceId &&
            sameUUID(payload.characteristicUUID, BLE_TX_CHARACTERISTIC_UUID)
          ) {
            this._handleIncomingHex(payload.value);
          }
        },
      );

      this.deviceDisconnectedUnsub?.();
      this.deviceDisconnectedUnsub = ble.addEventListener(
        'deviceDisconnected',
        (payload: DeviceDisconnectedPayload) => {
          if (payload.deviceId === deviceId) {
            bleDebugLog.push('event', 'device disconnected', deviceId);
            this._handlePeerLeft();
          }
        },
      );

      ble.subscribeToCharacteristic(deviceId, BLE_SERVICE_UUID, BLE_TX_CHARACTERISTIC_UUID);
      bleDebugLog.push('info', 'subscribed to TX (sending HELLO)');

      // Role + device id must be set before _writeMessage, so the write
      // routes through the joiner's writeCharacteristic path.
      this.connectedDeviceId = deviceId;
      this.role = 'joiner';

      // Send HELLO, then wait for the host's HELLO reply. _handleIncomingHello
      // resolves the promise once the host echoes back with valid magic.
      const helloPromise = this._startHandshakeAwait();
      await this._writeMessage({
        type: 'HELLO',
        data: {
          magic: BLE_HELLO_MAGIC,
          protocolVersion: BLE_PROTOCOL_VERSION,
          captainName,
        },
      });
      bleDebugLog.push('info', 'HELLO sent, awaiting reply');

      const peerName = await helloPromise;
      this.isConnected = true;
      this._flushQueue();
      bleDebugLog.push('info', 'handshake complete', `host "${peerName}"`);
      console.log('[BLE] Connected to device:', deviceId);
      return peerName;
    } catch (error) {
      console.error('[BLE] Failed to connect:', error);
      bleDebugLog.push('error', 'connect failed', String(error));
      throw error;
    }
  }

  setOnDisconnect(handler: (() => void) | null): void {
    this.onDisconnect = handler;
  }

  setOnCentralConnected(handler: ((peerName: string) => void) | null): void {
    this.onCentralConnected = handler;
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected && !this.isAdvertising) return;

    bleDebugLog.push('event', 'disconnect →', this.role ?? 'unknown role');

    const ble = getBLE();
    try {
      if (this.role === 'joiner' && ble && this.connectedDeviceId) {
        try {
          ble.unsubscribeFromCharacteristic(
            this.connectedDeviceId,
            BLE_SERVICE_UUID,
            BLE_TX_CHARACTERISTIC_UUID,
          );
        } catch (e) {
          console.warn('[BLE] unsubscribe failed (ignoring):', e);
          bleDebugLog.push('warn', 'unsubscribe failed (ignored)', String(e));
        }
        ble.disconnect(this.connectedDeviceId);
      }
      if (this.role === 'host') {
        // Stop advertising too — host-side disconnect should also tear the link down.
        await this.stopAdvertising();
      }
      this._teardownConnection();
      console.log('[BLE] Disconnected');
      bleDebugLog.push('info', 'disconnected');
    } catch (error) {
      console.error('[BLE] Failed to disconnect:', error);
      bleDebugLog.push('error', 'disconnect failed', String(error));
      throw error;
    }
  }

  private _teardownConnection(): void {
    this.valueChangedUnsub?.();
    this.valueChangedUnsub = null;
    this.deviceDisconnectedUnsub?.();
    this.deviceDisconnectedUnsub = null;
    this.isConnected = false;
    this.connectedDeviceId = null;
    this.subscribedCentralId = null;
    this.role = null;
    this.messageQueue = [];
    this._abortHandshake('teardown');
  }

  private _handlePeerLeft(): void {
    console.log('[BLE] Peer disconnected');
    this._teardownConnection();
    this.onDisconnect?.();
  }

  /**
   * Start the HELLO handshake window. The returned promise resolves with the
   * peer's captain name when a valid HELLO arrives, or rejects after
   * BLE_HELLO_TIMEOUT_MS.
   */
  private _startHandshakeAwait(): Promise<string> {
    this._clearHandshakeTimer();
    this.handshakeState = 'awaiting';
    return new Promise<string>((resolve, reject) => {
      this.handshakeResolve = resolve;
      this.handshakeReject = reject;
      this.handshakeTimer = setTimeout(() => {
        bleDebugLog.push(
          'error',
          'HELLO timeout',
          `no valid HELLO within ${BLE_HELLO_TIMEOUT_MS}ms — dropping link`,
        );
        this._failHandshake(new Error('HELLO timeout'));
      }, BLE_HELLO_TIMEOUT_MS);
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
    // Drop the suspicious link. Host: stop advertising too — the bogus
    // central is occupying our connection slot.
    this.disconnect().catch(e => bleDebugLog.push('warn', 'disconnect during fail', String(e)));
    reject?.(err);
  }

  /** Cancel any in-flight handshake without rejecting (used during teardown). */
  private _abortHandshake(reason: string): void {
    if (this.handshakeState === 'idle') return;
    const reject = this.handshakeReject;
    this._clearHandshakeTimer();
    this.handshakeState = 'idle';
    this.handshakeResolve = null;
    this.handshakeReject = null;
    reject?.(new Error(`handshake aborted: ${reason}`));
  }

  /** Write a message to the peer regardless of handshake state. */
  private async _writeMessage(message: BLEMessage): Promise<void> {
    const ble = getBLE();
    if (!ble) return;
    const json = JSON.stringify(message);
    const hex = stringToHex(json);
    if (this.role === 'host') {
      await ble.updateCharacteristicValue(BLE_SERVICE_UUID, BLE_TX_CHARACTERISTIC_UUID, hex, true);
    } else if (this.role === 'joiner' && this.connectedDeviceId) {
      await ble.writeCharacteristic(
        this.connectedDeviceId,
        BLE_SERVICE_UUID,
        BLE_RX_CHARACTERISTIC_UUID,
        hex,
        'writeWithoutResponse',
      );
    }
  }

  /**
   * HELLO routing. Validates magic + protocol version, then:
   *   host  → echoes its own HELLO, raises onCentralConnected, flushes queue
   *   joiner → resolves the pending handshake promise from connect()
   * HELLO is consumed here and never propagates to the app-level handlers.
   */
  private _handleIncomingHello(message: BLEMessage): void {
    const data = message.data ?? {};
    const magic = data.magic;
    const version = data.protocolVersion;
    const peerName = typeof data.captainName === 'string' ? data.captainName : '';

    if (magic !== BLE_HELLO_MAGIC) {
      bleDebugLog.push('error', 'HELLO rejected', `bad magic: ${String(magic)}`);
      this._failHandshake(new Error('Invalid HELLO magic'));
      return;
    }
    if (version !== BLE_PROTOCOL_VERSION) {
      bleDebugLog.push(
        'error',
        'HELLO rejected',
        `version mismatch: peer=${String(version)} local=${BLE_PROTOCOL_VERSION}`,
      );
      this._failHandshake(new Error('Protocol version mismatch'));
      return;
    }

    bleDebugLog.push('info', 'HELLO accepted', `peer "${peerName}"`);

    if (this.role === 'host') {
      // Reply with our HELLO, then promote the link.
      this._writeMessage({
        type: 'HELLO',
        data: {
          magic: BLE_HELLO_MAGIC,
          protocolVersion: BLE_PROTOCOL_VERSION,
          captainName: this.localCaptainName,
        },
      }).catch(e => bleDebugLog.push('error', 'HELLO response failed', String(e)));

      this.isConnected = true;
      this._succeedHandshake(peerName);
      this._flushQueue();
      this.onCentralConnected?.(peerName);
    } else if (this.role === 'joiner') {
      // Host's reply — connect() is awaiting this.
      this._succeedHandshake(peerName);
    }
  }

  /**
   * Send a message to the connected peer. Direction depends on role:
   * - host: updateCharacteristicValue on TX (notifies subscribed joiner)
   * - joiner: writeCharacteristic on RX (write-without-response)
   */
  async sendMessage(message: BLEMessage): Promise<void> {
    if (!this.isConnected) {
      this.messageQueue.push(message);
      bleDebugLog.push('warn', 'TX queued (not connected)', message.type);
      return;
    }
    if (!this.role) {
      console.warn('[BLE] sendMessage called with no active role');
      bleDebugLog.push('error', 'TX aborted', `no active role for ${message.type}`);
      return;
    }

    try {
      await this._writeMessage(message);
      console.log('[BLE] Sent message:', message.type);
      bleDebugLog.push('tx', message.type, message.data ? JSON.stringify(message.data) : undefined);
    } catch (error) {
      console.error('[BLE] Failed to send message:', error);
      bleDebugLog.push('error', `TX ${message.type} failed`, String(error));
      throw error;
    }
  }

  private _flushQueue(): void {
    const queued = this.messageQueue;
    this.messageQueue = [];
    for (const msg of queued) {
      this.sendMessage(msg).catch(e => console.error('[BLE] flush failed:', e));
    }
  }

  onMessage(handler: BLEEventHandler): () => void {
    this.eventHandlers.push(handler);
    return () => {
      this.eventHandlers = this.eventHandlers.filter(h => h !== handler);
    };
  }

  getRole(): BLERole | null {
    return this.role;
  }

  isConnectedToBLE(): boolean {
    return this.isConnected;
  }

  getConnectedDeviceId(): string | null {
    return this.connectedDeviceId;
  }

  /** Extract captain name from manufacturer data (magic prefix + UTF-8 name). */
  private _extractCaptainName(device: DeviceFoundPayload): string | null {
    const mfgHex = device.advertisingData?.manufacturerData;
    if (!mfgHex) return device.name ?? null;
    const bytes = hexToBytes(mfgHex);
    if (bytes.length < 4) return device.name ?? null;
    const magic = Array.from(BLE_ADVERTISEMENT_MAGIC);
    const startsWithMagic = bytes.slice(0, 4).every((b, i) => b === magic[i]);
    if (!startsWithMagic) return null;
    if (bytes.length === 4) return device.name ?? '';
    const nameHex = bytesToHex(bytes.slice(4));
    try {
      return hexToString(nameHex);
    } catch {
      return device.name ?? '';
    }
  }

  private _handleIncomingHex(hex: string): void {
    try {
      const json = hexToString(hex);
      const message = JSON.parse(json) as BLEMessage;
      bleDebugLog.push('rx', message.type, message.data ? JSON.stringify(message.data) : undefined);

      // HELLO is consumed by the handshake layer and never propagates upward.
      if (message.type === 'HELLO') {
        this._handleIncomingHello(message);
        return;
      }

      // Drop any non-HELLO traffic that arrives before the handshake completes.
      // A real game peer never sends FLEET_READY/FIRE/etc. before HELLO; a
      // generic scanner that subscribed and then started fuzzing the RX
      // characteristic gets quietly ignored.
      if (this.handshakeState !== 'complete') {
        bleDebugLog.push('warn', `dropped pre-handshake ${message.type}`, 'no HELLO yet');
        return;
      }

      this._emitMessage(message);
    } catch (e) {
      console.error('[BLE] Failed to parse incoming message:', e);
      bleDebugLog.push('error', 'RX parse failed', String(e));
    }
  }

  private _emitMessage(message: BLEMessage): void {
    this.eventHandlers.forEach(handler => handler(message));
  }

  /** Test/mock hook — simulate receiving a BLE message. */
  _simulateMessage(message: BLEMessage): void {
    this._emitMessage(message);
  }
}

export const bleService = new BLEService();
