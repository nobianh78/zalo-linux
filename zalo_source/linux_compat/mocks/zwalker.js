/**
 * Native Linux implementation for zwalker (directory statistics & cleanup)
 */
const fs = require('fs');
const path = require('path');

function normalizePath(p) {
  if (!p || typeof p !== 'string') return '';
  let clean = p.replace(/\\/g, '/');
  if (/^[A-Za-z]:\//.test(clean)) {
    clean = clean.replace(/^[A-Za-z]:\//, '/');
  }
  return clean;
}

function walk(dirPath, fileCallback) {
  let count = 0;
  let totalSize = 0;

  const targetPath = normalizePath(dirPath);

  function traverse(currentDir) {
    let entries = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (e) {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      try {
        if (entry.isDirectory()) {
          traverse(fullPath);
        } else if (entry.isFile()) {
          const stat = fs.statSync(fullPath);
          count++;
          totalSize += stat.size;
          if (fileCallback) fileCallback(fullPath, stat);
        }
      } catch (err) {}
    }
  }

  if (targetPath && fs.existsSync(targetPath)) {
    traverse(targetPath);
  }

  return { count, totalSize };
}

async function scanDirectory(dirPath, options) {
  const normDir = normalizePath(dirPath);
  const trackingFolders = Array.isArray(options) ? options : [];
  const trackingFolderData = {};

  let totalFiles = 0;
  let totalBytes = 0;

  if (trackingFolders.length > 0) {
    for (const tf of trackingFolders) {
      const normTf = normalizePath(tf);
      const res = walk(normTf);
      trackingFolderData[normTf] = {
        size: res.totalSize,
        file_number: res.count
      };
      totalFiles += res.count;
      totalBytes += res.totalSize;
    }
  }

  if (trackingFolders.length === 0) {
    const mainRes = walk(normDir);
    totalFiles = mainRes.count;
    totalBytes = mainRes.totalSize;
  }

  return {
    fileNumber: totalFiles,
    size: totalBytes,
    trackingPath: JSON.stringify(trackingFolderData)
  };
}

async function updateReferenceMessageId(dirPath, options) {
  return {
    fileNumber: Array.isArray(options) ? options.length : 0
  };
}

async function deleteHomelessFiles(dirPath, r, i, o) {
  return {
    fileNumber: 0,
    size: 0,
    failedFileNumber: 0,
    failedSize: 0
  };
}

async function statUnmarkedFiles(dirPath, ignorePaths, trackingPaths, times) {
  const normDir = normalizePath(dirPath);
  const trackingFolders = Array.isArray(trackingPaths) ? trackingPaths : [];
  const trackingFolderData = {};

  let totalFiles = 0;
  let totalBytes = 0;

  if (trackingFolders.length > 0) {
    for (const tf of trackingFolders) {
      const normTf = normalizePath(tf);
      const res = walk(normTf);
      trackingFolderData[normTf] = {
        size: res.totalSize,
        file_number: res.count
      };
      totalFiles += res.count;
      totalBytes += res.totalSize;
    }
  }

  if (trackingFolders.length === 0) {
    const mainRes = walk(normDir);
    totalFiles = mainRes.count;
    totalBytes = mainRes.totalSize;
  }

  return {
    fileNumber: totalFiles,
    size: totalBytes,
    trackingPath: JSON.stringify(trackingFolderData),
    trackingATime: "{}"
  };
}

async function deleteEmptyFolders(dirPath) {
  let deletedCount = 0;
  const deletedDirs = [];
  const targetPath = normalizePath(dirPath);

  function clean(currentDir) {
    let entries = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (e) {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullPath = path.join(currentDir, entry.name);
        clean(fullPath);
      }
    }

    try {
      const remaining = fs.readdirSync(currentDir);
      if (remaining.length === 0 && currentDir !== targetPath) {
        fs.rmdirSync(currentDir);
        deletedCount++;
        deletedDirs.push(currentDir);
      }
    } catch (e) {}
  }

  if (targetPath && fs.existsSync(targetPath)) {
    clean(targetPath);
  }

  return {
    deletedCount,
    deletedDirs
  };
}

module.exports = {
  scanDirectory,
  updateReferenceMessageId,
  deleteHomelessFiles,
  statUnmarkedFiles,
  deleteEmptyFolders
};
