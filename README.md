# Zalo PC Native for Linux 🐧

Bản port chạy Native Zalo PC trên Linux (sử dụng Electron + Native Modules).

## Tính năng
- ⚡ **Chạy trực tiếp native**: Không cần Wine, không overhead giả lập Windows.
- 🖼️ **Xử lý ảnh & Media**:
  - `sharp` native cho thumbnail và resize ảnh (thay cho Windows `zimage.node`).
  - `ffmpeg` tích hợp cho video preview (thay cho Windows `mp4thumb.node`).
  - Fallback decode ảnh JXL qua `sharp`.
- 🗄️ **SQLite3**: Native Linux binding ABI-stable (N-API v6).
- 📁 **Quản lý dữ liệu**: Traversal filesystem native (`ext4`, `zwalker`).
- 🖥️ **Tích hợp Linux Desktop**:
  - Hỗ trợ GNOME Dash/Dock grouping (`zalo.desktop`).
  - Hỗ trợ System Tray và Native OS Notifications.
  - Cửa sổ Photo Viewer frameless, đồng bộ giao diện hệ thống.

## Cài đặt nhanh (1 dòng lệnh) ⚡

Không cần clone mã nguồn hay cài đặt Node.js/npm, chỉ cần chạy đúng 1 dòng lệnh sau vào Terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/nobianh78/zalo-linux/main/install.sh | sudo bash
```

---

## Cài đặt thủ công & Phát triển

### Cách 1: Chạy trực tiếp từ mã nguồn
```bash
# Cài đặt dependencies
npm install

# Khởi chạy
npm start

# Hoặc chạy script
./start_zalo.sh
```

### Cách 2: Đóng gói cài đặt (.deb / AppImage)
```bash
# Build cả .deb và AppImage
npm run dist

# Hoặc build riêng
npm run dist:deb
npm run dist:appimage
```
File cài đặt đầu ra sẽ nằm trong thư mục `dist/`:
- `dist/Zalo-26.10.10.AppImage`
- `dist/zalo-linux_26.10.10_amd64.deb`

## Cài đặt file .deb
```bash
sudo dpkg -i dist/zalo-linux_26.10.10_amd64.deb
```
