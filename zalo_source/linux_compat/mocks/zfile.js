/**
 * Linux Compatibility Mock for zfile
 * Provides file/directory inspection and copying using Node.js fs APIs
 */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

async function stat(targetPath, isFolder) {
  try {
    const s = fs.statSync(targetPath);
    return {
      size: s.size,
      isDirectory: s.isDirectory(),
      isFile: s.isFile(),
      mtime: s.mtimeMs,
      birthtime: s.birthtimeMs,
      exists: true
    };
  } catch (err) {
    return {
      size: 0,
      isDirectory: !!isFolder,
      isFile: !isFolder,
      mtime: 0,
      birthtime: 0,
      exists: false,
      error: err.message
    };
  }
}

let cachedDiskInfo = null;
let lastDiskInfoTime = 0;

function getRealDiskUsage() {
  const now = Date.now();
  if (cachedDiskInfo && (now - lastDiskInfoTime < 10000)) {
    return cachedDiskInfo;
  }

  if (typeof fs.statfsSync === 'function') {
    try {
      const stats = fs.statfsSync('/');
      const bsize = stats.bsize || 4096;
      const total = Number(BigInt(stats.blocks) * BigInt(bsize));
      const free = Number(BigInt(stats.bfree) * BigInt(bsize));
      const available = Number(BigInt(stats.bavail) * BigInt(bsize));
      cachedDiskInfo = { total, free, available, used: total - free };
      lastDiskInfoTime = now;
      return cachedDiskInfo;
    } catch (e) {}
  }

  try {
    const output = cp.execSync('df -k /', { encoding: 'utf8', timeout: 3000 });
    const lines = output.trim().split('\n');
    if (lines.length >= 2) {
      const lastLine = lines[lines.length - 1].trim().replace(/\s+/g, ' ');
      const parts = lastLine.split(' ');
      if (parts.length >= 4) {
        const total = parseInt(parts[1], 10) * 1024;
        const used = parseInt(parts[2], 10) * 1024;
        const available = parseInt(parts[3], 10) * 1024;
        cachedDiskInfo = { total, free: available, available, used };
        lastDiskInfoTime = now;
        return cachedDiskInfo;
      }
    }
  } catch (err) {}

  return { total: 250000000000, free: 150000000000, available: 150000000000, used: 100000000000 };
}

async function diskInfo() {
  const usage = getRealDiskUsage();

  const rootDisk = {
    caption: 'Root',
    device: '/',
    description: 'Root Filesystem',
    path: '/',
    freeSpace: usage.free,
    size: usage.total,
    totalSpace: usage.total,
    free: usage.free,
    usedSpace: usage.used || (usage.total - usage.free),
    availableSpace: usage.available,
    available: usage.available,
    isExternal: false,
    label: 'Root'
  };

  const drives = [rootDisk];
  drives['/'] = rootDisk;
  drives['C:'] = rootDisk;
  drives['C:\\'] = rootDisk;

  return new Proxy(drives, {
    get(target, prop) {
      if (prop in target) {
        return target[prop];
      }
      if (typeof prop === 'string') {
        return rootDisk;
      }
      return target[prop] || rootDisk;
    }
  });
}

async function statFolder(folderPath) {
  return stat(folderPath, true);
}

async function copyFolder(src, dest, callback) {
  try {
    if (typeof fs.cpSync === 'function') {
      fs.cpSync(src, dest, { recursive: true, force: true });
    } else {
      fs.mkdirSync(dest, { recursive: true });
      const entries = fs.readdirSync(src, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
          await copyFolder(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    }
    if (typeof callback === 'function') {
      callback(null, true);
    }
    return true;
  } catch (err) {
    if (typeof callback === 'function') {
      callback(err, false);
    }
    return false;
  }
}

async function cancelCopy() {
  return true;
}

function canReadAndWrite(targetPath) {
  return true;
}

function canRead(targetPath) {
  return true;
}

function canWrite(targetPath) {
  return true;
}

module.exports = {
  stat,
  diskInfo,
  statFolder,
  copyFolder,
  cancelCopy,
  canReadAndWrite,
  canRead,
  canWrite
};
