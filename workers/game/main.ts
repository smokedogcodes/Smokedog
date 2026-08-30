import {
  createDebugLogger,
  createEioActor,
  createSioActor,
  generateBase64id,
  setEnabledLoggerNamespace,
} from "socket.io-serverless/dist/cf";
import type { DurableObjectNamespace } from "@cloudflare/workers-types";
import type { Server } from "socket.io";
import {
  restoreSocketRoomMemberships,
  wireGameSockets,
} from "../../src/server/socket";

export { AdminActor } from "./admin-actor";

const debugLogger = createDebugLogger("smokedog:game:cf");

setEnabledLoggerNamespace(["sio-serverless:"]);

export interface GameWorkerBindings extends Record<string, unknown> {
  engineActor: DurableObjectNamespace;
  socketActor: DurableObjectNamespace;
  adminActor: DurableObjectNamespace;
  ADMIN_USER?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_PASSWORD_HASH?: string;
  ADMIN_SESSION_SECRET?: string;
}

function stashAdminBindings(bindings: GameWorkerBindings) {
  (globalThis as unknown as {
    __SMOKEDOG_ADMIN__: {
      user?: string;
      password?: string;
      passwordHash?: string;
      sessionSecret?: string;
    };
    __SMOKEDOG_ADMIN_ACTOR__?: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
    };
  }).__SMOKEDOG_ADMIN__ = {
    user: bindings.ADMIN_USER,
    password: bindings.ADMIN_PASSWORD,
    passwordHash: bindings.ADMIN_PASSWORD_HASH,
    sessionSecret: bindings.ADMIN_SESSION_SECRET,
  };

  if (bindings.adminActor) {
    const id = bindings.adminActor.idFromName("singleton");
    (globalThis as unknown as {
      __SMOKEDOG_ADMIN_ACTOR__: ReturnType<DurableObjectNamespace["get"]>;
    }).__SMOKEDOG_ADMIN_ACTOR__ = bindings.adminActor.get(id);
  }
}

export const EngineActor = createEioActor<GameWorkerBindings>({
  getSocketActorNamespace(bindings) {
    stashAdminBindings(bindings);
    return bindings.socketActor;
  },
});

const SocketActorBase = createSioActor<GameWorkerBindings>({
  async onServerCreated(server: Server) {
    debugLogger("socket.io server ready");
    wireGameSockets(server as Parameters<typeof wireGameSockets>[0]);
  },
  async onServerStateRestored(server) {
    debugLogger("socket.io state restored", server._nsps.size, "namespaces");
    restoreSocketRoomMemberships();
  },
  getEngineActorNamespace(bindings) {
    stashAdminBindings(bindings);
    return bindings.engineActor;
  },
});

/**
 * Re-stash admin secrets on every SocketActor wake / message — DO hibernation
 * clears globalThis, and Worker secrets are not available via process.env.
 */
export class SocketActor extends SocketActorBase {
  private stashAdminFromEnv() {
    stashAdminBindings(this.env as GameWorkerBindings);
  }

  override async onEioSocketConnection(
    actorAddr: string,
    socketId: string
  ): Promise<void> {
    this.stashAdminFromEnv();
    return super.onEioSocketConnection(actorAddr, socketId);
  }

  override async onEioSocketData(
    actorAddr: string,
    socketId: string,
    data: unknown
  ): Promise<void> {
    this.stashAdminFromEnv();
    return super.onEioSocketData(actorAddr, socketId, data);
  }

  override async onEioSocketClose(
    actorAddr: string,
    socketId: string,
    code: number,
    reason: string
  ): Promise<void> {
    this.stashAdminFromEnv();
    return super.onEioSocketClose(actorAddr, socketId, code, reason);
  }

  override async onEioSocketError(
    actorAddr: string,
    socketId: string,
    error: unknown
  ): Promise<void> {
    this.stashAdminFromEnv();
    return super.onEioSocketError(actorAddr, socketId, error);
  }

  override async onServerStateRestored(server: Server): Promise<void> {
    this.stashAdminFromEnv();
    return super.onServerStateRestored(server);
  }
}

export default {
  async fetch(req: Request, env: GameWorkerBindings): Promise<Response> {
    stashAdminBindings(env);
    const url = new URL(req.url);

    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        service: "smokedog-game",
        host: "cloudflare",
      });
    }

    if (!url.pathname.startsWith("/socket.io/")) {
      return new Response("SMOKEDOG game server (Cloudflare)", {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    if (req.headers.get("upgrade") !== "websocket") {
      return new Response("websocket only", { status: 400 });
    }

    const actorId = env.engineActor.idFromName("singleton");
    const engineActorStub = env.engineActor.get(actorId);
    const sessionId = generateBase64id();

    // Inject Cloudflare country so SocketActor can attach region to analytics.
    const cf = req.cf as { country?: string } | undefined;
    const country =
      typeof cf?.country === "string" && cf.country.length === 2
        ? cf.country.toUpperCase()
        : "";
    const forwardUrl = new URL(
      `https://eioServer.internal/socket.io/?eio_sid=${sessionId}`
    );
    if (country) forwardUrl.searchParams.set("sd_country", country);

    return engineActorStub.fetch(forwardUrl.toString(), req) as Promise<Response>;
  },
};
