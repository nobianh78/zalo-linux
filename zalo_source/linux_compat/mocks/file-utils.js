/**
 * Linux Compatibility Mock for file-utils.node
 * Implements N-API exports: open(filePath, callback), getDiskUsage(dirPath, callback)
 */
const fs = require('fs');

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
  open,
  getDiskUsage
};
