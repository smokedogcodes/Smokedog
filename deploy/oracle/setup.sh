#!/usr/bin/env bash
# Oracle Cloud VM bootstrap for SMOKEDOG game server (run as ubuntu user)
set -euo pipefail

REPO="${REPO:-https://github.com/elorakart/Smokedog.git}"
APP_DIR="${APP_DIR:-$HOME/Smokedog}"
CORS_ORIGIN="${CORS_ORIGIN:-https://sd.smokedog.workers.dev}"

echo "==> Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git

echo "==> Cloning / updating app..."
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR" && git pull origin main
else
  git clone "$REPO" "$APP_DIR"
  cd "$APP_DIR"
fi

npm ci

echo "==> Health check (manual start)..."
PORT=3001 CORS_ORIGIN="$CORS_ORIGIN" timeout 5 npm run start:game &
sleep 3
curl -sf "http://127.0.0.1:3001/health" && echo " OK" || echo " WARN: health check failed"
pkill -f "start:game" || true

echo ""
echo "Done. Next steps:"
echo "  1. sudo cp deploy/oracle/smokedog-game.service /etc/systemd/system/"
echo "  2. Edit WorkingDirectory if not $APP_DIR"
echo "  3. sudo systemctl enable --now smokedog-game"
echo "  4. Open OCI security list: TCP 3001 (or use nginx on 443)"
echo "  5. Test the Cloudflare UI after setting NEXT_PUBLIC_SOCKET_URL in wrangler.jsonc"
