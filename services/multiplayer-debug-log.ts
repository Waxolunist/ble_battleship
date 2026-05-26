/**
 * In-app multiplayer event log. Transport services and the UI layer both push
 * entries here; the debug overlay subscribes and renders them. Lets us watch
 * advertising/scan/connect/TX/RX on a single device without USB-tailing logcat
 * or Metro.
 */

export type MultiplayerDebugLevel = 'info' | 'tx' | 'rx' | 'event' | 'warn' | 'error';

export interface MultiplayerDebugEntry {
  id: number;
  ts: number;
  level: MultiplayerDebugLevel;
  event: string;
  detail?: string;
}

const MAX_ENTRIES = 200;

type Listener = (entries: MultiplayerDebugEntry[]) => void;

class MultiplayerDebugLog {
  private entries: MultiplayerDebugEntry[] = [];
  private listeners: Set<Listener> = new Set();
  private nextId = 1;

  push(level: MultiplayerDebugLevel, event: string, detail?: string | object): void {
    const detailStr =
      typeof detail === 'object' && detail !== null ? this.safeStringify(detail) : detail;
    const entry: MultiplayerDebugEntry = {
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

  getAll(): MultiplayerDebugEntry[] {
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

export const multiplayerDebugLog = new MultiplayerDebugLog();
