/**
 * Native Linux implementation for mp4thumb using ffmpeg
 */
const { execFile, execFileSync } = require('child_process');
const path = require('path');

let ffmpegPath = 'ffmpeg';
try {
  const installer = require('@ffmpeg-installer/ffmpeg');
  if (installer && installer.path) ffmpegPath = installer.path;
} catch (e) {
  try {
    const installer = require(path.resolve(__dirname, '../../../node_modules/@ffmpeg-installer/ffmpeg'));
    if (installer && installer.path) ffmpegPath = installer.path;
  } catch (err) {}
}

const activeProcesses = new Map();

function runFfmpegThumb(inputPath, outputPath, maxWidth, maxHeight, mediaId) {
  return new Promise((resolve) => {
    const scale = `scale='min(${maxWidth || 320},iw)':-1`;
    const args = ['-y', '-ss', '00:00:01', '-i', inputPath, '-vframes', '1', '-vf', scale, outputPath];
    const proc = execFile(ffmpegPath, args, (err) => {
      if (mediaId) activeProcesses.delete(mediaId);
      if (err) {
        const fallbackArgs = ['-y', '-i', inputPath, '-vframes', '1', '-vf', scale, outputPath];
        execFile(ffmpegPath, fallbackArgs, (err2) => {
          resolve(!err2);
        });
      } else {
        resolve(true);
      }
    });
    if (mediaId) activeProcesses.set(mediaId, proc);
  });
}

class MP4Thumb {
  async generateThumbnailAsync(inputPath, outputPath, maxWidth, maxHeight) {
    return runFfmpegThumb(inputPath, outputPath, maxWidth, maxHeight);
  }
  generateThumbnail(inputPath, outputPath, maxWidth, maxHeight) {
    try {
      const scale = `scale='min(${maxWidth || 320},iw)':-1`;
      const args = ['-y', '-i', inputPath, '-vframes', '1', '-vf', scale, outputPath];
      execFileSync(ffmpegPath, args, { stdio: 'ignore' });
      return true;
    } catch (e) {
      return false;
    }
  }
  cancel(mediaId) {
    if (mediaId && activeProcesses.has(mediaId)) {
      try {
        activeProcesses.get(mediaId).kill();
      } catch (e) {}
      activeProcesses.delete(mediaId);
    }
  }
}

const generateThumbnail = async (inputPath, outputPath, maxWidth, maxHeight, mediaId) => {
  return runFfmpegThumb(inputPath, outputPath, maxWidth, maxHeight, mediaId);
};

const cancel = (mediaId) => {
  if (mediaId && activeProcesses.has(mediaId)) {
    try {
      activeProcesses.get(mediaId).kill();
    } catch (e) {}
    activeProcesses.delete(mediaId);
  }
};

module.exports = {
  MP4Thumb,
  generateThumbnail,
  cancel
};
