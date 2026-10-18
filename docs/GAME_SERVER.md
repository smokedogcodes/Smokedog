# Game server deployment

SMOKEDOG runs on a **hybrid high-availability architecture**:

| Layer | Host | URL | Details |
| --- | --- | --- | --- |
| **Frontend UI** | **Cloudflare Pages / Workers** (OpenNext) | https://smokedog.pages.dev / https://sd.alpainoocompany.workers.dev | Global edge CDN, Next.js 14, client assets & SSR |
| **Backend Game Runtime** | **Oracle Cloud VM** (PM2 `smokedog-arena`) | https://smokedog.duckdns.org | Persistent room state, 24/7 in-memory GameRuntime, Socket.IO WebSockets |

The frontend connects directly to the Oracle backend via **`NEXT_PUBLIC_SOCKET_URL`** (`https://smokedog.duckdns.org`), eliminating Cloudflare Durable Object hibernation so rooms stay alive indefinitely without expiring.

---

## Deploying Frontend (Cloudflare Pages / Workers)

```bash
# Build Next.js & OpenNext Cloudflare bundle
npm run build:cf

# Deploy to Cloudflare Worker with Assets
npx wrangler deploy

# Or deploy to Cloudflare Pages
npx wrangler pages deploy .open-next/assets --project-name smokedog
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
