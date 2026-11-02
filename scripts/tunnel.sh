#!/data/data/com.termux/files/usr/bin/bash
# Quick public HTTPS tunnel launcher for KSRTC Bus Tracker with auto-reconnect & keepalive
echo "=================================================="
echo "🚍 Launching Live Public HTTPS Tunnel for KSRTC..."
echo "=================================================="

while true; do
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Connecting to localhost.run public tunnel..."
  ssh -o StrictHostKeyChecking=no \
      -o ServerAliveInterval=20 \
      -o ServerAliveCountMax=5 \
      -o ExitOnForwardFailure=yes \
      -R 80:localhost:3000 nokey@localhost.run
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Tunnel closed. Reconnecting in 3 seconds..."
  sleep 3
done
