# Game server deployment

SMOKEDOG production runs entirely on **Cloudflare Workers**:

| Layer | Worker | URL |
| --- | --- | --- |
| **UI** | `sd` (OpenNext) | https://sd.smokedog.workers.dev |
| **Game server** | `sd-game` (Socket.io + Durable Objects) | https://sd-game.smokedog.workers.dev |

The UI connects via **`NEXT_PUBLIC_SOCKET_URL`**, set in `wrangler.jsonc` and embedded at build/deploy time.

---

## Deploy

From the repo root (requires `wrangler login`):

```bash
# Game server (deploy first when changing socket handlers)
npm run deploy:cf:game

# UI
npm run deploy:cf

# Both
npm run deploy:cf:all
```

After changing game logic in `src/server/*`, redeploy **`sd-game`**. After UI/client changes, redeploy **`sd`** (or both).

---

## Health checks

**Game server:**

```bash
curl https://sd-game.smokedog.workers.dev/health
```

Expected: `{"ok":true,"service":"smokedog-game","host":"cloudflare"}`

**UI:** open https://sd.smokedog.workers.dev — hub should load and open lobbies should list.

---

## Configuration

### UI (`wrangler.jsonc`)

```jsonc
"vars": {
  "NEXT_PUBLIC_SOCKET_URL": "https://sd-game.smokedog.workers.dev"
}
```

Update the subdomain if you change your Cloudflare `workers.dev` account subdomain.### Game worker (`wrangler.game.jsonc`)

Socket.io runs in Durable Objects (`EngineActor`, `SocketActor`). Entry: `workers/game/main.ts` → `wireGameSockets()`.

CORS for the standalone Node server (`npm run start:game`) is only needed for local split-mode testing — the Cloudflare game worker handles browser origins via the Socket.io stack.

---

## Local development

**Unified (recommended):**

```bash
npm run dev
```

Next.js + Socket.io on one port.

**Split mode (matches production topology locally):**

```bash
# Terminal 1
PORT=3001 CORS_ORIGIN=http://localhost:3000 npm run start:game

# Terminal 2 — .env.local
# NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
npm run dev
```

---

## Architecture

```
Browser → smokedog (UI worker, OpenNext)
       → smokedog-game (WebSocket /socket.io/)
              → EngineActor DO
              → SocketActor DO → GameRuntime (in-memory rooms)
```

Game state lives in memory inside `GameRuntime`. After Durable Object hibernation, clients reconnect via `room:rejoin` / `room:spectate` and sockets are re-joined in `restoreSocketRoomMemberships()`.

---

## Optional: self-hosted game server

`src/server/standalone.ts` + `npm run start:game` can run the game server on any Node host (e.g. a VM). Point `NEXT_PUBLIC_SOCKET_URL` at that host and set `CORS_ORIGIN` to your UI origin. Production today uses Cloudflare only.

See `deploy/oracle/` for a systemd template if you ever run the standalone server on a Linux VM.
