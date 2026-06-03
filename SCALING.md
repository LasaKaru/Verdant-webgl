# VERDANT — Scaling the Multiplayer & Chat backend

The game ships with `server.js`: a **single-process, room-sharded WebSocket
relay** with live Global / Room / Group / Local chat. That is genuinely all
you need for friends, a playtest, or a single community server (a few hundred
to a few thousand concurrent sockets on one box).

"Million-scale global app" is a different, **infrastructure** problem — it
cannot live inside the game file. Below is the honest architecture to get
there, and what already maps onto it.

---

## What `server.js` already does right

- **Rooms are the shard unit.** Players join a `room`; transforms fan out
  *per room*, not globally — so bandwidth scales with room population, not
  total population. This is the single most important design choice for scale.
- **Groups (parties)** are a namespace inside a room.
- **Chat is channel-routed** (`global` / `room` / `group` / `local`) instead
  of one firehose.
- It's **stateless about gameplay** (pure relay), so processes are disposable
  and horizontally replaceable.

The only thing preventing scale is that rooms live in **one process's memory**.

---

## Target architecture (millions of concurrent users)

```
                    ┌────────────── Global DNS / Anycast ──────────────┐
                    │                                                   │
              ┌─────▼─────┐   ┌───────────┐   ┌───────────┐   ┌─────────▼─┐
   Region A   │ LB / edge │   │ LB / edge │   │ LB / edge │   │ LB / edge │  Region B …
              └─────┬─────┘   └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
                    │               │               │               │
            ┌───────▼───────┬───────▼───────┬───────▼───────┐  (N relay pods, autoscaled)
            │ relay pod #1  │ relay pod #2  │ relay pod #k  │  ← today's server.js, ×K
            └───────┬───────┴───────┬───────┴───────┬───────┘
                    │               │               │
            ┌───────▼───────────────▼───────────────▼───────┐
            │   Shared pub/sub bus  (Redis / NATS / Kafka)   │  ← rooms span processes
            └───────┬───────────────────────────────┬───────┘
                    │                                │
            ┌───────▼────────┐              ┌────────▼────────┐
            │ Presence store │              │  Persistence    │
            │ (Redis)        │              │  (Postgres etc) │
            └────────────────┘              └─────────────────┘
```

### The five changes that unlock scale

1. **Replace in-memory room maps with a pub/sub bus.**
   Each relay pod `SUBSCRIBE room:{id}` and publishes transforms/chat to that
   channel. A room can then span any number of pods/regions. This is a small,
   localized change to `broadcastRoom()` / `relayChat()`.

2. **Stateless, autoscaled relay pods.**
   Run `server.js` as a container behind a load balancer; scale on socket
   count / CPU. Use sticky routing by `room` so a room's traffic concentrates
   (cheaper) but is never *locked* to one pod.

3. **Presence service.**
   Move "who is in room X / how many online" into Redis (a sorted set per
   room + a global counter) instead of `players.size`. Powers the room
   browser and the chat header counts at any scale.

4. **Regional edges + global chat tier.**
   Keep gameplay rooms regional (latency), but route the `global` chat channel
   through a dedicated low-rate fan-out tier (or a managed messaging service)
   so it never competes with the 15 Hz transform stream.

5. **Auth, identity & moderation.**
   Add a login/identity service (JWT), per-message rate limiting, profanity/
   spam filtering, and block/report — non-negotiable for a public global app.

### Reliability & cost

- **Interest management / AoI:** only relay transforms of players within view
  distance, not the whole room. Caps per-client bandwidth as rooms grow.
- **Delta + binary encoding:** replace JSON transforms with packed binary +
  delta compression (10–20× smaller).
- **Backpressure & heartbeats:** drop slow consumers, ping/pong already stubbed.
- **Managed option:** if you'd rather not run the bus yourself, a managed
  realtime service (e.g. a hosted WebSocket/pub-sub product) collapses steps
  1–4 into configuration.

---

## Migration checklist

- [ ] Containerize `server.js`; put it behind a load balancer.
- [ ] Swap `rooms` Map → pub/sub channels (`room:{id}`, `global`).
- [ ] Move presence/counts → Redis.
- [ ] Add identity/auth + chat rate-limiting & moderation.
- [ ] Add interest management + binary deltas to the transform stream.
- [ ] Add metrics (sockets, msgs/s, p99 latency) and autoscaling rules.

Everything in the client (`net.js`, `chat.js`) already speaks a room/group/
channel protocol, so **none of the above requires client changes** — only the
relay's transport layer moves from in-memory to a shared bus.
