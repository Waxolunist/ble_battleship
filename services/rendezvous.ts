import { RENDEZVOUS_POLL_MS, RENDEZVOUS_TIMEOUT_MS, RENDEZVOUS_URL } from '@/constants/multiplayer';
import { multiplayerDebugLog } from './multiplayer-debug-log';

/**
 * Client for the signalling rendezvous (see infra/rendezvous).
 *
 * Carries two SDP blobs between phones that cannot find each other on a LAN:
 * the host publishes an offer under a short code, the joiner claims it and
 * posts an answer back. Nothing here touches game traffic.
 */

export class RendezvousError extends Error {
  constructor(
    message: string,
    readonly reason: 'no-such-game' | 'timeout' | 'network' | 'server',
  ) {
    super(message);
  }
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${RENDEZVOUS_URL}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch (err) {
    throw new RendezvousError(`rendezvous unreachable: ${String(err)}`, 'network');
  }
}

/** Host: publish the offer, receive the code to read out. */
export async function publishOffer(offer: string): Promise<string> {
  const res = await request('/session', { method: 'POST', body: JSON.stringify({ offer }) });
  if (!res.ok) throw new RendezvousError(`publish failed (${res.status})`, 'server');
  const { code } = (await res.json()) as { code: string };
  multiplayerDebugLog.push('info', 'rendezvous offer published', code);
  return code;
}

/** Joiner: claim the offer behind a code. */
export async function fetchOffer(code: string): Promise<string> {
  const res = await request(`/session/${encodeURIComponent(code)}`);
  if (res.status === 404) throw new RendezvousError('no game for that code', 'no-such-game');
  if (!res.ok) throw new RendezvousError(`fetch failed (${res.status})`, 'server');
  const { offer } = (await res.json()) as { offer: string };
  multiplayerDebugLog.push('info', 'rendezvous offer claimed', code);
  return offer;
}

/** Joiner: hand the answer back to the waiting host. */
export async function publishAnswer(code: string, answer: string): Promise<void> {
  const res = await request(`/session/${encodeURIComponent(code)}/answer`, {
    method: 'POST',
    body: JSON.stringify({ answer }),
  });
  if (res.status === 404) throw new RendezvousError('game expired', 'no-such-game');
  if (!res.ok) throw new RendezvousError(`answer failed (${res.status})`, 'server');
  multiplayerDebugLog.push('info', 'rendezvous answer posted', code);
}

/**
 * Host: poll until the joiner answers. 204 is the ordinary "not yet" reply, so
 * it is not an error until the whole window runs out.
 */
export async function awaitAnswer(code: string, signal?: { cancelled: boolean }): Promise<string> {
  const deadline = Date.now() + RENDEZVOUS_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (signal?.cancelled) throw new RendezvousError('cancelled', 'timeout');
    const res = await request(`/session/${encodeURIComponent(code)}/answer`);
    if (res.status === 200) {
      const { answer } = (await res.json()) as { answer: string };
      multiplayerDebugLog.push('info', 'rendezvous answer received', code);
      return answer;
    }
    if (res.status === 404) throw new RendezvousError('game expired', 'no-such-game');
    if (res.status !== 204) throw new RendezvousError(`poll failed (${res.status})`, 'server');
    await new Promise(resolve => setTimeout(resolve, RENDEZVOUS_POLL_MS));
  }
  throw new RendezvousError('nobody joined in time', 'timeout');
}
