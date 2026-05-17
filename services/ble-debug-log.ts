/**
 * In-app BLE event log. The radio layer (services/ble.ts) and the UI layer
 * (BLEMultiplayerPanel) both push entries here; the debug overlay subscribes
 * and renders them. Lets us watch advertising/scan/connect/TX/RX on a single
 * device without USB-tailing logcat or Metro.
 */

export type BLEDebugLevel = 'info' | 'tx' | 'rx' | 'event' | 'warn' | 'error';

export interface BLEDebugEntry {
  id: number;
  ts: number;
  level: BLEDebugLevel;
  event: string;
  detail?: string;
}

const MAX_ENTRIES = 200;

type Listener = (entries: BLEDebugEntry[]) => void;

class BLEDebugLog {
  private entries: BLEDebugEntry[] = [];
  private listeners: Set<Listener> = new Set();
  private nextId = 1;

  push(level: BLEDebugLevel, event: string, detail?: string | object): void {
    const detailStr =
      typeof detail === 'object' && detail !== null ? this.safeStringify(detail) : detail;
    const entry: BLEDebugEntry = {
      id: this.nextId++,
      ts: Date.now(),
      level,
      event,
      detail: detailStr,
    };
    this.entries = [...this.entries, entry].slice(-MAX_ENTRIES);
    this.emit();
  }

  clear(): void {
    this.entries = [];
    this.emit();
  }

  getAll(): BLEDebugEntry[] {
    return this.entries;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.entries);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    this.listeners.forEach(l => l(this.entries));
  }

  private safeStringify(obj: object): string {
    try {
      return JSON.stringify(obj);
    } catch {
      return String(obj);
    }
  }
}

export const bleDebugLog = new BLEDebugLog();
