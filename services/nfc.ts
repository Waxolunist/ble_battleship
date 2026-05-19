import pako from 'pako';
import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager';
import { multiplayerDebugLog } from './multiplayer-debug-log';

const MIME_TYPE = 'application/octet-stream';

let started = false;

async function ensureStarted(): Promise<void> {
  if (started) return;
  await NfcManager.start();
  started = true;
}

function compressSDP(sdp: string): number[] {
  return Array.from(pako.deflate(sdp));
}

function decompressSDP(payload: number[]): string {
  return pako.inflate(new Uint8Array(payload), { to: 'string' });
}

function buildNdefBytes(compressed: number[]): number[] {
  const record = Ndef.record(Ndef.TNF_MIME_MEDIA, MIME_TYPE, [], compressed);
  return Ndef.encodeMessage([record]);
}

/**
 * Host — Tap 1: write the WebRTC offer to our NFC tag so the joiner can read
 * it when they tap their phone against ours.
 */
export async function writeOffer(sdp: string): Promise<void> {
  multiplayerDebugLog.push('event', 'NFC writeOffer →', `${sdp.length} chars`);
  await ensureStarted();
  await NfcManager.requestTechnology(NfcTech.Ndef);
  try {
    const bytes = buildNdefBytes(compressSDP(sdp));
    await NfcManager.ndefHandler.writeNdefMessage(bytes);
    multiplayerDebugLog.push('info', 'NFC offer written');
  } finally {
    await NfcManager.cancelTechnologyRequest();
  }
}

/**
 * Joiner — Tap 1: read the host's offer from the NFC tag.
 */
export async function readOffer(): Promise<string> {
  multiplayerDebugLog.push('event', 'NFC readOffer — waiting for tap');
  await ensureStarted();
  await NfcManager.requestTechnology(NfcTech.Ndef);
  try {
    const tag = await NfcManager.getTag();
    const payload = tag?.ndefMessage?.[0]?.payload;
    if (!payload || payload.length === 0) throw new Error('Empty NFC payload');
    const sdp = decompressSDP(Array.from(payload));
    multiplayerDebugLog.push('info', 'NFC offer read', `${sdp.length} chars`);
    return sdp;
  } finally {
    await NfcManager.cancelTechnologyRequest();
  }
}

/**
 * Joiner — Tap 2: write our WebRTC answer to our NFC tag so the host can read
 * it when they tap their phone against ours.
 */
export async function writeAnswer(sdp: string): Promise<void> {
  multiplayerDebugLog.push('event', 'NFC writeAnswer →', `${sdp.length} chars`);
  await ensureStarted();
  await NfcManager.requestTechnology(NfcTech.Ndef);
  try {
    const bytes = buildNdefBytes(compressSDP(sdp));
    await NfcManager.ndefHandler.writeNdefMessage(bytes);
    multiplayerDebugLog.push('info', 'NFC answer written');
  } finally {
    await NfcManager.cancelTechnologyRequest();
  }
}

/**
 * Host — Tap 2: read the joiner's answer from the NFC tag.
 */
export async function readAnswer(): Promise<string> {
  multiplayerDebugLog.push('event', 'NFC readAnswer — waiting for tap');
  await ensureStarted();
  await NfcManager.requestTechnology(NfcTech.Ndef);
  try {
    const tag = await NfcManager.getTag();
    const payload = tag?.ndefMessage?.[0]?.payload;
    if (!payload || payload.length === 0) throw new Error('Empty NFC payload');
    const sdp = decompressSDP(Array.from(payload));
    multiplayerDebugLog.push('info', 'NFC answer read', `${sdp.length} chars`);
    return sdp;
  } finally {
    await NfcManager.cancelTechnologyRequest();
  }
}
