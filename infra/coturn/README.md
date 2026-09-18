# coturn — STUN + TURN

One container serves both: **STUN** lets each phone discover its public address,
**TURN** relays the data channel when peer-to-peer fails. On mobile data,
carrier-grade NAT is frequently symmetric and STUN alone does not get through,
so TURN is what makes off-LAN play actually connect.

Traffic here is a game data channel — coordinates and short messages, a few KB
per match — so relay bandwidth is negligible. The cost is operational, not
financial.

## Deploy

1. Point `turn.v-collaborate.com` at the host.
2. Issue a certificate:
   `certbot certonly --standalone -d turn.v-collaborate.com`
3. Replace `CHANGE_ME_LONG_RANDOM_SECRET` in `turnserver.conf`
   (`openssl rand -base64 32`).
4. Open the firewall: **3478/tcp**, **3478/udp**, **5349/tcp**, **5349/udp**,
   and **49152-49200/udp** for the relay range.
5. `docker compose up -d`

If the host is behind NAT (rather than holding its public address directly),
add `external-ip=PUBLIC_IP/PRIVATE_IP` or coturn will advertise an unreachable
candidate.

## Verify

Check it answers before wiring the app to it:

```bash
# STUN binding request — should print the server's mapped address
turnutils_stunclient turn.v-collaborate.com

# TURN allocation with credentials — proves relay works, not just STUN
turnutils_uclient -v -t -u hhfh -w YOUR_SECRET turn.v-collaborate.com
```

The browser-based ICE trickle test at `webrtc.github.io/samples/src/content/peerconnection/trickle-ice/`
is the quickest sanity check: enter the TURN URL and credentials and confirm a
candidate of type `relay` appears. If only `srflx` appears, STUN works and TURN
does not.

## Wiring the app

`constants/multiplayer.ts` currently declares STUN only (`STUN_SERVER_URL`,
pointed at Google's public server). When the relay path lands, that becomes an
ICE server list carrying this server for both roles:

```ts
iceServers: [
  { urls: 'stun:turn.v-collaborate.com:3478' },
  {
    urls: ['turn:turn.v-collaborate.com:3478', 'turns:turn.v-collaborate.com:5349'],
    username: '…',
    credential: '…',
  },
]
```

## On credentials

The static `user=` line above is the simple option, and its weakness is that the
credential ships inside the app and can be extracted — someone could use the
server as a personal relay.

The standard fix is **time-limited credentials**: swap `user=` for
`use-auth-secret` plus `static-auth-secret=…`, and have the signalling
rendezvous mint a username of `<unix-expiry>:<id>` with the password as
`base64(hmac-sha1(secret, username))`. Credentials then expire in minutes and
never sit in the binary. Worth doing when the rendezvous is built, since that
service is the natural place to mint them — not before, as there is nothing to
mint them from yet.
