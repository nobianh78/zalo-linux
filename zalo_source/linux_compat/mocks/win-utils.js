/**
 * Linux Compatibility Mock for win-utils.node
 * Implements N-API exports: qlWin, openWin, getDiskUsage
 */
const fs = require('fs');

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

function getDiskUsage(dirPath, callback) {
  try {
    const targetPath = (!dirPath || typeof dirPath !== 'string' || dirPath.includes(':'))
      ? '/'
      : dirPath;
    const stats = fs.statfsSync(targetPath);
    const bsize = stats.bsize || 4096;
    const total = Number(BigInt(stats.blocks) * BigInt(bsize));
    const free = Number(BigInt(stats.bfree) * BigInt(bsize));
    const available = Number(BigInt(stats.bavail) * BigInt(bsize));
    const result = { total, free, available };

    if (typeof callback === 'function') {
      callback(null, result);
    }
    return result;
  } catch (err) {
    const fallback = { total: 107374182400, free: 53687091200, available: 53687091200 };
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
