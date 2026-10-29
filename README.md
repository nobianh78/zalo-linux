# Zalo PC Native for Linux

Bản phân phối Zalo PC chạy thuần Native trên hệ điều hành Linux (x86_64), sử dụng kiến trúc Electron kết hợp Linux Native Modules. Hoàn toàn không sử dụng Wine, máy ảo hoặc lớp tương thích Windows.

---

## Cài đặt nhanh

Người dùng Ubuntu, Debian, Linux Mint và các bản phân phối dẫn xuất có thể cài đặt tự động bằng một dòng lệnh duy nhất trong Terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/nobianh78/zalo-linux/main/install.sh | sudo bash
```

Script sẽ tự động:
- Tải bản phát hành `.deb` mới nhất từ GitHub Releases.
- Tự động cấu hình và cài đặt đầy đủ các gói phụ thuộc qua `apt`.
- Đăng ký menu ứng dụng và biểu tượng hệ thống.

---

## Tính năng chính

### 1. Thoại và Video Call Native (ZCall Engine)
- **Cuộc gọi hai chiều**: Hỗ trợ đầy đủ tiếp nhận và khởi tạo cuộc gọi thoại, video giữa PC và điện thoại.
- **Hạ tầng âm thanh**: Tích hợp trực tiếp PipeWire, PulseAudio và ALSA. Sử dụng codec Opus 16kHz mono (20ms) thời gian thực.
- **Mã hóa và giải mã hình ảnh**: Ứng dụng WebCodecs (H.264 Annex-B) tối ưu độ trễ thấp, hỗ trợ khung hình thu nhỏ (Picture-in-Picture) và tận dụng tăng tốc phần cứng GPU.
- **Bảng điều khiển thiết bị**: Cho phép tùy chọn Microphone (kèm thước đo âm lượng thực tế), Loa (kèm tính năng thử chuông), và Camera (kèm màn hình xem trước).

### 2. Xử lý đa phương tiện
- **Xử lý hình ảnh**: Tích hợp thư viện Sharp native cho việc sinh thumbnail và căn chỉnh kích thước ảnh.
- **Xem trước video**: Tích hợp FFmpeg native trích xuất hình thu nhỏ từ tập tin video.
- **Định dạng JPEG XL**: Hỗ trợ giải mã định dạng ảnh JXL trực tiếp.

### 3. Cơ sở dữ liệu và lưu trữ
- **SQLite3 / SQLCipher**: Binding native ABI-stable (N-API v6) phục vụ lưu trữ, mã hóa và đồng bộ lịch sử tin nhắn.
- **Hệ thống tập tin**: Truy xuất trực tiếp hệ thống tập tin Linux (ext4, btrfs, zfs).

### 4. Tích hợp môi trường máy tính để bàn (Desktop Integration)
- Khay hệ thống (System Tray) với đầy đủ menu ngữ cảnh.
- Thông báo hệ thống qua D-Bus / Desktop Notifications (libnotify).
- Định danh cửa sổ chuẩn (`WM_CLASS`) tương thích GNOME Shell, KDE Plasma, XFCE.

### 5. Tự động kiểm tra và cập nhật (In-app Auto-Update)
- Tự động kiểm tra phiên bản mới từ GitHub Releases khi ứng dụng khởi chạy và định kỳ trong nền.
- Hiển thị hộp thoại thông báo cập nhật trực tiếp trong ứng dụng khi có phiên bản mới.
- Hỗ trợ tải và tự động cài đặt nâng cấp cho cả định dạng `.deb` (qua PolicyKit/pkexec) và `.AppImage` (tự động ghi đè in-place).

---

## Hướng dẫn cho nhà phát triển

### 1. Chạy trực tiếp từ mã nguồn

Yêu cầu môi trường:
- Node.js (khuyến nghị phiên bản 18, 20 hoặc 22)
- npm

```bash
# Cài đặt các gói phụ thuộc
npm install

# Khởi chạy ứng dụng
./start_zalo.sh
```

### 2. Đóng gói bộ cài đặt (.deb / AppImage)

Sử dụng `electron-builder` tích hợp sẵn:

```bash
# Đóng gói cả file .deb và AppImage
npm run dist

# Đóng gói riêng định dạng .deb
npm run dist:deb

# Đóng gói riêng định dạng AppImage
npm run dist:appimage
```

Tập tin sau khi đóng gói sẽ nằm tại thư mục `dist/`:
- `dist/zalo-linux_26.10.10_amd64.deb`
- `dist/Zalo-26.10.10.AppImage`

### 3. Cài đặt tập tin .deb đã build

```bash
sudo dpkg -i dist/zalo-linux_26.10.10_amd64.deb
```

---

## Gỡ cài đặt

Để gỡ bỏ Zalo khỏi hệ thống:

```bash
sudo apt remove zalo-linux
```
