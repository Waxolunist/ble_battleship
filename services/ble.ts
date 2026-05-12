import {
  BLE_SERVICE_UUID,
  BLE_TX_CHARACTERISTIC_UUID,
  BLE_RX_CHARACTERISTIC_UUID,
  BLE_ADVERTISEMENT_MAGIC,
} from '@/constants/ble';

// Lazy-load munim-bluetooth (native module, only available on iOS/Android after build)
let BLE: any = null;
let bleLoaded = false;

const getBLE = () => {
  if (bleLoaded) return BLE;
  bleLoaded = true;

  try {
    // @ts-ignore - munim-bluetooth is a native module not in tsconfig
    const module = require('munim-bluetooth');
    BLE = module.BLE || module.default;
    if (BLE) {
      console.log('[BLE] munim-bluetooth loaded');
    }
  } catch (e) {
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

/**
 * BLE Communication Service
 * Uses munim-bluetooth for native BLE operations on iOS and Android.
 */
class BLEService {
  private isAdvertising = false;
  private isScanning = false;
  private isConnected = false;
  private role: BLERole | null = null;
  private connectedDeviceId: string | null = null;
  private eventHandlers: BLEEventHandler[] = [];
  private messageQueue: BLEMessage[] = [];
  private notificationUnsubscribe: (() => void) | null = null;

  /**
   * Start advertising as a BLE host with captain name in manufacturer field
   */
  async startAdvertising(captainName: string): Promise<void> {
    if (this.isAdvertising) return;

    try {
      const ble = getBLE();
      if (!ble) {
        console.warn('[BLE] munim-bluetooth not available');
        return;
      }

      const nameBytes = Array.from(captainName).map(c => c.charCodeAt(0));
      const manufacturerData = [...Array.from(BLE_ADVERTISEMENT_MAGIC), ...nameBytes];

      const advertisement = {
        serviceUUIDs: [BLE_SERVICE_UUID],
        manufacturerData: {
          id: 0xffff,
          data: manufacturerData,
        },
      };

      await ble.startAdvertising(BLE_SERVICE_UUID, advertisement);

      // Setup listener for incoming client writes
      ble.onCharacteristicWrite?.(
        (_peripheral: any, _service: any, characteristic: any, value: number[]) => {
          if (characteristic.uuid === BLE_RX_CHARACTERISTIC_UUID) {
            this._handleIncomingData(value);
          }
        },
      );

      this.isAdvertising = true;
      this.role = 'host';
      console.log('[BLE] Started advertising as host:', captainName);
    } catch (error) {
      console.error('[BLE] Failed to start advertising:', error);
      throw error;
    }
  }

  /**
   * Stop advertising
   */
  async stopAdvertising(): Promise<void> {
    if (!this.isAdvertising) return;

    try {
      const ble = getBLE();
      if (ble) {
        await ble.stopAdvertising?.();
      }
      this.isAdvertising = false;
      console.log('[BLE] Stopped advertising');
    } catch (error) {
      console.error('[BLE] Failed to stop advertising:', error);
      throw error;
    }
  }

  /**
   * Start scanning for BLE devices advertising the service
   */
  async startScanning(onDeviceFound: (id: string, name: string) => void): Promise<void> {
    if (this.isScanning) return;

    try {
      const ble = getBLE();
      if (!ble) {
        console.warn('[BLE] munim-bluetooth not available');
        return;
      }

      // Setup discovery listener
      ble.onDiscoverPeripheral?.((peripheral: any) => {
        if (peripheral.advertising?.serviceUUIDs?.includes(BLE_SERVICE_UUID)) {
          const manufacturerData = peripheral.advertising.manufacturerData;
          if (manufacturerData && this._startsWithMagic(manufacturerData)) {
            const nameBytes = manufacturerData.slice(4);
            const name = String.fromCharCode(...nameBytes);
            onDeviceFound(peripheral.id, name);
          }
        }
      });

      // Start scan
      await ble.startScan?.(
        [BLE_SERVICE_UUID], // serviceUUIDs
        true, // allowDuplicates
      );

      this.isScanning = true;
      console.log('[BLE] Started scanning for devices');
    } catch (error) {
      console.error('[BLE] Failed to start scanning:', error);
      throw error;
    }
  }

  /**
   * Stop scanning
   */
  async stopScanning(): Promise<void> {
    if (!this.isScanning) return;

    try {
      const ble = getBLE();
      if (ble) {
        await ble.stopScan?.();
      }
      this.isScanning = false;
      console.log('[BLE] Stopped scanning');
    } catch (error) {
      console.error('[BLE] Failed to stop scanning:', error);
      throw error;
    }
  }

  /**
   * Connect to a BLE device (joiner role)
   */
  async connect(deviceId: string): Promise<void> {
    if (this.isConnected) return;

    try {
      const ble = getBLE();
      if (!ble) {
        console.warn('[BLE] munim-bluetooth not available');
        return;
      }

      // Connect to peripheral
      await ble.connectPeripheral?.(deviceId);

      // Discover services and characteristics
      await ble.discoverAllServicesAndCharacteristics?.(deviceId);

      // Setup notification listener for incoming messages
      this.notificationUnsubscribe = await ble.startNotification?.(
        deviceId,
        BLE_SERVICE_UUID,
        BLE_RX_CHARACTERISTIC_UUID,
        (value: number[]) => this._handleIncomingData(value),
      );

      this.isConnected = true;
      this.connectedDeviceId = deviceId;
      this.role = 'joiner';

      // Flush queued messages
      const queued = this.messageQueue;
      this.messageQueue = [];
      for (const msg of queued) {
        await this.sendMessage(msg);
      }

      console.log('[BLE] Connected to device:', deviceId);
    } catch (error) {
      console.error('[BLE] Failed to connect:', error);
      throw error;
    }
  }

  /**
   * Disconnect from BLE device
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) return;

    try {
      const ble = getBLE();
      if (ble && this.connectedDeviceId) {
        await ble.cancelTransaction?.(this.connectedDeviceId);
      }

      if (this.notificationUnsubscribe) {
        this.notificationUnsubscribe();
        this.notificationUnsubscribe = null;
      }

      this.isConnected = false;
      this.connectedDeviceId = null;
      this.role = null;
      this.messageQueue = [];
      console.log('[BLE] Disconnected');
    } catch (error) {
      console.error('[BLE] Failed to disconnect:', error);
      throw error;
    }
  }

  /**
   * Send a BLE message
   */
  async sendMessage(message: BLEMessage): Promise<void> {
    if (!this.isConnected) {
      this.messageQueue.push(message);
      return;
    }

    try {
      const ble = getBLE();
      if (!ble || !this.connectedDeviceId) {
        return;
      }

      const json = JSON.stringify(message);
      const data = Array.from(json).map(c => c.charCodeAt(0));

      await ble.writeCharacteristicWithoutResponse?.(
        this.connectedDeviceId,
        BLE_SERVICE_UUID,
        BLE_TX_CHARACTERISTIC_UUID,
        data,
      );

      console.log('[BLE] Sent message:', message);
    } catch (error) {
      console.error('[BLE] Failed to send message:', error);
      throw error;
    }
  }

  /**
   * Subscribe to BLE messages
   */
  onMessage(handler: BLEEventHandler): () => void {
    this.eventHandlers.push(handler);
    return () => {
      this.eventHandlers = this.eventHandlers.filter(h => h !== handler);
    };
  }

  /**
   * Get current BLE role (host or joiner)
   */
  getRole(): BLERole | null {
    return this.role;
  }

  /**
   * Check if connected
   */
  isConnectedToBLE(): boolean {
    return this.isConnected;
  }

  /**
   * Get the connected device ID
   */
  getConnectedDeviceId(): string | null {
    return this.connectedDeviceId;
  }

  /**
   * Check if data starts with BLE_ADVERTISEMENT_MAGIC
   */
  private _startsWithMagic(data: number[]): boolean {
    if (data.length < 4) return false;
    const magic = Array.from(BLE_ADVERTISEMENT_MAGIC);
    return data.slice(0, 4).every((byte, i) => byte === magic[i]);
  }

  /**
   * Handle incoming BLE data (internal)
   */
  private _handleIncomingData(data: number[]): void {
    try {
      const json = String.fromCharCode(...data);
      const message = JSON.parse(json) as BLEMessage;
      this._emitMessage(message);
    } catch (e) {
      console.error('[BLE] Failed to parse incoming message:', e);
    }
  }

  /**
   * Emit a message to all handlers (internal use for testing/mocking)
   */
  private _emitMessage(message: BLEMessage): void {
    this.eventHandlers.forEach(handler => handler(message));
  }

  /**
   * Simulate receiving a BLE message (for testing/mocking)
   */
  _simulateMessage(message: BLEMessage): void {
    this._emitMessage(message);
  }
}

export const bleService = new BLEService();
