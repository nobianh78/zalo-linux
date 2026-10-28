/**
 * Native Linux implementation for zimage using sharp
 */
const path = require('path');

let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  try {
    sharp = require(path.resolve(__dirname, '../../../node_modules/sharp'));
  } catch (err) {
    console.warn('[zimage] sharp not found, falling back to stub');
  }
}

function getLib(options) {
  const thumbnail = async (buffer, width, height, format, quality) => {
    if (!sharp) return Promise.reject({ error: -2 });
    try {
      const targetFormat = (format && typeof format === 'string' && format.toLowerCase() === 'png') ? 'png' : 'jpeg';
      const pipeline = sharp(buffer).resize(width || null, height || null, { fit: 'inside', withoutEnlargement: true });
      if (targetFormat === 'png') {
        pipeline.png({ quality: quality || 80 });
      } else {
        pipeline.jpeg({ quality: quality || 80 });
      }
      const data = await pipeline.toBuffer();
      return { data, error: 0 };
    } catch (err) {
      return Promise.reject(err);
    }
  };

  const resizeQA = async (inputPath, outputPath, width, height, quality, _, callback) => {
    if (!sharp) {
      const err = new Error('NOT_SUPPORT');
      if (typeof callback === 'function') callback(err);
      return Promise.reject(err);
    }
    try {
      await sharp(inputPath)
        .resize(width || null, height || null, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: quality || 80 })
        .toFile(outputPath);
      const res = { status: 0, error: 0 };
      if (typeof callback === 'function') callback(null, res);
      return res;
    } catch (err) {
      if (typeof callback === 'function') callback(err);
      return Promise.reject(err);
    }
  };

  return Promise.resolve({
    Image: {
      thumbnail,
      resizeQA
    }
  });
}

module.exports = getLib;
