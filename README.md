<p align="center"><img src="assets/icons/128x128.png" width="96" alt="Zalo Linux"></p>

# Zalo Linux: Zalo PC cho Linux (không chính thức)

Chạy ứng dụng Zalo PC trực tiếp trên Linux x86_64 bằng Electron, thay các module native chỉ có trên Windows/macOS bằng bản viết cho Linux. Không dùng Wine hay máy ảo.

> **Đây là dự án cộng đồng, không chính thức.** Dự án không liên kết, không được tài trợ hay chứng thực bởi VNG Corporation. "Zalo", logo và giao diện ứng dụng Zalo thuộc về VNG. Tên "Zalo Linux" chỉ mô tả việc chạy Zalo trên Linux; biểu tượng của dự án (bong bóng chat và chim cánh cụt) là hình vẽ riêng, không lấy từ logo Zalo. Dùng với tài khoản của bạn và tự chịu rủi ro.
>
> Nếu bạn là đại diện VNG và có yêu cầu về dự án này, hãy mở issue hoặc liên hệ người duy trì; yêu cầu sẽ được xử lý ngay.

---

## Cài đặt

Dán lệnh sau vào Terminal. Chạy được trên **mọi bản phân phối x86_64** (Ubuntu, Debian, Mint, Fedora, openSUSE, Arch, Manjaro…):

```bash
curl -fsSL https://raw.githubusercontent.com/nobianh78/zalo-linux/main/install.sh | bash
```

Script tự chọn cách cài phù hợp và kiểm tra SHA256 của file tải về:

| Bản phân phối | Cách cài | Cần mật khẩu? |
|---|---|---|
| Ubuntu, Debian, Mint, Pop!_OS… (apt) | Gói `.deb` | Có |
| Fedora, openSUSE… (dnf / zypper) | Gói `.rpm` (nếu bản phát hành chưa có thì dùng AppImage) | Có |
| Arch, Manjaro, Void và các bản khác | AppImage trong `~/.local`, kèm biểu tượng menu | Không bắt buộc* |

\* Script sẽ hỏi mật khẩu để cài thêm FUSE 2 và thư viện âm thanh cho cuộc gọi; bỏ qua thì Zalo vẫn chạy (mở chậm hơn vài giây).

Muốn kiểm tra script trước khi chạy: tải [install.sh](install.sh) về đọc, rồi `bash install.sh`.

**Tuỳ chọn**

```bash
# Chỉ dùng AppImage, không cần quyền root
curl -fsSL https://raw.githubusercontent.com/nobianh78/zalo-linux/main/install.sh | bash -s -- --appimage

# Gỡ cài đặt (dữ liệu chat ở ~/.config/ZaloData được giữ lại)
curl -fsSL https://raw.githubusercontent.com/nobianh78/zalo-linux/main/install.sh | bash -s -- --uninstall
```

Sau khi cài, Zalo tự cập nhật trong ứng dụng theo đúng định dạng đã cài (`.deb`, `.rpm` hoặc AppImage).

---

## Tính năng

### Tích hợp Linux

| Tính năng | Chi tiết |
|---|---|
| **Gõ tiếng Việt** | Tự nhận bộ gõ đang chạy (IBus: ibus-bamboo, ibus-unikey; Fcitx5: fcitx5-unikey, fcitx5-bamboo) và cấu hình `GTK_IM_MODULE` / `XMODIFIERS` cho riêng Zalo. Nếu thiếu module GTK3 của bộ gõ thì dùng XIM dự phòng và báo gói cần cài. |
| **X11 và Wayland** | Mặc định chạy X11/XWayland, chế độ gõ tiếng Việt ổn định nhất. Có thể chọn Wayland gốc (thử nghiệm). Xem [giới hạn bên dưới](#giới-hạn-đã-biết). |
| **HiDPI** | Tuỳ chọn ép tỉ lệ hiển thị 100–200% khi chữ bị mờ hoặc quá nhỏ trên màn hình scale lẻ. |
| **Chia sẻ màn hình trên Wayland** | Dùng PipeWire và xdg-desktop-portal: hộp chọn màn hình của hệ thống (GNOME / KDE) hiện ra một lần. Trên X11 vẫn dùng bảng chọn màn hình/cửa sổ của ứng dụng. |
| **Số tin chưa đọc** | Hiện số đỏ trên biểu tượng ở Ubuntu Dock, Dash to Dock, KDE Plasma (qua API `com.canonical.Unity.LauncherEntry`) và trên icon khay hệ thống. |
| **Khay hệ thống** | Sửa lỗi icon khay trống: Electron không đọc được `favicon.ico` trên Linux nên dùng bản PNG thay thế. Có tuỳ chọn thu nhỏ xuống khay khi bấm X. |
| **Thông báo** | Thông báo hệ thống qua D-Bus (libnotify), gắn đúng tên file `.desktop` để dock nhóm cửa sổ chính xác. |
| **Tự cập nhật** | Kiểm tra GitHub Releases khi mở app; cập nhật `.deb` qua PolicyKit (`pkexec`), `.AppImage` thì ghi đè tại chỗ. |

### Gọi thoại và video
- Gọi đi và nhận cuộc gọi thoại/video giữa máy tính và điện thoại.
- Âm thanh qua PipeWire / PulseAudio / ALSA, codec Opus.
- Hình ảnh mã hoá/giải mã H.264 bằng WebCodecs, có cửa sổ thu nhỏ (Picture-in-Picture).
- Chọn micro (có thanh đo âm lượng), loa (có nút thử chuông), camera (có xem trước).

### Đa phương tiện và lưu trữ
- Tạo ảnh thu nhỏ bằng [sharp](https://github.com/lovell/sharp), ảnh xem trước video bằng FFmpeg, giải mã ảnh JPEG XL.
- SQLite/SQLCipher (N-API) cho lịch sử tin nhắn.

### Tiện ích TADaZa
Bảng điều khiển ở thanh bên phải của cửa sổ chat:
- **Giao diện:** sáng / tối / theo hệ thống, đổi phông chữ và cỡ chữ (12–22px), hình nền chat có chỉnh độ mờ.
- **Riêng tư:** làm mờ tin nhắn, ảnh, tên (rê chuột để xem).
- **Dịch nhanh:** nút dịch ngay cạnh tin nhắn.
- **Linux: Bộ gõ & Hiển thị:** xem tình trạng bộ gõ/phiên đăng nhập, đổi chế độ X11/Wayland, tỉ lệ hiển thị, bật/tắt số tin chưa đọc.
- **Nhiều tài khoản:** mỗi hồ sơ có thư mục dữ liệu riêng.

Cấu hình lưu tại `~/.config/ZaloData/tadaza_config.json`.

> **Lưu ý:** Các tuỳ chọn ẩn "đang soạn tin", "đã xem", "đã nhận" can thiệp vào giao thức của Zalo và có thể trái điều khoản sử dụng của Zalo. Mặc định các tuỳ chọn này đều tắt; nếu bật, bạn tự chịu rủi ro với tài khoản của mình.

---

## Gõ tiếng Việt

Zalo tự cấu hình bộ gõ, bạn chỉ cần **đã cài và đang chạy** một trong hai:

```bash
# IBus (mặc định trên Ubuntu/GNOME)
sudo apt install ibus-bamboo        # hoặc ibus-unikey

# Fcitx5 (thường dùng trên KDE)
sudo apt install fcitx5 fcitx5-unikey fcitx5-frontend-gtk3
```

Kiểm tra trong **TADaZa → Riêng tư → Linux: Bộ gõ & Hiển thị**: dòng "Bộ gõ" cần có dấu ✅. Nếu bạn đã tự đặt `GTK_IM_MODULE`, Zalo giữ nguyên giá trị đó.

## Giới hạn đã biết

- **Wayland gốc trên GNOME không gõ được tiếng Việt.** Zalo chạy trên Electron 22 (Chromium 108); bản Chromium này chỉ hỗ trợ giao thức nhập liệu `text-input-v1`, trong khi GNOME chỉ cung cấp `text-input-v3`. Vì vậy mặc định là X11/XWayland. Trên KDE Plasma, Wayland gốc kết hợp Fcitx5 vẫn gõ được.
- **Electron 22 đã hết hạn hỗ trợ bảo mật.** Client Zalo hiện báo lỗi khi chạy trên Electron mới hơn; nâng cấp được là mục tiêu ưu tiên.
- Chỉ hỗ trợ x86_64.

## Biến môi trường

| Biến | Giá trị | Tác dụng |
|---|---|---|
| `ZALO_DISPLAY` | `x11` / `wayland` | Ghi đè chế độ hiển thị trong cài đặt |
| `ZALO_SCALE` | ví dụ `1.25`, `1.5` | Ép tỉ lệ hiển thị |
| `ZALO_PROFILE` | tên hồ sơ | Mở hồ sơ (tài khoản) cụ thể |

Ví dụ: `ZALO_DISPLAY=wayland zalo-linux`

---

## Dành cho nhà phát triển

Yêu cầu Node.js 18/20/22 và npm.

```bash
npm install
./start_zalo.sh            # chạy từ mã nguồn
npm run dist               # đóng gói .deb, .rpm và .AppImage vào dist/
npm run dist:deb           # chỉ .deb
npm run dist:rpm           # chỉ .rpm (cần gói rpm: sudo apt install rpm)
npm run dist:appimage      # chỉ .AppImage
```

Cấu trúc chính:

| Đường dẫn | Nội dung |
|---|---|
| `zalo_source/bootstrap.js` | Điểm khởi động, nạp lớp tương thích Linux trước client Zalo |
| `zalo_source/linux_compat/desktop_integration.js` | Bộ gõ, X11/Wayland, HiDPI, PipeWire, số tin chưa đọc |
| `zalo_source/linux_compat/mocks/` | Bản Linux của các module native (`zwalker`, `zfile`, `zimage`, `mp4thumb`, …) |
| `zalo_source/linux_compat/call_daemon.js` | Engine gọi thoại/video |
| `zalo_source/linux_compat/tadaza/` | Tiện ích TADaZa (`src/` và `css/` được gộp thành bundle khi khởi động) |
| `zalo_source/main-dist/`, `zalo_source/pc-dist/` | Client Zalo PC gốc của VNG |

---

## Dự án liên quan

Các dự án dưới đây cũng đưa Zalo PC lên Linux. Tên các module native giống nhau (`zwalker`, `zfile`, `zimage`, …) vì đó là tên do chính client Zalo quy định; phần cài đặt Linux và engine gọi điện trong repo này được viết độc lập.

- [realdtn2/zalo-linux-2026](https://github.com/realdtn2/zalo-linux-2026): port Linux từ client macOS
- [RuriMeiko/zalo-linux-native](https://github.com/RuriMeiko/zalo-linux-native): port các module native, gọi điện qua thư viện Android
- [VN-Linux-Family/zalo-for-linux](https://github.com/VN-Linux-Family/zalo-for-linux): AppImage tích hợp ZaDark
- [ruskicoder/zalo-linux](https://github.com/ruskicoder/zalo-linux)
- [lcaohoanq/zalo-linux-unofficial](https://github.com/lcaohoanq/zalo-linux-unofficial)

## Tài liệu tham khảo

Phần tích hợp Linux được viết dựa trên các tài liệu và đặc tả sau:

- [Unity LauncherEntry API](https://wiki.ubuntu.com/Unity/LauncherAPI): hiển thị số tin chưa đọc trên dock (Ubuntu Dock / Dash to Dock / KDE Plasma đều hỗ trợ)
- [Electron: `app.setBadgeCount`](https://www.electronjs.org/docs/latest/api/app#appsetbadgecountcount-linux-macos), [`desktopCapturer`](https://www.electronjs.org/docs/latest/api/desktop-capturer), [Command line switches](https://www.electronjs.org/docs/latest/api/command-line-switches)
- [Chromium: Ozone / Wayland](https://chromium.googlesource.com/chromium/src/+/main/docs/ozone_overview.md) và giao thức Wayland [text-input-unstable-v1 / v3](https://wayland.app/protocols/text-input-unstable-v3): lý do bộ gõ không chạy trên GNOME Wayland với Electron 22
- [Fcitx5 wiki: Using Fcitx 5 on Wayland](https://fcitx-im.org/wiki/Using_Fcitx_5_on_Wayland): cấu hình `GTK_IM_MODULE` / XIM cho ứng dụng Chromium
- [xdg-desktop-portal ScreenCast](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.ScreenCast.html) và [PipeWire](https://pipewire.org/): chia sẻ màn hình trên Wayland

## Ghi công

- **VNG Corporation**: ứng dụng Zalo PC gốc (`main-dist/`, `pc-dist/`), giao thức và tài nguyên giao diện. Các file như `native/nativelibs/zimage/index.js` giữ nguyên ghi chú tác giả gốc của đội Zalo.
- [Electron](https://www.electronjs.org/), [electron-builder](https://www.electron.build/), [sharp](https://github.com/lovell/sharp) / libvips, [FFmpeg](https://ffmpeg.org/) (qua [@ffmpeg-installer/ffmpeg](https://github.com/kribblo/node-ffmpeg-installer)), [Opus](https://opus-codec.org/), [node-sqlite3](https://github.com/TryGhost/node-sqlite3): mỗi thư viện giữ giấy phép riêng của mình.
