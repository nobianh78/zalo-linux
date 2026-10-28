/**
 * Linux Compatibility Mock for file-utilities
 * Implements native binding methods used by Zalo Data Management & Storage
 */
const fs = require('fs');
const path = require('path');

function calculateDirSize(dirPath, maxDepth = 10, currentDepth = 0) {
  let totalSize = 0;
  let fileCount = 0;
  let folderCount = 0;
  const tree = [];

  try {
    if (!dirPath || typeof dirPath !== 'string' || !fs.existsSync(dirPath)) {
      return { totalSize: 0, size: 0, files: 0, folders: 0, tree: [] };
    }
    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) {
      return { totalSize: stat.size, size: stat.size, files: 1, folders: 0, tree: [] };
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      try {
        if (entry.isDirectory()) {
          folderCount++;
          let subResult = { totalSize: 0, size: 0, files: 0, folders: 0 };
          if (currentDepth < maxDepth) {
            subResult = calculateDirSize(fullPath, maxDepth, currentDepth + 1);
          }
          totalSize += subResult.totalSize;
          fileCount += subResult.files;
          folderCount += subResult.folders;
          tree.push({
            relativePath: entry.name,
            totalSize: subResult.totalSize,
            size: subResult.size
          });
        } else if (entry.isFile()) {
          fileCount++;
          const fileStat = fs.statSync(fullPath);
          totalSize += fileStat.size;
          tree.push({
            relativePath: entry.name,
            totalSize: fileStat.size,
            size: fileStat.size
          });
        }
      } catch (e) {}
    }
  } catch (err) {}

  return { totalSize, size: totalSize, files: fileCount, folders: folderCount, tree };
}

function getDirectorySizeSync(targetPath, options) {
  const maxDepth = (options && options.deep && typeof options.deep.maxDepth === 'number')
    ? options.deep.maxDepth
    : 10;
  return calculateDirSize(targetPath, maxDepth, 0);
}

async function getDirectorySizeAsync(targetPath, options) {
  const maxDepth = (options && options.deep && typeof options.deep.maxDepth === 'number')
    ? options.deep.maxDepth
    : 10;
  return calculateDirSize(targetPath, maxDepth, 0);
}

function getDirectorySizeTreeSync(targetPath, options) {
  return getDirectorySizeSync(targetPath, options);
}

async function getDirectorySizeTreeAsync(targetPath, options, jobId) {
  return getDirectorySizeAsync(targetPath, options);
}

function detectHardlinksSync(targetPath) {
  return [];
}

async function detectHardlinksAsync(targetPath) {
  return [];
}

function detectFilesystemSync(targetPath) {
  return { filesystemType: 'ext4' };
}

async function detectFilesystemAsync(targetPath) {
  return { filesystemType: 'ext4' };
}

function getDirectorySizeByGlobSync(pattern, options) {
  return { totalSize: 0, size: 0, files: 0, folders: 0, tree: [] };
}

async function getDirectorySizeByGlobAsync(pattern, options) {
  return { totalSize: 0, size: 0, files: 0, folders: 0, tree: [] };
}

function cancelJob(jobId) {}

module.exports = {
  getDirectorySizeSync,
  getDirectorySizeAsync,
  getDirectorySizeTreeSync,
  getDirectorySizeTreeAsync,
  detectHardlinksSync,
  detectHardlinksAsync,
  detectFilesystemSync,
  detectFilesystemAsync,
  getDirectorySizeByGlobSync,
  getDirectorySizeByGlobAsync,
  cancelJob
};
