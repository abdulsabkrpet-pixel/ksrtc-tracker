#!/data/data/com.termux/files/usr/bin/bash
# Push latest KSRTC Tracker commits to GitHub / Online Website
echo "=================================================="
echo "🚀 Pushing KSRTC Tracker to GitHub Online Repo..."
echo "=================================================="
cd /data/data/com.termux/files/home/ksrtc-tracker || exit 1
git push origin main
