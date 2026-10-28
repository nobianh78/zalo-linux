/**
 * Native Linux implementation for zwalker (directory statistics & cleanup)
 */
const fs = require('fs');
const path = require('path');

function walk(dirPath, fileCallback) {
  let count = 0;
  let totalSize = 0;
  const tracking = {};

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
          tracking[fullPath] = stat.size;
          if (fileCallback) fileCallback(fullPath, stat);
        }
      } catch (err) {}
    }
  }

  if (fs.existsSync(dirPath)) {
    traverse(dirPath);
  }

  return { count, totalSize, tracking };
}

async function scanDirectory(dirPath, options) {
  const { count, totalSize, tracking } = walk(dirPath);
  return {
    fileNumber: count,
    size: totalSize,
    trackingPath: JSON.stringify(tracking)
  };
}

async function updateReferenceMessageId(dirPath, options) {
  return {
    fileNumber: 0
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

async function statUnmarkedFiles(dirPath, r, i, o) {
  const { count, totalSize, tracking } = walk(dirPath);
  return {
    fileNumber: count,
    size: totalSize,
    trackingPath: JSON.stringify(tracking),
    trackingATime: "{}"
  };
}

async function deleteEmptyFolders(dirPath) {
  let deletedCount = 0;
  const deletedDirs = [];

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
      if (remaining.length === 0 && currentDir !== dirPath) {
        fs.rmdirSync(currentDir);
        deletedCount++;
        deletedDirs.push(currentDir);
      }
    } catch (e) {}
  }

  if (fs.existsSync(dirPath)) {
    clean(dirPath);
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
