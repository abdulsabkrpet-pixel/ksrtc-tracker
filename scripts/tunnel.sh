#!/usr/bin/env bash
# Quick public HTTPS tunnel launcher for KSRTC Bus Tracker
echo "=================================================="
echo "🚍 Launching Live Public HTTPS Tunnel for KSRTC..."
echo "=================================================="
echo "Connecting to localhost.run public tunnel..."
ssh -o StrictHostKeyChecking=no -R 80:localhost:3000 nokey@localhost.run
