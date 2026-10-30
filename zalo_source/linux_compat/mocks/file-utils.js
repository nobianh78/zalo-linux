/**
 * Linux Compatibility Mock for file-utils.node
 * Implements N-API exports: open(filePath, callback), getDiskUsage(dirPath, callback)
 */
const fs = require('fs');
const cp = require('child_process');

let shell = null;
try {
  const electron = require('electron');
  shell = electron.shell;
} catch (e) {
  // Not inside electron runtime yet
}

function open(filePath, callback) {
  if (shell && typeof shell.openPath === 'function') {
    shell.openPath(filePath)
      .then((errorMessage) => {
        if (typeof callback === 'function') {
          if (errorMessage) {
            callback(new Error(errorMessage));
          } else {
            callback(null);
          }
        }
      })
      .catch((err) => {
        if (typeof callback === 'function') {
          callback(err);
        }
      });
  } else {
    // Fallback if electron.shell is not available
    if (typeof callback === 'function') {
      callback(null);
    }
  }
}

let cachedUsage = null;
let lastCheckTime = 0;

function getDiskUsage(dirPath, callback) {
  try {
    const now = Date.now();
    if (cachedUsage && (now - lastCheckTime < 10000)) {
      if (typeof callback === 'function') callback(null, cachedUsage);
      return cachedUsage;
    }

    // 1. Try fs.statfsSync if supported
    if (typeof fs.statfsSync === 'function') {
      try {
        const targetPath = (!dirPath || typeof dirPath !== 'string' || dirPath.includes(':'))
          ? '/'
          : dirPath;
        const stats = fs.statfsSync(targetPath);
        const bsize = stats.bsize || 4096;
        const total = Number(BigInt(stats.blocks) * BigInt(bsize));
        const free = Number(BigInt(stats.bfree) * BigInt(bsize));
        const available = Number(BigInt(stats.bavail) * BigInt(bsize));
        cachedUsage = { total, free, available };
        lastCheckTime = now;
        if (typeof callback === 'function') callback(null, cachedUsage);
        return cachedUsage;
      } catch (e) {}
    }

    // 2. Linux df -k
    try {
      const checkPath = (dirPath && typeof dirPath === 'string' && !dirPath.includes(':') && fs.existsSync(dirPath))
        ? dirPath
        : '/';
      const output = cp.execSync(`df -k "${checkPath}"`, { encoding: 'utf8', timeout: 3000 });
      const lines = output.trim().split('\n');
      if (lines.length >= 2) {
        const lastLine = lines[lines.length - 1].trim().replace(/\s+/g, ' ');
        const parts = lastLine.split(' ');
        if (parts.length >= 4) {
          const total = parseInt(parts[1], 10) * 1024;
          const available = parseInt(parts[3], 10) * 1024;
          cachedUsage = { total, free: available, available };
          lastCheckTime = now;
          if (typeof callback === 'function') callback(null, cachedUsage);
          return cachedUsage;
        }
      }
    } catch (e) {}

    // Fallback based on typical disk size
    const fallback = { total: 250000000000, free: 150000000000, available: 150000000000 };
    if (typeof callback === 'function') {
      callback(null, fallback);
    }
    return fallback;
  } catch (err) {
    const fallback = { total: 250000000000, free: 150000000000, available: 150000000000 };
    if (typeof callback === 'function') {
      callback(null, fallback);
    }
    return fallback;
  }
}

module.exports = {
  open,
  getDiskUsage
};
