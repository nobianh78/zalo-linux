/**
 * Linux Compatibility Mock for db-cross-v4-native.node
 * Implements N-API exports: getVersion, parseBinNet, decompressAndDecryptDb, decompressAndDecryptDb_V2
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

function getVersion() {
  return "4.0.0";
}

function parseBinNet(buffer) {
  return {
    result: 0,
    data: {
      attachs: []
    }
  };
}

function processDbBuffer(inBuf, password) {
  if (!Buffer.isBuffer(inBuf) || inBuf.length === 0) {
    return Buffer.alloc(0);
  }

  // Check for plain SQLite format
  if (inBuf.length >= 16 && inBuf.subarray(0, 16).toString('ascii') === 'SQLite format 3\0') {
    return inBuf;
  }

  // Check for zlib magic header (0x78 0x01, 0x78 0x9c, 0x78 0xda, 0x78 0x5e)
  if (inBuf[0] === 0x78 && (inBuf[1] === 0x9c || inBuf[1] === 0x01 || inBuf[1] === 0xda || inBuf[1] === 0x5e)) {
    try {
      return zlib.inflateSync(inBuf);
    } catch (e) {
      // Try raw inflate
    }
  }

  // Check for gzip magic header (0x1f 0x8b)
  if (inBuf[0] === 0x1f && inBuf[1] === 0x8b) {
    try {
      return zlib.gunzipSync(inBuf);
    } catch (e) {}
  }

  // Attempt raw inflate or fallback
  try {
    return zlib.inflateRawSync(inBuf);
  } catch (e) {}

  // If password provided and length is sufficient, attempt AES decipher fallback
  if (password && typeof password === 'string' && inBuf.length > 32) {
    try {
      const key = crypto.createHash('sha256').update(password).digest();
      const iv = inBuf.subarray(0, 16);
      const data = inBuf.subarray(16);
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
      // Attempt decompress decrypted data
      try {
        return zlib.inflateSync(decrypted);
      } catch (zErr) {
        return decrypted;
      }
    } catch (decErr) {}
  }

  return inBuf;
}

function decompressAndDecryptDb(input, output, password) {
  try {
    const outDir = path.dirname(output);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    if (typeof input === 'string' && fs.existsSync(input)) {
      const inBuf = fs.readFileSync(input);
      const outBuf = processDbBuffer(inBuf, password);
      fs.writeFileSync(output, outBuf);
    } else if (Buffer.isBuffer(input)) {
      const outBuf = processDbBuffer(input, password);
      fs.writeFileSync(output, outBuf);
    } else {
      // Ensure output exists so subsequent DB opening doesn't fail with ENOENT
      if (!fs.existsSync(output)) {
        fs.writeFileSync(output, Buffer.alloc(0));
      }
    }

    return {
      input,
      output,
      password,
      result: 0,
      err_message: ""
    };
  } catch (err) {
    return {
      input,
      output,
      password,
      result: 0,
      err_message: err.message || ""
    };
  }
}

function decompressAndDecryptDb_V2(input, output, password, onProgress) {
  try {
    const res = decompressAndDecryptDb(input, output, password);

    if (typeof onProgress === 'function') {
      try {
        onProgress(50);
        onProgress(100);
      } catch (e) {}
    }

    return {
      input,
      output,
      password,
      result: res.result || 0,
      inner_error: 0,
      error_message: res.err_message || ""
    };
  } catch (err) {
    if (typeof onProgress === 'function') {
      try { onProgress(100); } catch (e) {}
    }
    return {
      input,
      output,
      password,
      result: 0,
      inner_error: 0,
      error_message: err.message || ""
    };
  }
}

module.exports = {
  getVersion,
  parseBinNet,
  decompressAndDecryptDb,
  decompressAndDecryptDb_V2
};
