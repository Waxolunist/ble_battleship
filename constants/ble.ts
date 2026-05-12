export const BLE_SERVICE_UUID = 'HHFIRE-0001';
export const BLE_TX_CHARACTERISTIC_UUID = 'HHFIRE-TX-01';
export const BLE_RX_CHARACTERISTIC_UUID = 'HHFIRE-RX-01';

/** 4-byte magic number "HHFH" (0x48484648) in the manufacturer-specific advertisement field */
export const BLE_ADVERTISEMENT_MAGIC = new Uint8Array([0x48, 0x48, 0x46, 0x48]);

export const BLE_PROTOCOL_VERSION = '1';
