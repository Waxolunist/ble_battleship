/** mDNS service type used for LAN game discovery. */
export const MDNS_SERVICE_TYPE = '_hhfh._tcp';

/** TCP port used for LAN game connections. */
export const TCP_PORT = 48648;

/** Host running our coturn instance — serves both STUN and TURN. */
const TURN_HOST = 'turn.v-collaborate.com';

/**
 * ICE servers for the off-LAN relay path. STUN alone fails behind symmetric
 * NAT, which carrier-grade mobile NAT frequently is, so TURN is listed as the
 * fallback that actually completes those connections.
 *
 * The credential is injected at build time from EXPO_PUBLIC_TURN_CREDENTIAL
 * (see .env.example) rather than committed — this repo is public. Note that
 * EXPO_PUBLIC_* values are inlined into the JS bundle, so this keeps the secret
 * out of git but not out of a shipped binary. Time-limited HMAC credentials
 * minted by the signalling rendezvous are the real fix; see infra/coturn.
 */
export const ICE_SERVERS = [
  { urls: `stun:${TURN_HOST}:3478` },
  {
    urls: [`turn:${TURN_HOST}:3478?transport=udp`, `turns:${TURN_HOST}:5349`],
    username: 'hhfh',
    credential: process.env.EXPO_PUBLIC_TURN_CREDENTIAL ?? '',
  },
];

/**
 * Signalling rendezvous (infra/rendezvous) — pairs phones that cannot see each
 * other on a LAN. Set EXPO_PUBLIC_RENDEZVOUS_URL to override per build.
 */
export const RENDEZVOUS_URL =
  process.env.EXPO_PUBLIC_RENDEZVOUS_URL ?? 'https://hhfh.v-collaborate.com';

/** How often the host asks whether the joiner has answered yet. */
export const RENDEZVOUS_POLL_MS = 1500;

/** How long a host waits on a code before giving up on it. */
export const RENDEZVOUS_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Bumped to 2 for REMATCH_CANCEL. A version 1 build drops unknown message
 * types on the floor, so it would ignore the withdrawal and still believe a
 * rematch was coming — then start a battle its peer had already backed out of.
 * A refused handshake is the kinder failure.
 */
export const MULTIPLAYER_PROTOCOL_VERSION = '2';

/**
 * App-level handshake magic. After the transport link is up, both sides must
 * exchange a HELLO carrying this magic before the session is trusted. Without
 * it, any process that happens to connect to the TCP port (or join the WebRTC
 * data channel) would be indistinguishable from a real peer.
 */
export const MULTIPLAYER_HELLO_MAGIC = 'HHFH-HELLO';

/**
 * Liveness heartbeat. A phone leaving Wi-Fi mid-match never sends a FIN or an
 * RST — the socket simply goes quiet — so neither side learns anything from TCP
 * and both wait forever. Each end pings on an interval and watches how long it
 * has been since *any* byte arrived; silence past the timeout means the peer is
 * gone. Deliberately tight: three missed beats, so a dropped link surfaces in
 * about three seconds rather than never.
 */
export const HEARTBEAT_INTERVAL_MS = 1000;
export const HEARTBEAT_TIMEOUT_MS = 3000;

/** How often the watchdog compares now() against the last inbound byte. */
export const HEARTBEAT_CHECK_MS = 500;

/** How long to wait for the peer's HELLO before dropping the link. */
export const MULTIPLAYER_HELLO_TIMEOUT_MS = 3000;
