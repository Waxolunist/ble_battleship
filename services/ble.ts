import {
  BLE_ADVERTISEMENT_MAGIC,
  BLE_RX_CHARACTERISTIC_UUID,
  BLE_SERVICE_UUID,
  BLE_TX_CHARACTERISTIC_UUID,
} from '@/constants/ble';

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
  } catch {
    console.log('[BLE] munim-bluetooth not available (expected on web/development)');
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

  private deviceFoundUnsub: (() => void) | null = null;
  private valueChangedUnsub: (() => void) | null = null;
  private deviceDisconnectedUnsub: (() => void) | null = null;
  private peripheralWriteUnsub: (() => void) | null = null;
  private peripheralSubscribedUnsub: (() => void) | null = null;
  private peripheralUnsubscribedUnsub: (() => void) | null = null;

  private onDeviceFound: ((id: string, name: string) => void) | null = null;
  private onDisconnect: (() => void) | null = null;
  private onCentralConnected: (() => void) | null = null;

  /**
   * Host: register the GATT service (TX notify + RX write) and start advertising
   * the captain name in manufacturer data.
   */
  async startAdvertising(captainName: string): Promise<void> {
    if (this.isAdvertising) return;

    const ble = getBLE();
    if (!ble) {
      console.warn('[BLE] munim-bluetooth not available');
      return;
    }

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
            this.isConnected = true;
            if (firstSubscription) {
              this._flushQueue();
              this.onCentralConnected?.();
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
    } catch (error) {
      console.error('[BLE] Failed to start advertising:', error);
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
    } catch (error) {
      console.error('[BLE] Failed to stop advertising:', error);
      throw error;
    }
  }

  /**
   * Joiner: scan for hosts advertising the Hulls & Hellfire service. Decodes
   * captain name from the manufacturer-data magic prefix.
   */
  async startScanning(onDeviceFound: (id: string, name: string) => void): Promise<void> {
    if (this.isScanning) return;
    const ble = getBLE();
    if (!ble) {
      console.warn('[BLE] munim-bluetooth not available');
      return;
    }

    try {
      this.onDeviceFound = onDeviceFound;
      this.deviceFoundUnsub?.();
      this.deviceFoundUnsub = ble.addDeviceFoundListener((device: DeviceFoundPayload) => {
        const name = this._extractCaptainName(device);
        if (name !== null) {
          this.onDeviceFound?.(device.id, name);
        }
      });

      ble.startScan({
        serviceUUIDs: [BLE_SERVICE_UUID],
        allowDuplicates: false,
        scanMode: 'lowLatency',
      });

      this.isScanning = true;
      console.log('[BLE] Started scanning for devices');
    } catch (error) {
      console.error('[BLE] Failed to start scanning:', error);
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
    } catch (error) {
      console.error('[BLE] Failed to stop scanning:', error);
      throw error;
    }
  }

  /**
   * Joiner: connect to a host, discover services, subscribe to its TX
   * characteristic for inbound notifications.
   */
  async connect(deviceId: string): Promise<void> {
    if (this.isConnected) return;
    const ble = getBLE();
    if (!ble) {
      console.warn('[BLE] munim-bluetooth not available');
      return;
    }

    try {
      await ble.connect(deviceId);
      await ble.discoverServices(deviceId);

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
            this._handlePeerLeft();
          }
        },
      );

      ble.subscribeToCharacteristic(deviceId, BLE_SERVICE_UUID, BLE_TX_CHARACTERISTIC_UUID);

      this.isConnected = true;
      this.connectedDeviceId = deviceId;
      this.role = 'joiner';

      this._flushQueue();
      console.log('[BLE] Connected to device:', deviceId);
    } catch (error) {
      console.error('[BLE] Failed to connect:', error);
      throw error;
    }
  }

  setOnDisconnect(handler: (() => void) | null): void {
    this.onDisconnect = handler;
  }

  setOnCentralConnected(handler: (() => void) | null): void {
    this.onCentralConnected = handler;
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected && !this.isAdvertising) return;

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
        }
        ble.disconnect(this.connectedDeviceId);
      }
      if (this.role === 'host') {
        // Stop advertising too — host-side disconnect should also tear the link down.
        await this.stopAdvertising();
      }
      this._teardownConnection();
      console.log('[BLE] Disconnected');
    } catch (error) {
      console.error('[BLE] Failed to disconnect:', error);
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
  }

  private _handlePeerLeft(): void {
    console.log('[BLE] Peer disconnected');
    this._teardownConnection();
    this.onDisconnect?.();
  }

  /**
   * Send a message to the connected peer. Direction depends on role:
   * - host: updateCharacteristicValue on TX (notifies subscribed joiner)
   * - joiner: writeCharacteristic on RX (write-without-response)
   */
  async sendMessage(message: BLEMessage): Promise<void> {
    if (!this.isConnected) {
      this.messageQueue.push(message);
      return;
    }
    const ble = getBLE();
    if (!ble) return;

    const json = JSON.stringify(message);
    const hex = stringToHex(json);

    try {
      if (this.role === 'host') {
        await ble.updateCharacteristicValue(
          BLE_SERVICE_UUID,
          BLE_TX_CHARACTERISTIC_UUID,
          hex,
          true,
        );
      } else if (this.role === 'joiner' && this.connectedDeviceId) {
        await ble.writeCharacteristic(
          this.connectedDeviceId,
          BLE_SERVICE_UUID,
          BLE_RX_CHARACTERISTIC_UUID,
          hex,
          'writeWithoutResponse',
        );
      } else {
        console.warn('[BLE] sendMessage called with no active role');
        return;
      }
      console.log('[BLE] Sent message:', message.type);
    } catch (error) {
      console.error('[BLE] Failed to send message:', error);
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
      this._emitMessage(message);
    } catch (e) {
      console.error('[BLE] Failed to parse incoming message:', e);
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
