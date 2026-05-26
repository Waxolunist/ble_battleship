/** mDNS service type used for LAN game discovery. */
export const MDNS_SERVICE_TYPE = '_hhfh._tcp';

/** TCP port used for LAN game connections. */
export const TCP_PORT = 48648;

/** STUN server for WebRTC NAT traversal on the NFC+WebRTC path. */
export const STUN_SERVER_URL = 'stun:stun.l.google.com:19302';

export const MULTIPLAYER_PROTOCOL_VERSION = '1';

/**
 * App-level handshake magic. After the transport link is up, both sides must
 * exchange a HELLO carrying this magic before the session is trusted. Without
 * it, any process that happens to connect to the TCP port (or join the WebRTC
 * data channel) would be indistinguishable from a real peer.
 */
export const MULTIPLAYER_HELLO_MAGIC = 'HHFH-HELLO';

/** How long to wait for the peer's HELLO before dropping the link. */
export const MULTIPLAYER_HELLO_TIMEOUT_MS = 3000;
