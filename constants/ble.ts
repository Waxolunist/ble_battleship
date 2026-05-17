/**
 * 128-bit BLE UUIDs for Hulls & Hellfire multiplayer.
 * The leading 4 bytes spell "HHFH" (0x48484648) so the UUID is recognisable
 * in scanner logs and matches the manufacturer-data magic prefix.
 */
export const BLE_SERVICE_UUID = '48484648-0001-1000-8000-00805f9b34fb';
export const BLE_TX_CHARACTERISTIC_UUID = '48484648-0002-1000-8000-00805f9b34fb';
export const BLE_RX_CHARACTERISTIC_UUID = '48484648-0003-1000-8000-00805f9b34fb';

/** 4-byte magic number "HHFH" (0x48484648) in the manufacturer-specific advertisement field */
export const BLE_ADVERTISEMENT_MAGIC = new Uint8Array([0x48, 0x48, 0x46, 0x48]);

export const BLE_PROTOCOL_VERSION = '1';

/**
 * App-level handshake magic. After the OS-level BLE link is up (joiner has
 * subscribed to TX), both sides must exchange a HELLO carrying this magic
 * before we treat the link as a real game session. Without it, any generic
 * BLE scanner (LightBlue, nRF Connect) that subscribes would otherwise be
 * indistinguishable from a real peer.
 */
export const BLE_HELLO_MAGIC = 'HHFH-HELLO';

/** How long to wait for the peer's HELLO before dropping the link. */
export const BLE_HELLO_TIMEOUT_MS = 3000;
