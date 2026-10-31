#!/usr/bin/env bash
# Zalo PC cho Linux (không chính thức) - trình cài đặt cho mọi bản phân phối
# https://github.com/nobianh78/zalo-linux
#
#   curl -fsSL https://raw.githubusercontent.com/nobianh78/zalo-linux/main/install.sh | bash
#
# Tuỳ chọn:  --uninstall          gỡ Zalo
#            --appimage           chỉ dùng bản AppImage (không cần quyền root);
#                                 đi kèm --uninstall thì chỉ gỡ bản AppImage
#            --no-gui             cài trong terminal, không mở cửa sổ cài đặt
#
# Có màn hình đồ hoạ và zenity thì hiện cửa sổ cài đặt (tiến trình, hỏi mật khẩu bằng
# hộp thoại của hệ thống qua pkexec). Không có thì cài trong terminal như bình thường.
#
# Cách cài được chọn tự động:
#   apt (Ubuntu, Debian, Mint, Pop!_OS...)  -> gói .deb
#   dnf / zypper (Fedora, openSUSE...)      -> gói .rpm nếu bản phát hành có, nếu không thì AppImage
#   còn lại (Arch, Manjaro, Void...)         -> AppImage trong ~/.local, kèm biểu tượng menu
set -euo pipefail

REPO="nobianh78/zalo-linux"
APP_ID="zalo-linux"
ICON_URL="https://raw.githubusercontent.com/${REPO}/main/assets/icons/256x256.png"

RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; NC='\033[0m'
GUI=0          # 1 = zenity window (decided after argument parsing)
GUI_OPEN=0     # progress window is open on fd 3
GUI_PCT=0
GUI_WARNINGS=""
LOG=""
ZTITLE="Cài đặt Zalo Linux"

# Send a line to the zenity progress window: a number sets the bar, "# text" sets the label.
gp() {
  [ "$GUI_OPEN" -eq 1 ] || return 0
  printf '%s\n' "$1" >&3 2>/dev/null || gui_cancelled
}
gui_cancelled() {
  GUI_OPEN=0
  [ -n "${CURL_PID:-}" ] && kill "$CURL_PID" 2>/dev/null
  echo "Đã huỷ cài đặt."
  exit 1
}
gui_close() {
  [ "$GUI_OPEN" -eq 1 ] || return 0
  printf '100\n' >&3 2>/dev/null || true
  exec 3>&-
  GUI_OPEN=0
}
# Pango markup: escape the few characters that matter.
esc() { local t="${1//&/&amp;}"; t="${t//</&lt;}"; printf '%s' "${t//>/&gt;}"; }
zen() { zenity --title="$ZTITLE" --width=440 ${ZICON:+"$ZICON"} "$@" 2>/dev/null; }

info() { echo -e "${BLUE}==>${NC} $*"; gp "# $*"; }
ok()   { echo -e "${GREEN}✔${NC} $*"; }
warn() { echo -e "${YELLOW}!${NC} $*"; [ "$GUI" -eq 1 ] && GUI_WARNINGS="${GUI_WARNINGS}• $(esc "$*")"$'\n'; return 0; }
die()  {
  echo -e "${RED}✘ $*${NC}" >&2
  if [ "$GUI" -eq 1 ]; then
    gui_close
    local detail=""
    [ -n "$LOG" ] && [ -s "$LOG" ] && detail=$'\n\n'"<small>$(esc "$(tail -n 6 "$LOG")")</small>"
    zen --error --text="<b>Cài đặt thất bại</b>"$'\n\n'"$(esc "$*")$detail" || true
  fi
  exit 1
}

MODE="auto"
ONLY_APPIMAGE=0
WANT_GUI=1
for arg in "$@"; do
  case "$arg" in
    --uninstall) MODE="uninstall" ;;
    --appimage)  ONLY_APPIMAGE=1 ;;
    --no-gui)    WANT_GUI=0 ;;
    -h|--help)   echo "Dùng: install.sh [--appimage] [--uninstall] [--no-gui]"; exit 0 ;;
  esac
done

# ---------------------------------------------------------------------------
# Who are we installing for? (works with "| bash" and "| sudo bash")
# ---------------------------------------------------------------------------
if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
  TARGET_USER="${SUDO_USER:-root}"
else
  SUDO="sudo"
  TARGET_USER="$(id -un)"
fi
TARGET_HOME="${ZALO_INSTALL_HOME:-$(getent passwd "$TARGET_USER" | cut -d: -f6)}"  # override only for testing
[ -n "$TARGET_HOME" ] || TARGET_HOME="$HOME"

run_as_user() {
  if [ "$(id -u)" -eq 0 ] && [ "$TARGET_USER" != "root" ]; then
    sudo -u "$TARGET_USER" -- "$@"
  else
    "$@"
  fi
}

need_root() {
  if [ -n "$SUDO" ] && ! command -v sudo >/dev/null 2>&1; then
    die "Cần quyền quản trị nhưng không có lệnh sudo. Hãy chạy lại với quyền root."
  fi
}

have() { command -v "$1" >/dev/null 2>&1; }

# The window only for a normal user install on a graphical session (zenity as root does
# not reach a Wayland/X session reliably).
if [ "$MODE" != "uninstall" ] && [ "$WANT_GUI" -eq 1 ] && [ "$(id -u)" -ne 0 ] \
   && { [ -n "${DISPLAY:-}" ] || [ -n "${WAYLAND_DISPLAY:-}" ]; } && have zenity; then
  GUI=1
fi

# Run a shell snippet as root: the desktop password dialog (pkexec) in GUI mode, sudo otherwise.
root_sh() {
  if [ "$GUI" -eq 1 ] && have pkexec; then
    pkexec sh -c "$1"
  else
    need_root
    $SUDO sh -c "$1"
  fi
}
# In GUI mode command output goes to the log (shown on failure), otherwise to the terminal.
log_run() {
  if [ "$GUI" -eq 1 ]; then "$@" >>"$LOG" 2>&1; else "$@"; fi
}

detect_pm() {
  if have apt-get && have dpkg; then echo apt
  elif have dnf; then echo dnf
  elif have zypper; then echo zypper
  elif have pacman; then echo pacman
  else echo other
  fi
}

APPIMAGE_DIR="$TARGET_HOME/.local/opt/$APP_ID"
APPIMAGE_PATH="$APPIMAGE_DIR/Zalo.AppImage"
DESKTOP_FILE="$TARGET_HOME/.local/share/applications/$APP_ID.desktop"
ICON_FILE="$TARGET_HOME/.local/share/icons/hicolor/256x256/apps/$APP_ID.png"
OLD_ICON_FILE="$TARGET_HOME/.local/share/icons/hicolor/192x192/apps/$APP_ID.png"  # used before v26.10.22
BIN_LINK="$TARGET_HOME/.local/bin/$APP_ID"

# ---------------------------------------------------------------------------
# Uninstall
# ---------------------------------------------------------------------------
if [ "$MODE" = "uninstall" ]; then
  removed=0
  # User-level AppImage first: never needs a password.
  if [ -e "$APPIMAGE_PATH" ] || [ -e "$DESKTOP_FILE" ]; then
    info "Gỡ bản AppImage..."
    rm -rf "$APPIMAGE_DIR"; rm -f "$DESKTOP_FILE" "$ICON_FILE" "$OLD_ICON_FILE" "$BIN_LINK"
    have update-desktop-database && run_as_user update-desktop-database "$TARGET_HOME/.local/share/applications" >/dev/null 2>&1 || true
    removed=1
  fi
  if [ "$ONLY_APPIMAGE" -eq 0 ]; then
    if have dpkg && dpkg -s "$APP_ID" >/dev/null 2>&1; then
      need_root; info "Gỡ gói .deb..."
      if $SUDO apt-get remove -y "$APP_ID"; then removed=1; else warn "Không gỡ được gói .deb."; fi
    fi
    if have rpm && rpm -q "$APP_ID" >/dev/null 2>&1; then
      need_root; info "Gỡ gói .rpm..."
      if { have dnf && $SUDO dnf remove -y "$APP_ID"; } || { have zypper && $SUDO zypper --non-interactive remove "$APP_ID"; }; then removed=1; else warn "Không gỡ được gói .rpm."; fi
    fi
  fi
  if [ "$removed" -eq 1 ]; then
    ok "Đã gỡ Zalo. Dữ liệu chat vẫn còn ở ~/.config/ZaloData (xoá tay nếu muốn)."
  else
    warn "Không tìm thấy bản Zalo nào để gỡ."
  fi
  exit 0
fi

# ---------------------------------------------------------------------------
# Pre-flight
# ---------------------------------------------------------------------------
echo -e "${BLUE}==========================================${NC}"
echo -e "${GREEN}    Cài đặt Zalo PC cho Linux (x86_64)    ${NC}"
echo -e "${BLUE}==========================================${NC}"

[ "$(uname -m)" = "x86_64" ] || die "Máy của bạn là $(uname -m). Hiện chỉ hỗ trợ x86_64 (amd64)."
have curl || die "Thiếu lệnh curl. Hãy cài curl rồi chạy lại."

PM="$(detect_pm)"
[ "$ONLY_APPIMAGE" -eq 1 ] && PM="appimage"
info "Trình quản lý gói: $PM"

TMP="$(mktemp -d)"
trap '[ -n "${CURL_PID:-}" ] && kill "$CURL_PID" 2>/dev/null; rm -rf "$TMP"' EXIT
LOG="$TMP/install.log"
if [ "$GUI" -eq 1 ]; then
  trap '' PIPE   # a closed progress window makes writes fail (handled) instead of killing us
  # zenity 4 has --icon; zenity 3 (Ubuntu 22.04, Mint 21) only knows --window-icon.
  if curl -fsSL "$ICON_URL" -o "$TMP/icon.png" 2>/dev/null; then
    case "$(zenity --version 2>/dev/null)" in
      3.*) ZICON="--window-icon=$TMP/icon.png" ;;
      *)   ZICON="--icon=$TMP/icon.png" ;;
    esac
  fi
fi

# ---------------------------------------------------------------------------
# Find the latest release assets
# ---------------------------------------------------------------------------
info "Đang tìm bản phát hành mới nhất..."
curl -fsSL -H "Accept: application/vnd.github+json" "https://api.github.com/repos/${REPO}/releases/latest" -o "$TMP/release.json" \
  || die "Không kết nối được GitHub. Kiểm tra mạng rồi thử lại."

# Prints "<url> <sha256-or-empty>" for the first asset whose name matches the regex.
asset() {
  local pattern="$1"
  if have python3; then
    python3 - "$TMP/release.json" "$pattern" <<'PY'
import json, re, sys
data = json.load(open(sys.argv[1]))
for a in data.get("assets", []):
    if re.search(sys.argv[2], a["name"]):
        d = a.get("digest") or ""
        print(a["browser_download_url"], d.split(":", 1)[1] if d.startswith("sha256:") else "-", a.get("size") or "")
        break
PY
  else
    local url
    url="$(grep -o '"browser_download_url": *"[^"]*"' "$TMP/release.json" | cut -d'"' -f4 | grep -E "$pattern" | head -n1 || true)"
    [ -n "$url" ] && echo "$url -"
  fi
}

VERSION="$(grep -o '"tag_name": *"[^"]*"' "$TMP/release.json" | head -n1 | cut -d'"' -f4)"
info "Phiên bản: ${VERSION:-không rõ}"

if [ "$GUI" -eq 1 ]; then
  case "$PM" in
    apt)        how="gói <b>.deb</b> (hệ thống sẽ hỏi mật khẩu quản trị)" ;;
    dnf|zypper) how="gói <b>.rpm</b> (hệ thống sẽ hỏi mật khẩu quản trị)" ;;
    *)          how="bản <b>AppImage</b> vào ~/.local, không cần mật khẩu" ;;
  esac
  zen --question --ok-label="Cài đặt" --cancel-label="Huỷ" --text="<big><b>Zalo Linux $(esc "${VERSION:-}")</b></big>
Zalo PC cho Linux. Ứng dụng không chính thức, không liên kết với VNG.

Sẽ cài $how.

Lần mở đầu tiên, ứng dụng tải bộ cài Zalo PC chính thức (khoảng 213 MB) từ máy chủ của Zalo." \
    || { echo "Đã huỷ cài đặt."; exit 0; }
  exec 3> >(zenity --progress --title="$ZTITLE" --width=440 ${ZICON:+"$ZICON"} \
              --text="Đang chuẩn bị..." --percentage=0 --auto-close 2>/dev/null)
  GUI_OPEN=1
fi

download() {
  local url="$1" sum="$2" out="$3" size="${4:-}"
  [ "$sum" = "-" ] && sum=""
  info "Đang tải $(basename "$url")..."
  if [ "$GUI" -eq 1 ]; then
    curl -fsSL "$url" -o "$out" &
    CURL_PID=$!
    local mb=""
    [ -n "$size" ] && mb=" / $((size / 1048576))"
    while kill -0 "$CURL_PID" 2>/dev/null; do
      local got=0
      [ -f "$out" ] && got=$(stat -c %s "$out" 2>/dev/null || echo 0)
      [ -n "$size" ] && [ "$size" -gt 0 ] && gp "$((got * 80 / size))"
      gp "# Đang tải Zalo Linux... $((got / 1048576))$mb MB"
      sleep 0.5
    done
    wait "$CURL_PID" || { CURL_PID=""; die "Tải file thất bại. Kiểm tra mạng rồi thử lại."; }
    CURL_PID=""
    gp 80
  else
    curl -fL --progress-bar "$url" -o "$out" || die "Tải file thất bại."
  fi
  if [ -n "$sum" ] && have sha256sum; then
    echo "$sum  $out" | sha256sum -c --status || die "File tải về bị lỗi (sai SHA256). Hãy thử lại."
    ok "Đã kiểm tra SHA256"
  fi
}

# ---------------------------------------------------------------------------
# Install methods
# ---------------------------------------------------------------------------
install_deb() {
  read -r url sum size <<<"$(asset '_amd64\.deb$')" || true
  [ -n "${url:-}" ] || die "Bản phát hành không có file .deb."
  download "$url" "${sum:-}" "$TMP/$APP_ID.deb" "${size:-}"
  info "Đang cài gói .deb (cần mật khẩu quản trị)..."
  gp 85
  log_run root_sh "apt-get update -qq || true; apt-get install -y '$TMP/$APP_ID.deb'" \
    || die "Không cài được gói .deb (có thể bạn đã huỷ hộp nhập mật khẩu)."
  ok "Đã cài bằng apt. Lần sau cập nhật tự động trong ứng dụng."
}

install_rpm() {
  read -r url sum size <<<"$(asset '\.x86_64\.rpm$')" || true
  if [ -z "${url:-}" ]; then
    warn "Bản phát hành chưa có file .rpm — chuyển sang AppImage."
    install_appimage
    return
  fi
  download "$url" "${sum:-}" "$TMP/$APP_ID.rpm" "${size:-}"
  info "Đang cài gói .rpm (cần mật khẩu quản trị)..."
  gp 85
  if [ "$PM" = "dnf" ]; then
    log_run root_sh "dnf install -y '$TMP/$APP_ID.rpm'" || die "Không cài được gói .rpm."
  else
    log_run root_sh "zypper --non-interactive install --allow-unsigned-rpm '$TMP/$APP_ID.rpm'" || die "Không cài được gói .rpm."
  fi
  ok "Đã cài bằng $PM. Lần sau cập nhật tự động trong ứng dụng."
}

has_fuse2() {
  ldconfig -p 2>/dev/null | grep -q 'libfuse\.so\.2' && return 0
  ls /usr/lib*/libfuse.so.2* /usr/lib/*/libfuse.so.2* >/dev/null 2>&1
}

# Best effort: FUSE 2 (fast AppImage start) + helpers used by the call engine
# (python3, aplay from alsa-utils, pactl). Failure here never stops the install.
install_appimage_deps() {
  { [ "$GUI" -eq 1 ] && have pkexec; } || have sudo || [ -z "$SUDO" ] || return 0
  local cmd
  case "$(detect_pm)" in
    apt)    cmd="apt-get install -y python3 alsa-utils pulseaudio-utils libfuse2t64 || apt-get install -y python3 alsa-utils pulseaudio-utils libfuse2" ;;
    dnf)    cmd="dnf install -y python3 alsa-utils pulseaudio-utils fuse-libs" ;;
    zypper) cmd="zypper --non-interactive install python3 alsa-utils pulseaudio-utils libfuse2" ;;
    pacman) cmd="pacman -S --needed --noconfirm python alsa-utils libpulse fuse2" ;;
    *)      return 0 ;;
  esac
  info "Cài thư viện hỗ trợ (FUSE 2, âm thanh cho cuộc gọi) — có thể hỏi mật khẩu..."
  gp 85
  root_sh "$cmd" >/dev/null 2>&1 || warn "Không cài được một số thư viện hỗ trợ — Zalo vẫn chạy, cuộc gọi có thể thiếu âm thanh."
}

install_appimage() {
  read -r url sum size <<<"$(asset '\.AppImage$')" || true
  [ -n "${url:-}" ] || die "Bản phát hành không có file .AppImage."
  download "$url" "${sum:-}" "$TMP/Zalo.AppImage" "${size:-}"

  if [ "$ONLY_APPIMAGE" -eq 0 ]; then install_appimage_deps || true; fi

  info "Đang cài vào $APPIMAGE_DIR (không cần quyền root)..."
  gp 95
  run_as_user mkdir -p "$APPIMAGE_DIR" "$(dirname "$DESKTOP_FILE")" "$(dirname "$ICON_FILE")" "$(dirname "$BIN_LINK")"
  install -m 0755 "$TMP/Zalo.AppImage" "$APPIMAGE_PATH.new"
  mv -f "$APPIMAGE_PATH.new" "$APPIMAGE_PATH"
  curl -fsSL "$ICON_URL" -o "$ICON_FILE" 2>/dev/null || true
  rm -f "$OLD_ICON_FILE"

  # Without FUSE 2 the AppImage still runs by extracting itself first (slower start).
  local exec_line="\"$APPIMAGE_PATH\" %U"
  if ! has_fuse2; then
    exec_line="env APPIMAGE_EXTRACT_AND_RUN=1 \"$APPIMAGE_PATH\" %U"
    warn "Không có FUSE 2: Zalo vẫn chạy được nhưng mở chậm hơn vài giây. Cài gói fuse2/libfuse2 để nhanh hơn."
  fi

  cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Name=Zalo Linux
Comment=Zalo PC cho Linux (không chính thức)
Exec=$exec_line
Icon=$ICON_FILE
Terminal=false
Type=Application
Categories=Network;InstantMessaging;Chat;
StartupWMClass=Zalo
EOF

  cat > "$BIN_LINK" <<EOF
#!/bin/sh
$( has_fuse2 || echo 'export APPIMAGE_EXTRACT_AND_RUN=1' )
exec "$APPIMAGE_PATH" "\$@"
EOF
  chmod 0755 "$BIN_LINK"

  if [ "$(id -u)" -eq 0 ] && [ "$TARGET_USER" != "root" ]; then
    chown -R "$TARGET_USER": "$APPIMAGE_DIR" "$DESKTOP_FILE" "$ICON_FILE" "$BIN_LINK" 2>/dev/null || true
  fi
  have update-desktop-database && run_as_user update-desktop-database "$(dirname "$DESKTOP_FILE")" >/dev/null 2>&1 || true
  ok "Đã cài bản AppImage. Lần sau cập nhật tự động trong ứng dụng."
}

case "$PM" in
  apt)          install_deb ;;
  dnf|zypper)   install_rpm ;;
  *)            install_appimage ;;
esac

if [ "$GUI" -eq 1 ]; then
  gui_close
  extra=""
  [ -n "$GUI_WARNINGS" ] && extra=$'\n\n'"<b>Lưu ý:</b>"$'\n'"$GUI_WARNINGS"
  if zen --question --ok-label="Mở Zalo Linux" --cancel-label="Đóng" \
       --text="<big><b>Đã cài Zalo Linux $(esc "${VERSION:-}")</b></big>

Lần sau mở từ menu ứng dụng (tìm \"Zalo\"). Ứng dụng tự cập nhật khi có bản mới.$extra"; then
    if have gtk-launch && gtk-launch "$APP_ID" >/dev/null 2>&1; then :
    elif have "$APP_ID"; then setsid "$APP_ID" >/dev/null 2>&1 < /dev/null &
    elif [ -x "$BIN_LINK" ]; then setsid "$BIN_LINK" >/dev/null 2>&1 < /dev/null &
    fi
  fi
fi

echo ""
echo -e "${GREEN}====================================================${NC}"
echo -e "${GREEN}  Cài đặt Zalo thành công!                          ${NC}"
echo -e "${GREEN}====================================================${NC}"
echo -e "Mở Zalo từ menu ứng dụng (tìm \"Zalo\") hoặc gõ: ${YELLOW}${APP_ID}${NC}"
echo -e "Gỡ cài đặt: ${YELLOW}curl -fsSL https://raw.githubusercontent.com/${REPO}/main/install.sh | bash -s -- --uninstall${NC}"
echo ""
