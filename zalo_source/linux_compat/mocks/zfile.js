/**
 * Linux Compatibility Mock for zfile
 * Provides file/directory inspection and copying using Node.js fs APIs
 */
const fs = require('fs');
const path = require('path');

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

async function diskInfo() {
  try {
    const stats = fs.statfsSync('/');
    const bsize = stats.bsize || 4096;
    const total = Number(BigInt(stats.blocks) * BigInt(bsize));
    const free = Number(BigInt(stats.bfree) * BigInt(bsize));
    const available = Number(BigInt(stats.bavail) * BigInt(bsize));

    const rootDisk = {
      caption: 'Root',
      device: '/',
      description: 'Root Filesystem',
      path: '/',
      freeSpace: free,
      size: total,
      totalSpace: total,
      free: free,
      usedSpace: total - free,
      availableSpace: available,
      available: available,
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
  } catch (err) {
    const fallback = {
      caption: 'Root',
      device: '/',
      description: 'Root Filesystem',
      path: '/',
      freeSpace: 53687091200,
      size: 107374182400,
      totalSpace: 107374182400,
      free: 53687091200,
      usedSpace: 53687091200,
      availableSpace: 53687091200,
      available: 53687091200,
      isExternal: false,
      label: 'Root'
    };
    const drives = [fallback];
    drives['/'] = fallback;
    drives['C:'] = fallback;
    drives['C:\\'] = fallback;
    return new Proxy(drives, {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (typeof prop === 'string') return fallback;
        return target[prop] || fallback;
      }
    });
  }
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
