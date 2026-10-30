#!/usr/bin/env bash
set -e

# Zalo PC Native for Linux - One-line Installer
# Repository: https://github.com/nobianh78/zalo-linux

REPO="nobianh78/zalo-linux"
FALLBACK_DEB_URL="https://github.com/nobianh78/zalo-linux/releases/download/v26.10.20/zalo-linux_26.10.20_amd64.deb"

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}==========================================${NC}"
echo -e "${GREEN}      Cai dat Zalo PC Native Linux        ${NC}"
echo -e "${BLUE}==========================================${NC}"

# Check architecture
ARCH=$(uname -m)
if [ "$ARCH" != "x86_64" ]; then
    echo -e "${RED}[Lỗi] Kiến trúc máy của bạn là $ARCH. Zalo Linux hiện chỉ hỗ trợ x86_64 (amd64).${NC}"
    exit 1
fi

# Ensure curl and audio/call dependencies are installed
MISSING_PKGS=()
for pkg in curl python3 alsa-utils pulseaudio-utils; do
    if ! dpkg -s "$pkg" >/dev/null 2>&1; then
        MISSING_PKGS+=("$pkg")
    fi
done

if [ ${#MISSING_PKGS[@]} -gt 0 ]; then
    echo -e "${YELLOW}[*] Đang cài đặt các gói phụ thuộc cho cuộc gọi và hệ thống (${MISSING_PKGS[*]})...${NC}"
    if [ "$EUID" -ne 0 ]; then
        sudo apt-get update -qq && sudo apt-get install -y -qq "${MISSING_PKGS[@]}"
    else
        apt-get update -qq && apt-get install -y -qq "${MISSING_PKGS[@]}"
    fi
fi

# Query latest deb release URL from GitHub API
echo -e "${BLUE}[1/3] Đang tìm kiếm bản phát hành mới nhất từ GitHub...${NC}"
LATEST_DEB_URL=$(curl -s "https://api.github.com/repos/${REPO}/releases/latest" \
    | grep "browser_download_url.*_amd64\.deb" \
    | cut -d '"' -f 4 \
    | head -n 1 || true)

if [ -z "$LATEST_DEB_URL" ]; then
    echo -e "${YELLOW}[!] Không lấy được URL từ GitHub API. Sử dụng URL chính thức...${NC}"
    LATEST_DEB_URL="$FALLBACK_DEB_URL"
fi

TEMP_DEB="/tmp/zalo-linux-latest.deb"

# Download package
echo -e "${BLUE}[2/3] Đang tải Zalo PC (.deb)...${NC}"
echo -e "      Nguồn: ${LATEST_DEB_URL}"
curl -fSL --progress-bar "$LATEST_DEB_URL" -o "$TEMP_DEB"

# Install package
echo -e "${BLUE}[3/3] Đang tiến hành cài đặt vào hệ thống...${NC}"
if [ "$EUID" -ne 0 ]; then
    sudo apt install -y "$TEMP_DEB"
else
    apt install -y "$TEMP_DEB"
fi

# Cleanup
rm -f "$TEMP_DEB"

echo ""
echo -e "${GREEN}====================================================${NC}"
echo -e "${GREEN}  Cai dat Zalo PC Native thanh cong!               ${NC}"
echo -e "${GREEN}====================================================${NC}"
echo -e "Bạn có thể mở Zalo từ:"
echo -e "  1. Menu ứng dụng của hệ thống (tìm 'Zalo')"
echo -e "  2. Hoặc gõ lệnh trong terminal: ${YELLOW}zalo-linux${NC}"
echo ""
