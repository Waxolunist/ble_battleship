import { STUN_SERVER_URL } from '@/constants/multiplayer';
import { RTCPeerConnection, RTCSessionDescription } from 'react-native-webrtc';

type RTCDataChannelType = ReturnType<RTCPeerConnection['createDataChannel']>;
import { multiplayerDebugLog } from './multiplayer-debug-log';

type RawMessageHandler = (data: string) => void;

const DATA_CHANNEL_LABEL = 'game';
const OPEN_TIMEOUT_MS = 30_000;

const ICE_CONFIG = {
  iceServers: [{ urls: STUN_SERVER_URL }],
};

/**
 * WebRTC transport (Path 2 — NFC+WebRTC).
 *
 * Handles the RTCPeerConnection lifecycle and a single data channel used for
 * game messages. Does NOT know about the HELLO protocol — that lives in the
 * multiplayer.ts façade.
 *
 * Host flow:  createOffer() → [NFC] → setRemoteAnswer() → waitForOpen()
 * Joiner flow: setRemoteOffer() → createAnswer() → [NFC] → waitForOpen()
 */
class WebRTCService {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannelType | null = null;
  private rawHandlers: RawMessageHandler[] = [];
  private openResolve: (() => void) | null = null;
  private openReject: ((err: Error) => void) | null = null;
  private openTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Host: create the peer connection, open the data channel, generate an SDP
   * offer, and wait for ICE gathering to complete before returning the full SDP
   * (trickle-less signaling — all candidates are bundled into the offer so the
   * SDP can be transferred via NFC in a single payload).
   */
  async createOffer(): Promise<string> {
    this.close();
    this.pc = new RTCPeerConnection(ICE_CONFIG);
    this._initOpenPromise();
    multiplayerDebugLog.push('event', 'WebRTC createOffer →');

    // Host creates the data channel; joiner receives it via ondatachannel.
    this.dc = this.pc.createDataChannel(DATA_CHANNEL_LABEL);
    this._setupDataChannel(this.dc);

    (this.pc as unknown as EventTarget).addEventListener('iceconnectionstatechange', () => {
      multiplayerDebugLog.push('event', 'ICE state', this.pc?.iceConnectionState);
    });

    const offer = await this.pc.createOffer({});
    await this.pc.setLocalDescription(offer);
    await this._waitForICEGathering();

    const sdp = this.pc.localDescription?.sdp ?? '';
    multiplayerDebugLog.push('info', 'WebRTC offer ready', `${sdp.length} chars`);
    return sdp;
  }

  /**
   * Joiner: set the host's SDP offer as the remote description and create the
   * peer connection. Call createAnswer() next.
   */
  async setRemoteOffer(sdp: string): Promise<void> {
    this.close();
    this.pc = new RTCPeerConnection(ICE_CONFIG);
    this._initOpenPromise();
    multiplayerDebugLog.push('event', 'WebRTC setRemoteOffer →');

    // Joiner receives the data channel via ondatachannel.
    (this.pc as unknown as EventTarget).addEventListener('datachannel', (event: Event) => {
      this.dc = (event as unknown as { channel: RTCDataChannelType }).channel;
      this._setupDataChannel(this.dc);
    });

    (this.pc as unknown as EventTarget).addEventListener('iceconnectionstatechange', () => {
      multiplayerDebugLog.push('event', 'ICE state', this.pc?.iceConnectionState);
    });

    await this.pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));
  }

  /**
   * Joiner: generate an SDP answer and wait for ICE gathering before returning
   * the full SDP for NFC transfer.
   */
  async createAnswer(): Promise<string> {
    if (!this.pc) throw new Error('[WebRTC] createAnswer called before setRemoteOffer');
    multiplayerDebugLog.push('event', 'WebRTC createAnswer →');

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    await this._waitForICEGathering();

    const sdp = this.pc.localDescription?.sdp ?? '';
    multiplayerDebugLog.push('info', 'WebRTC answer ready', `${sdp.length} chars`);
    return sdp;
  }

  /**
   * Host: apply the joiner's SDP answer after reading it from NFC.
   */
  async setRemoteAnswer(sdp: string): Promise<void> {
    if (!this.pc) throw new Error('[WebRTC] setRemoteAnswer called before createOffer');
    multiplayerDebugLog.push('event', 'WebRTC setRemoteAnswer →');
    await this.pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }));
  }

  /**
   * Resolves when the data channel is open and ready for game messages.
   * Rejects after OPEN_TIMEOUT_MS if the channel never opens.
   */
  waitForOpen(): Promise<void> {
    if (this.dc?.readyState === 'open') return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      this.openResolve = resolve;
      this.openReject = reject;
      this.openTimer = setTimeout(() => {
        multiplayerDebugLog.push('error', 'WebRTC data channel open timeout');
        reject(new Error('WebRTC data channel open timeout'));
      }, OPEN_TIMEOUT_MS);
    });
  }

  /** Send a raw JSON string via the data channel. */
  sendRaw(json: string): void {
    if (this.dc?.readyState !== 'open') {
      multiplayerDebugLog.push('warn', 'WebRTC sendRaw — channel not open', json.slice(0, 40));
      return;
    }
    this.dc.send(json);
  }

  /** Subscribe to raw JSON strings arriving on the data channel. */
  onRawMessage(handler: RawMessageHandler): () => void {
    this.rawHandlers.push(handler);
    return () => {
      this.rawHandlers = this.rawHandlers.filter(h => h !== handler);
    };
  }

  close(): void {
    if (this.openTimer) {
      clearTimeout(this.openTimer);
      this.openTimer = null;
    }
    this.openReject?.(new Error('WebRTC closed'));
    this.openResolve = null;
    this.openReject = null;
    try {
      this.dc?.close();
    } catch {
      // ignore
    }
    try {
      this.pc?.close();
    } catch {
      // ignore
    }
    this.dc = null;
    this.pc = null;
    multiplayerDebugLog.push('info', 'WebRTC closed');
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  private _initOpenPromise(): void {
    this.openResolve = null;
    this.openReject = null;
    if (this.openTimer) {
      clearTimeout(this.openTimer);
      this.openTimer = null;
    }
  }

  private _setupDataChannel(dc: RTCDataChannelType): void {
    const et = dc as unknown as EventTarget;

    et.addEventListener('open', () => {
      multiplayerDebugLog.push('info', 'WebRTC data channel open');
      if (this.openTimer) {
        clearTimeout(this.openTimer);
        this.openTimer = null;
      }
      const resolve = this.openResolve;
      this.openResolve = null;
      this.openReject = null;
      resolve?.();
    });

    et.addEventListener('message', (event: Event) => {
      const data = (event as unknown as { data: unknown }).data;
      const raw = typeof data === 'string' ? data : String(data);
      this.rawHandlers.forEach(h => h(raw));
    });

    et.addEventListener('error', (event: Event) => {
      multiplayerDebugLog.push('error', 'WebRTC data channel error', String(event));
    });

    et.addEventListener('close', () => {
      multiplayerDebugLog.push('event', 'WebRTC data channel closed');
    });
  }

  private _waitForICEGathering(): Promise<void> {
    return new Promise<void>(resolve => {
      if (!this.pc) {
        resolve();
        return;
      }
      if (this.pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }
      const et = this.pc as unknown as EventTarget;
      const handler = () => {
        if (this.pc?.iceGatheringState === 'complete') {
          et.removeEventListener('icegatheringstatechange', handler);
          resolve();
        }
      };
      et.addEventListener('icegatheringstatechange', handler);
    });
  }
}

export const webrtcService = new WebRTCService();
