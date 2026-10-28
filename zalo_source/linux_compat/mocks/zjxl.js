/**
 * Linux implementation for zjxl (JPEG-XL fallback via sharp)
 */
const path = require('path');

let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  try {
    sharp = require(path.resolve(__dirname, '../../../node_modules/sharp'));
  } catch (err) {}
}

async function decodeToJpeg(buffer, quality, options) {
  if (sharp && Buffer.isBuffer(buffer) && buffer.length > 0) {
    try {
      const data = await sharp(buffer).jpeg({ quality: quality || 80 }).toBuffer();
      return { data, status_code: 1 };
    } catch (e) {}
  }
  return { data: buffer || Buffer.alloc(0), status_code: 0 };
}

async function bitmapToJxl(buffer, width, height) {
  if (sharp && Buffer.isBuffer(buffer) && buffer.length > 0) {
    try {
      const data = await sharp(buffer, { raw: { width, height, channels: 4 } }).jpeg({ quality: 80 }).toBuffer();
      return { data, status_code: 1 };
    } catch (e) {}
  }
  return { data: buffer || Buffer.alloc(0), status_code: 0 };
}

async function getJxlInfo(buffer) {
  if (sharp && Buffer.isBuffer(buffer) && buffer.length > 0) {
    try {
      const meta = await sharp(buffer).metadata();
      return { width: meta.width || 0, height: meta.height || 0, status_code: 1 };
    } catch (e) {}
  }
  return { width: 0, height: 0, status_code: 0 };
}

async function resizeJxl(buffer, width, height) {
  if (sharp && Buffer.isBuffer(buffer) && buffer.length > 0) {
    try {
      const data = await sharp(buffer).resize(width || null, height || null, { fit: 'inside' }).toBuffer();
      return { data, status_code: 1 };
    } catch (e) {}
  }
  return { data: buffer || Buffer.alloc(0), status_code: 0 };
}

async function resizeJxlLimit(buffer, width, height, limit) {
  return resizeJxl(buffer, width, height);
}

async function moduleReady() {
  return !!sharp;
}

async function jxlDecompressMulti(options) {
  return { data: Buffer.alloc(0), status_code: 0 };
}

module.exports = {
  decodeToJpeg,
  bitmapToJxl,
  getJxlInfo,
  resizeJxl,
  resizeJxlLimit,
  moduleReady,
  jxlDecompressMulti
};
