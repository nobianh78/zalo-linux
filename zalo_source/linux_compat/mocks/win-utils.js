/**
 * Linux Compatibility Mock for win-utils.node
 * Implements N-API exports: qlWin, openWin, getDiskUsage
 */
const fs = require('fs');
const cp = require('child_process');

function qlWin(hwnd, callback) {
  if (typeof callback === 'function') {
    callback(null);
  }
}

function openWin(hwnd, callback) {
  if (typeof callback === 'function') {
    callback(null, true);
  }
  return true;
}

let cachedWinUsage = null;
let lastWinCheckTime = 0;

function getDiskUsage(dirPath, callback) {
  try {
    const now = Date.now();
    if (cachedWinUsage && (now - lastWinCheckTime < 10000)) {
      if (typeof callback === 'function') callback(null, cachedWinUsage);
      return cachedWinUsage;
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
        cachedWinUsage = { total, free, available };
        lastWinCheckTime = now;
        if (typeof callback === 'function') callback(null, cachedWinUsage);
        return cachedWinUsage;
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
          cachedWinUsage = { total, free: available, available };
          lastWinCheckTime = now;
          if (typeof callback === 'function') callback(null, cachedWinUsage);
          return cachedWinUsage;
        }
      }
    } catch (e) {}

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
  qlWin,
  openWin,
  getDiskUsage
};
