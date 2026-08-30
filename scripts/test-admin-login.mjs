/**
 * Test admin:login against the game worker via Socket.io websocket.
 * Usage: node scripts/test-admin-login.mjs [password] [user]
 */
import { io } from "socket.io-client";

const url =
  process.env.SOCKET_URL ?? "https://sd-game.smokedog.workers.dev";
const user = process.argv[3] ?? "admin";
const password = process.argv[2] ?? "change-me-smokedog";

const playerId = `admin-test-${Date.now()}`;

console.log(`Connecting to ${url} as player ${playerId}…`);

const socket = io(url, {
  transports: ["websocket"],
  auth: { playerId },
  timeout: 15_000,
});

const timeout = setTimeout(() => {
  console.error("TIMEOUT — no admin:auth within 15s");
  socket.close();
  process.exit(1);
}, 15_000);

socket.on("connect", () => {
  console.log("connected, sending admin:login…");
  socket.emit("admin:login", { user, password });
});

socket.on("admin:auth", (payload) => {
  clearTimeout(timeout);
  console.log("admin:auth:", JSON.stringify(payload, null, 2));
  socket.close();
  process.exit(payload.ok ? 0 : 1);
});

socket.on("connect_error", (err) => {
  clearTimeout(timeout);
  console.error("connect_error:", err.message);
  process.exit(1);
});
