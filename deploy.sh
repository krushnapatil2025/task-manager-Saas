#!/bin/bash
# ════════════════════════════════════════════════════════════════════
# deploy.sh — Strideo Task Manager — EC2 Quick Deploy Script
# ════════════════════════════════════════════════════════════════════
# RUN THIS ON YOUR EC2 SERVER after first-time setup.
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh
# ════════════════════════════════════════════════════════════════════

set -e  # Exit immediately on any error

echo "╔══════════════════════════════════════════╗"
echo "║   Strideo — EC2 Production Deploy        ║"
echo "╚══════════════════════════════════════════╝"

APP_DIR="/var/www/strideo"
NGINX_CONF="/etc/nginx/sites-available/strideo"

# ── Step 1: Navigate to app directory ────────────────────────────────
echo ""
echo "► [1/5] Navigating to $APP_DIR..."
cd $APP_DIR || { echo "❌ Directory $APP_DIR not found. Run setup first."; exit 1; }

# ── Step 2: Pull latest code from git ────────────────────────────────
echo ""
echo "► [2/5] Pulling latest code from git..."
git pull origin krushna
echo "✅ Code updated."

# ── Step 3: Install/update dependencies ─────────────────────────────
echo ""
echo "► [3/5] Installing npm dependencies..."
npm install --production=false
echo "✅ Dependencies installed."

# ── Step 4: Build the project ────────────────────────────────────────
echo ""
echo "► [4/5] Building for production..."
npm run build
echo "✅ Build complete. Output in: $APP_DIR/dist"

# ── Step 5: Reload Nginx ─────────────────────────────────────────────
echo ""
echo "► [5/5] Reloading Nginx..."
sudo nginx -t && sudo systemctl reload nginx
echo "✅ Nginx reloaded."

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   ✅  Deployment Complete!               ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Your app is live at: $(grep server_name $NGINX_CONF | awk '{print $2}' | tr -d ';')"
