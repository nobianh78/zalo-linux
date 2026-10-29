/**
 * Zalo Linux Native Auto-Updater
 * Checks GitHub Releases for new versions and performs in-app upgrades.
 */

let electron = null;
try {
  electron = require('electron');
} catch (e) {}

const app = electron ? electron.app : null;
const dialog = electron ? electron.dialog : null;
const shell = electron ? electron.shell : null;
const Notification = electron ? electron.Notification : null;

const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const REPO = 'nobianh78/zalo-linux';
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const INITIAL_DELAY_MS = 8000; // 8 seconds after app start

function getCurrentVersion() {
  try {
    const pkg = require('../../package.json');
    return pkg.version || '26.10.10';
  } catch (e) {
    return '26.10.10';
  }
}

function parseSemver(vStr) {
  if (!vStr) return [0, 0, 0];
  const clean = vStr.replace(/^v/, '').trim();
  const parts = clean.split('.').map(p => parseInt(p, 10) || 0);
  while (parts.length < 3) parts.push(0);
  return parts;
}

function isNewerVersion(remote, current) {
  const r = parseSemver(remote);
  const c = parseSemver(current);
  for (let i = 0; i < 3; i++) {
    if (r[i] > c[i]) return true;
    if (r[i] < c[i]) return false;
  }
  return false;
}

function fetchLatestRelease() {
  return new Promise((resolve, reject) => {
    const url = `https://api.github.com/repos/${REPO}/releases/latest`;
    const opts = {
      headers: {
        'User-Agent': 'Zalo-Linux-AutoUpdater',
        'Accept': 'application/vnd.github.v3+json'
      }
    };
    https.get(url, opts, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`GitHub API returned status ${res.statusCode}`));
      }
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    
    function makeRequest(targetUrl) {
      https.get(targetUrl, { headers: { 'User-Agent': 'Zalo-Linux-AutoUpdater' } }, (res) => {
        // Handle HTTP 301/302 redirects (standard for GitHub Release assets)
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return makeRequest(res.headers.location);
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(destPath, () => {});
          return reject(new Error(`Download failed with status ${res.statusCode}`));
        }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
        let receivedBytes = 0;

        res.on('data', (chunk) => {
          receivedBytes += chunk.length;
          if (onProgress && totalBytes > 0) {
            onProgress(Math.round((receivedBytes / totalBytes) * 100));
          }
        });

        res.pipe(file);
        file.on('finish', () => {
          file.close(() => resolve(destPath));
        });
      }).on('error', (err) => {
        file.close();
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }

    makeRequest(url);
  });
}

async function performUpdate(assetUrl, remoteVer) {
  const isAppImage = !!process.env.APPIMAGE;
  const ext = isAppImage ? '.AppImage' : '.deb';
  const tempPath = path.join('/tmp', `zalo-update-${remoteVer}${ext}`);

  try {
    if (Notification.isSupported()) {
      new Notification({
        title: 'Zalo Linux',
        body: `Đang tải bản cập nhật v${remoteVer}... Vui lòng đợi trong giây lát.`
      }).show();
    }

    console.log(`[AutoUpdater] Downloading ${assetUrl} -> ${tempPath}`);
    await downloadFile(assetUrl, tempPath);
    console.log('[AutoUpdater] Download completed!');

    if (isAppImage) {
      // Self-update AppImage: replace current AppImage file
      fs.chmodSync(tempPath, 0o755);
      const currentAppImage = process.env.APPIMAGE;
      fs.copyFileSync(tempPath, currentAppImage);
      fs.unlinkSync(tempPath);

      dialog.showMessageBoxSync({
        type: 'info',
        title: 'Cập nhật Zalo',
        message: 'Cập nhật hoàn tất!',
        detail: 'Ứng dụng sẽ tự động khởi động lại để áp dụng phiên bản mới.',
        buttons: ['Khởi động lại']
      });

      app.relaunch({ execPath: currentAppImage });
      app.exit(0);
    } else {
      // DEB package: execute pkexec apt install
      if (Notification.isSupported()) {
        new Notification({
          title: 'Zalo Linux',
          body: 'Đã tải xong. Vui lòng xác thực mật khẩu quản trị để cài đặt.'
        }).show();
      }

      const child = spawn('pkexec', ['apt', 'install', '-y', tempPath], {
        stdio: 'inherit'
      });

      child.on('close', (code) => {
        fs.unlink(tempPath, () => {});
        if (code === 0) {
          dialog.showMessageBoxSync({
            type: 'info',
            title: 'Cập nhật Zalo',
            message: 'Cài đặt bản cập nhật thành công!',
            detail: 'Zalo sẽ khởi động lại với phiên bản mới.',
            buttons: ['Khởi động lại']
          });
          app.relaunch();
          app.exit(0);
        } else {
          dialog.showErrorBox(
            'Lỗi cập nhật',
            `Quá trình cài đặt gói .deb thất bại (mã thoát: ${code}). Vui lòng thử lại sau hoặc cập nhật thủ công.`
          );
        }
      });
    }
  } catch (err) {
    console.error('[AutoUpdater] Error applying update:', err);
    dialog.showErrorBox('Lỗi tải bản cập nhật', err.message);
  }
}

async function checkForUpdates(silent = true) {
  try {
    const currentVer = getCurrentVersion();
    console.log(`[AutoUpdater] Checking for updates... (Current: v${currentVer})`);

    const release = await fetchLatestRelease();
    const remoteVer = (release.tag_name || '').replace(/^v/, '');

    if (!isNewerVersion(remoteVer, currentVer)) {
      console.log(`[AutoUpdater] Zalo is up to date (v${currentVer}).`);
      if (!silent) {
        dialog.showMessageBox({
          type: 'info',
          title: 'Kiểm tra cập nhật',
          message: 'Bạn đang sử dụng phiên bản mới nhất!',
          detail: `Phiên bản hiện tại: v${currentVer}`,
          buttons: ['Đóng']
        });
      }
      return;
    }

    console.log(`[AutoUpdater] New version available: v${remoteVer}`);

    // Find suitable download asset
    const isAppImage = !!process.env.APPIMAGE;
    const targetExt = isAppImage ? '.AppImage' : '.deb';
    const asset = (release.assets || []).find(a => a.name.endsWith(targetExt));

    if (!asset || !asset.browser_download_url) {
      console.warn(`[AutoUpdater] No matching ${targetExt} asset found in release v${remoteVer}`);
      return;
    }

    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: 'Cập nhật Zalo Linux',
      message: `Đã có phiên bản mới: v${remoteVer}`,
      detail: `Phiên bản hiện tại: v${currentVer}\n\nBạn có muốn tải và cài đặt bản cập nhật ngay bây giờ không?`,
      buttons: ['Cập nhật ngay', 'Để sau', 'Xem chi tiết'],
      defaultId: 0,
      cancelId: 1
    });

    if (response === 0) {
      performUpdate(asset.browser_download_url, remoteVer);
    } else if (response === 2) {
      shell.openExternal(release.html_url);
    }
  } catch (err) {
    console.warn('[AutoUpdater] Failed to check for updates:', err.message);
    if (!silent) {
      dialog.showErrorBox('Không thể kiểm tra cập nhật', err.message);
    }
  }
}

function initAutoUpdater() {
  if (!app) return;

  const startSchedule = () => {
    setTimeout(() => {
      checkForUpdates(true);
    }, INITIAL_DELAY_MS);

    setInterval(() => {
      checkForUpdates(true);
    }, CHECK_INTERVAL_MS);
  };

  if (app.isReady()) {
    startSchedule();
  } else {
    app.whenReady().then(startSchedule);
  }
}

module.exports = {
  initAutoUpdater,
  checkForUpdates,
  getCurrentVersion
};
