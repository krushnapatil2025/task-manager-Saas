#!/bin/bash
# ════════════════════════════════════════════════════════════════════
# setup-ec2.sh — Strideo — Amazon Linux 2023 First-Time Setup
# ════════════════════════════════════════════════════════════════════
# RUN THIS ON YOUR EC2 SERVER (Amazon Linux 2023)
# 1. SSH via PuTTY into EC2
# 2. Upload this file via WinSCP to /home/ec2-user/
# 3. Make executable: chmod +x setup-ec2.sh
# 4. Run: ./setup-ec2.sh
# ════════════════════════════════════════════════════════════════════

set -e

echo "╔══════════════════════════════════════════╗"
echo "║   Strideo — EC2 Setup (Amazon Linux)     ║"
echo "╚══════════════════════════════════════════╝"

# ── UPDATE THIS: Your GitHub repo URL ───────────────────────────────
REPO_URL="https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME.git"
APP_DIR="/var/www/strideo"

# ── Step 1: Update system ─────────────────────────────────────────────
echo ""
echo "► [1/8] Updating system packages (using dnf)..."
sudo dnf update -y
echo "✅ System updated."

# ── Step 2: Install Node.js 20 LTS ───────────────────────────────────
echo ""
echo "► [2/8] Installing Node.js 20 LTS..."
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
echo "✅ Node.js $(node -v) installed."

# ── Step 3: Install Nginx ─────────────────────────────────────────────
echo ""
echo "► [3/8] Installing Nginx..."
sudo dnf install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
echo "✅ Nginx installed and running."

# ── Step 4: Install Git ───────────────────────────────────────────────
echo ""
echo "► [4/8] Installing Git..."
sudo dnf install -y git
echo "✅ Git $(git --version) installed."

# ── Step 5: Clone project ─────────────────────────────────────────────
echo ""
echo "► [5/8] Setting up app directory..."
sudo mkdir -p $APP_DIR
sudo chown ec2-user:ec2-user $APP_DIR

if [ "$REPO_URL" != "https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME.git" ]; then
    echo "Cloning from GitHub..."
    git clone $REPO_URL $APP_DIR
    echo "✅ Project cloned to $APP_DIR."
else
    echo "⚠️  No GitHub repo URL set."
    echo "   Upload your project files to $APP_DIR using WinSCP."
    read -p "   Press ENTER once files are uploaded..."
fi

# ── Step 6: Setup .env ────────────────────────────────────────────────
echo ""
echo "► [6/8] Setting up environment variables..."
cd $APP_DIR
if [ -f ".env.production" ]; then
    cp .env.production .env
    echo "✅ .env.production → .env"
fi
echo ""
echo "⚠️  IMPORTANT: Open .env and set VITE_APP_URL to your EC2 IP!"
echo "   Run: nano $APP_DIR/.env"
read -p "   Press ENTER once you have updated VITE_APP_URL in .env..."

# ── Step 7: Build project ─────────────────────────────────────────────
echo ""
echo "► [7/8] Installing dependencies and building..."
npm install
npm run build
echo "✅ Build complete. Output: $APP_DIR/dist"

# ── Step 8: Configure Nginx ───────────────────────────────────────────
echo ""
echo "► [8/8] Configuring Nginx..."
sudo rm -f /etc/nginx/conf.d/default.conf

if [ -f "nginx.conf" ]; then
    sudo cp nginx.conf /etc/nginx/conf.d/strideo.conf
    echo "✅ nginx.conf copied."
    echo ""
    echo "⚠️  Now update server_name in nginx config with your EC2 IP:"
    echo "   sudo nano /etc/nginx/conf.d/strideo.conf"
    read -p "   Press ENTER after updating server_name..."
    sudo nginx -t && sudo systemctl reload nginx
    echo "✅ Nginx configured and reloaded."
fi

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   ✅  Setup Complete!                                   ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║                                                          ║"
echo "║   Your app should now be live at:                        ║"
echo "║   http://YOUR_EC2_PUBLIC_IP                              ║"
echo "║                                                          ║"
echo "║   REQUIRED NEXT STEPS:                                   ║"
echo "║   1. Google Cloud Console: add EC2 IP to OAuth origins   ║"
echo "║      console.cloud.google.com -> APIs -> Credentials     ║"
echo "║   2. Supabase: update Site URL                           ║"
echo "║      supabase.com/dashboard -> Auth -> URL Configuration ║"
echo "║                                                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
