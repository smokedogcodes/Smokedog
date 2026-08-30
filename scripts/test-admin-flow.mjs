/**
 * Full admin flow: login → snapshot → resume with token.
 */
import { io } from "socket.io-client";

const url = process.env.SOCKET_URL ?? "https://sd-game.smokedog.workers.dev";
const password = process.argv[2] ?? "change-me-smokedog";
const playerId = `admin-flow-${Date.now()}`;

function connect() {
  return io(url, {
    transports: ["websocket"],
    auth: { playerId },
    timeout: 15_000,
  });
}

async function login(socket) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("login timeout")), 15_000);
    socket.once("admin:auth", (p) => {
      clearTimeout(t);
      resolve(p);
    });
    socket.emit("admin:login", { user: "admin", password });
  });
}

async function snapshot(socket, token) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("snapshot timeout")), 15_000);
    socket.once("admin:snapshot", (p) => {
      clearTimeout(t);
      resolve(p);
    });
    socket.once("admin:auth", (p) => {
      if (!p.ok) {
        clearTimeout(t);
        reject(new Error(`snapshot auth fail: ${p.message}`));
      }
    });
    socket.emit("admin:snapshot", { token });
  });
}

async function resume(socket, token) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("resume timeout")), 15_000);
    socket.once("admin:auth", (p) => {
      clearTimeout(t);
      resolve(p);
    });
    socket.emit("admin:resume", { token });
  });
}

const socket = connect();
await new Promise((r, j) => {
  socket.once("connect", r);
  socket.once("connect_error", j);
});

console.log("1. login…");
const auth = await login(socket);
console.log("   auth:", auth);
if (!auth.ok) process.exit(1);

console.log("2. snapshot…");
const snap = await snapshot(socket, auth.token);
console.log("   rooms:", snap.health?.roomCount, "logs:", snap.health?.storedGameLogs);

socket.disconnect();

console.log("3. new socket resume…");
const socket2 = connect();
await new Promise((r, j) => {
  socket2.once("connect", r);
  socket2.once("connect_error", j);
});
const resumed = await resume(socket2, auth.token);
console.log("   resume:", resumed);
if (!resumed.ok) process.exit(1);

const snap2 = await snapshot(socket2, auth.token);
console.log("   snapshot after resume ok, rooms:", snap2.health?.roomCount);

socket2.close();
console.log("ALL OK");
