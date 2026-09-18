# Signalling rendezvous

Pairs two phones that are not on the same network. The host publishes a WebRTC
offer and gets a six-character code; the joiner types the code, takes the offer
and posts an answer back. Once both halves are across the session is dropped and
the phones talk directly (or through coturn, if peer-to-peer fails).

It never carries game traffic — only the two SDP blobs, once each.

## Why it can be this small

`webrtc.ts` gathers ICE fully before returning an SDP, so signalling is two
blobs rather than a live candidate stream. No WebSocket, no database: a session
is worthless minutes after it is made, so losing them on restart costs a player
one retry.

## API

| | |
|---|---|
| `POST /session` `{offer}` | → `201 {code, expiresInMs}` |
| `GET /session/:code` | → `200 {offer}` / `404` |
| `POST /session/:code/answer` `{answer}` | → `204` |
| `GET /session/:code/answer` | → `200 {answer}` / `204` not yet |
| `GET /health` | → `200 {ok, sessions}` |

Codes are six characters of `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` — no `O`/`0` or
`I`/`1`, because the code gets read aloud. About 10^9 combinations against a
ten-minute window, with per-IP rate limiting, so enumerating a live game is not
practical.

## Deploy

It binds to `127.0.0.1` and expects a TLS terminator in front — do not expose
8787 directly, or codes and SDPs travel in clear.

```
docker compose up -d
```

nginx, on the same host as coturn:

```nginx
location /rendezvous/ {
    proxy_pass http://127.0.0.1:8787/;
}
```

Then `EXPO_PUBLIC_RENDEZVOUS_URL=https://v-collaborate.com/rendezvous` in the
app's `.env.local`.

## Check it

```bash
CODE=$(curl -s -X POST localhost:8787/session \
  -H 'content-type: application/json' \
  -d '{"offer":"fake-offer"}' | sed 's/.*"code":"\([^"]*\)".*/\1/')

curl -s localhost:8787/session/$CODE                       # {"offer":"fake-offer"}
curl -s -X POST localhost:8787/session/$CODE/answer \
  -H 'content-type: application/json' -d '{"answer":"fake-answer"}'
curl -s localhost:8787/session/$CODE/answer                # {"answer":"fake-answer"}
curl -s localhost:8787/session/$CODE/answer                # 404 — consumed
```
