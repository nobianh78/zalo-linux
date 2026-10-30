/**
 * Linux Compatibility Mock for file-utilities
 * Implements native binding methods used by Zalo Data Management & Storage
 */
const fs = require('fs');
const path = require('path');
const glob = require('glob');

function normalizePath(p) {
  if (!p || typeof p !== 'string') return '';
  let clean = p.replace(/\\/g, '/');
  if (/^[A-Za-z]:\//.test(clean)) {
    clean = clean.replace(/^[A-Za-z]:\//, '/');
  }
  return clean;
}

function calculateDirSize(dirPath, maxDepth = 10, currentDepth = 0) {
  let totalSize = 0;
  let fileCount = 0;
  let folderCount = 0;
  const tree = [];

  const targetPath = normalizePath(dirPath);

  try {
    if (!targetPath || !fs.existsSync(targetPath)) {
      return { totalSize: 0, size: 0, files: 0, fileCount: 0, folders: 0, folderCount: 0, tree: [] };
    }
    const stat = fs.statSync(targetPath);
    if (!stat.isDirectory()) {
      return { totalSize: stat.size, size: stat.size, files: 1, fileCount: 1, folders: 0, folderCount: 0, tree: [] };
    }

    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(targetPath, entry.name);
      try {
        if (entry.isDirectory()) {
          folderCount++;
          let subResult = { totalSize: 0, size: 0, files: 0, fileCount: 0, folders: 0, folderCount: 0 };
          if (currentDepth < maxDepth) {
            subResult = calculateDirSize(fullPath, maxDepth, currentDepth + 1);
          }
          totalSize += subResult.totalSize;
          fileCount += (subResult.fileCount || subResult.files || 0);
          folderCount += (subResult.folderCount || subResult.folders || 0);
          tree.push({
            relativePath: entry.name,
            totalSize: subResult.totalSize,
            size: subResult.size,
            files: subResult.files,
            fileCount: subResult.fileCount,
            folders: subResult.folders,
            folderCount: subResult.folderCount
          });
        } else if (entry.isFile()) {
          fileCount++;
          const fileStat = fs.statSync(fullPath);
          totalSize += fileStat.size;
          tree.push({
            relativePath: entry.name,
            totalSize: fileStat.size,
            size: fileStat.size,
            files: 1,
            fileCount: 1,
            folders: 0,
            folderCount: 0
          });
        }
      } catch (e) {}
    }
  } catch (err) {}

  return {
    totalSize,
    size: totalSize,
    files: fileCount,
    fileCount,
    folders: folderCount,
    folderCount,
    tree
  };
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
  try {
    if (!pattern || typeof pattern !== 'string') {
      return { totalSize: 0, size: 0, fileCount: 0, files: 0, folderCount: 0, folders: 0, tree: [] };
    }
    let cleanPattern = normalizePath(pattern);
    let matchedFiles = [];
    try {
      matchedFiles = glob.sync(cleanPattern, { nodir: true });
    } catch (e) {}

    // Fallback: If querying AppData/Local/ZaloPC and found few files, also check ~/.config/ZaloData/media
    if (cleanPattern.includes('AppData/Local/ZaloPC')) {
      const home = process.env.HOME || '/home/tuananh';
      const altPattern = cleanPattern.replace(/.*AppData\/Local\/ZaloPC/, path.join(home, '.config', 'ZaloData', 'media'));
      try {
        const altFiles = glob.sync(altPattern, { nodir: true });
        for (const af of altFiles) {
          if (!matchedFiles.includes(af)) {
            matchedFiles.push(af);
          }
        }
      } catch (e) {}
    }

    let totalSize = 0;
    const tree = [];
    for (const file of matchedFiles) {
      try {
        const st = fs.statSync(file);
        totalSize += st.size;
        tree.push({
          relativePath: path.basename(file),
          totalSize: st.size,
          size: st.size
        });
      } catch (e) {}
    }

    return {
      totalSize,
      size: totalSize,
      fileCount: matchedFiles.length,
      files: matchedFiles.length,
      folderCount: 0,
      folders: 0,
      tree
    };
  } catch (err) {
    return { totalSize: 0, size: 0, fileCount: 0, files: 0, folderCount: 0, folders: 0, tree: [] };
  }
}

async function getDirectorySizeByGlobAsync(pattern, options) {
  return getDirectorySizeByGlobSync(pattern, options);
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
