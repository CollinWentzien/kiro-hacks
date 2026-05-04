#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/deploy.env"

echo "==> Deploying to $PI_USER@$PI_HOST:$PI_DIR"
echo "    Backend: port $BACKEND_PORT | Frontend: port $FRONTEND_PORT"

# Build frontend with correct API URL
echo "==> Building frontend..."
cd "$SCRIPT_DIR"
VITE_GROQ_API_KEY=$VITE_GROQ_API_KEY npm run build

# Sync files to Pi
echo "==> Syncing files..."
rsync -avz --delete \
  --exclude 'node_modules/' \
  --exclude '.env' \
  --exclude 'deploy.env' \
  --exclude 'deploy.sh' \
  --exclude '.git/' \
  --exclude 'data/cities/*.json' \
  "$SCRIPT_DIR/" \
  "$PI_USER@$PI_HOST:$PI_DIR/"

# Write .env on the server
echo "==> Writing .env on server..."
ssh "$PI_USER@$PI_HOST" "cat > $PI_DIR/.env" <<EOF
VITE_GROQ_API_KEY=$VITE_GROQ_API_KEY
PORT=$BACKEND_PORT
EOF

# Install deps and restart on Pi
echo "==> Installing deps and restarting services..."
ssh "$PI_USER@$PI_HOST" bash <<REMOTE
  set -e
  cd $PI_DIR
  mkdir -p logs

  npm install --omit=dev

  # Stop existing processes
  pkill -f "node index.js" 2>/dev/null || true
  pkill -f "serve -s dist" 2>/dev/null || true
  sleep 1

  # Start backend
  PORT=$BACKEND_PORT nohup node index.js > logs/backend.log 2>&1 &
  echo "Backend started on port $BACKEND_PORT (PID \$!)"

  # Start frontend static server
  nohup serve -s dist -l $FRONTEND_PORT > logs/frontend.log 2>&1 &
  echo "Frontend started on port $FRONTEND_PORT (PID \$!)"
REMOTE

echo ""
echo "==> Done!"
echo "    Frontend: http://$PI_HOST:$FRONTEND_PORT"
echo "    Backend:  http://$PI_HOST:$BACKEND_PORT"
