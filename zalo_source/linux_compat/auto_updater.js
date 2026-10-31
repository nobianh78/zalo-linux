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
const os = require('os');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');

/**
 * How this copy of Zalo was installed: 'appimage' | 'deb' | 'rpm'.
 * Decides which release asset to download and how to apply it.
 */
function getInstallKind() {
  if (process.env.APPIMAGE) return 'appimage';
  const owns = (cmd, args) => {
    try { return spawnSync(cmd, args, { stdio: 'ignore' }).status === 0; } catch (e) { return false; }
  };
  if (fs.existsSync('/usr/bin/dpkg-query') && owns('dpkg-query', ['-W', 'zalo-linux'])) return 'deb';
  if (fs.existsSync('/usr/bin/rpm') && owns('rpm', ['-q', 'zalo-linux'])) return 'rpm';
  return fs.existsSync('/usr/bin/rpm') && !fs.existsSync('/usr/bin/dpkg') ? 'rpm' : 'deb';
}

const ASSET_MATCHERS = {
  appimage: (name) => name.endsWith('.AppImage'),
  deb: (name) => name.endsWith('_amd64.deb'),
  rpm: (name) => name.endsWith('.x86_64.rpm')
};

/** Package-manager command (run through pkexec) that installs a local package file. */
function packageInstallCommand(kind, file) {
  if (kind === 'rpm') {
    if (fs.existsSync('/usr/bin/dnf')) return ['dnf', 'install', '-y', file];
    if (fs.existsSync('/usr/bin/zypper')) return ['zypper', '--non-interactive', 'install', '--allow-unsigned-rpm', file];
    return ['rpm', '-U', '--replacepkgs', file];
  }
  return ['apt', 'install', '-y', file];
}

const REPO = 'nobianh78/zalo-linux';
const CHECK_INTERVAL_MS = 15 * 60 * 1000; // Check every 15 minutes
const INITIAL_DELAY_MS = 2000; // 2 seconds after app start

function getCurrentVersion() {
  try {
    const pkg = require('../../package.json');
    return pkg.version || '26.10.11';
  } catch (e) {
    return '26.10.11';
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

// The only update the app may install: set by checkForUpdates() from the GitHub API,
// never taken from the renderer (which displays untrusted chat content).
let pendingUpdate = null;

function sha256File(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    fs.createReadStream(file).on('data', (d) => h.update(d)).on('end', () => resolve(h.digest('hex'))).on('error', reject);
  });
}

async function performUpdate(assetUrl) {
  if (!pendingUpdate || assetUrl !== pendingUpdate.url) {
    console.warn('[AutoUpdater] Rejected update request for unknown asset:', assetUrl);
    return { error: 'Bản cập nhật không hợp lệ. Hãy bấm "Kiểm tra cập nhật" rồi thử lại.' };
  }
  const { kind, version: remoteVer, digest } = pendingUpdate;
  const isAppImage = kind === 'appimage';
  const ext = { appimage: '.AppImage', deb: '.deb', rpm: '.rpm' }[kind];
  // Private 0700 directory: no other local user can pre-create or swap the file
  // before it is installed with root rights.
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zalo-update-'));
  const tempPath = path.join(tempDir, `zalo-linux-update${ext}`);

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

    if (digest) {
      const actual = await sha256File(tempPath);
      if (actual !== digest) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        throw new Error('File cập nhật bị lỗi khi tải (sai SHA256). Vui lòng thử lại sau.');
      }
      console.log('[AutoUpdater] SHA256 verified');
    }

    if (isAppImage) {
      // Self-update AppImage: write next to the running file, then atomically rename over it
      // (overwriting a running executable in place fails with ETXTBSY).
      const currentAppImage = process.env.APPIMAGE;
      const staged = `${currentAppImage}.update`;
      fs.copyFileSync(tempPath, staged);
      fs.chmodSync(staged, 0o755);
      fs.renameSync(staged, currentAppImage);
      fs.rmSync(tempDir, { recursive: true, force: true });

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
      // .deb / .rpm package: install through the system package manager
      if (Notification.isSupported()) {
        new Notification({
          title: 'Zalo Linux',
          body: 'Đã tải xong. Vui lòng xác thực mật khẩu quản trị để cài đặt.'
        }).show();
      }

      const child = spawn('pkexec', packageInstallCommand(kind, tempPath), {
        stdio: 'inherit'
      });

      child.on('close', (code) => {
        fs.rm(tempDir, { recursive: true, force: true }, () => {});
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
            `Quá trình cài đặt gói ${ext} thất bại (mã thoát: ${code}). Vui lòng thử lại sau hoặc cập nhật thủ công.`
          );
        }
      });
    }
  } catch (err) {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
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
    const kind = getInstallKind();
    const asset = (release.assets || []).find(a => ASSET_MATCHERS[kind](a.name));

    if (!asset || !asset.browser_download_url) {
      console.warn(`[AutoUpdater] No ${kind} asset found in release v${remoteVer}`);
      return;
    }

    const digest = typeof asset.digest === 'string' && asset.digest.startsWith('sha256:') ? asset.digest.slice(7) : null;
    pendingUpdate = { url: asset.browser_download_url, version: remoteVer, kind, digest };

    // Broadcast update availability to all renderer windows (for in-app UI banner)
    try {
      const windows = electron.BrowserWindow.getAllWindows();
      for (const w of windows) {
        if (!w.isDestroyed() && w.webContents) {
          w.webContents.send('tadaza:update-available', {
            version: remoteVer,
            currentVersion: currentVer,
            releaseUrl: release.html_url,
            assetUrl: asset.browser_download_url
          });
        }
      }
    } catch (e) {}

    let mainWin = null;
    try {
      const windows = electron.BrowserWindow.getAllWindows();
      mainWin = windows.find(w => !w.isDestroyed() && w.isVisible()) || null;
      if (mainWin) {
        mainWin.focus();
      }
    } catch (e) {}

    const dialogOptions = {
      type: 'info',
      title: 'Cập nhật Zalo Linux',
      message: `Đã có phiên bản mới: v${remoteVer}`,
      detail: `Phiên bản hiện tại: v${currentVer}\n\nBạn có muốn tải và cài đặt bản cập nhật ngay bây giờ không?`,
      buttons: ['Cập nhật ngay', 'Để sau', 'Xem chi tiết'],
      defaultId: 0,
      cancelId: 1
    };

    const { response } = await (mainWin ? dialog.showMessageBox(mainWin, dialogOptions) : dialog.showMessageBox(dialogOptions));

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
  performUpdate,
  getCurrentVersion
};
