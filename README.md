# SMOKEDOG

Real-time multiplayer party games — **Mafia City** and **5 Alive**.

Design reference: [Stitch — Mafia Card Party](https://stitch.withgoogle.com/projects/7822900312632106893).

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The custom `server.ts` serves Next.js and Socket.io on one port.

## Production (Cloudflare)

| Layer | Worker | URL |
| --- | --- | --- |
| **UI** | `sd` | https://sd.smokedog.workers.dev |
| **Game server** | `sd-game` | https://sd-game.smokedog.workers.dev |

The UI reads **`NEXT_PUBLIC_SOCKET_URL`** from `wrangler.jsonc` (baked in at deploy). The game worker runs Socket.io via Durable Objects.

Deploy both workers:

```bash
npm run deploy:cf:all
```

Or separately:

```bash
npm run deploy:cf:game   # game server first
npm run deploy:cf        # UI (OpenNext)
```

See [docs/GAME_SERVER.md](docs/GAME_SERVER.md) for architecture, env vars, and health checks.

### Local game-server-only mode

Useful when testing split UI + game server without Cloudflare:

```bash
PORT=3001 CORS_ORIGIN=http://localhost:3000 npm run start:game
```

Set `NEXT_PUBLIC_SOCKET_URL=http://localhost:3001` in `.env.local`.

## Play

1. Open the hub, click **Mafia City** or **5 Alive**.
2. Set a display name and mugshot.
3. **Create Party** or **Join Party** with a 6-character code.
4. Host starts at 4+ players. Roles scale with lobby size.
