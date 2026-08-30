#!/usr/bin/env bash
# Full SMOKEDOG game-server install on Oracle Cloud (Ubuntu).
# Run on the VM as the ubuntu user after SSH:
#   curl -fsSL https://raw.githubusercontent.com/elorakart/Smokedog/main/deploy/oracle/install-game-server.sh | bash
set -euo pipefail

REPO="${REPO:-https://github.com/elorakart/Smokedog.git}"
APP_DIR="${APP_DIR:-$HOME/Smokedog}"
CORS_ORIGIN="${CORS_ORIGIN:-https://sd.smokedog.workers.dev}"
PORT="${PORT:-3001}"
SERVICE_NAME="${SERVICE_NAME:-smokedog-game}"

echo "==> SMOKEDOG Oracle game-server install"
echo "    App dir: $APP_DIR"
echo "    CORS:    $CORS_ORIGIN"
echo "    Port:    $PORT"

echo "==> System packages..."
sudo apt-get update -qq
sudo apt-get install -y curl git ufw

echo "==> Node.js 20..."
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v
npm -v

echo "==> Firewall (UFW)..."
sudo ufw allow OpenSSH
sudo ufw allow "${PORT}/tcp"
sudo ufw --force enable

echo "==> Clone / update repo..."
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull origin main
else
  git clone "$REPO" "$APP_DIR"
fi
cd "$APP_DIR"
npm ci

echo "==> Install systemd service..."
sudo tee "/etc/systemd/system/${SERVICE_NAME}.service" >/dev/null <<EOF
[Unit]
Description=SMOKEDOG Mafia City game server (Socket.io)
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production
Environment=PORT=${PORT}
Environment=CORS_ORIGIN=${CORS_ORIGIN}
ExecStart=$(command -v npm) run start:game
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable "${SERVICE_NAME}"
sudo systemctl restart "${SERVICE_NAME}"

sleep 2
echo "==> Local health check..."
if curl -sf "http://127.0.0.1:${PORT}/health"; then
  echo ""
  echo "OK — game server running locally."
else
  echo "WARN — local health check failed. Logs:"
  sudo journalctl -u "${SERVICE_NAME}" -n 30 --no-pager
  exit 1
fi

PUBLIC_IP=$(curl -fsS --max-time 5 ifconfig.me 2>/dev/null || curl -fsS --max-time 5 icanhazip.com 2>/dev/null || echo "YOUR_VM_PUBLIC_IP")
echo ""
echo "=============================================="
echo " Oracle install complete."
echo " Public health URL (after OCI port ${PORT} is open):"
echo "   http://${PUBLIC_IP}:${PORT}/health"
echo ""
echo " Next: open TCP ${PORT} in Oracle Cloud security list,"
echo " then set NEXT_PUBLIC_SOCKET_URL in wrangler.jsonc to:"
echo "   http://${PUBLIC_IP}:${PORT}"
echo " (or https://your-domain if you add nginx later)"
echo "=============================================="
