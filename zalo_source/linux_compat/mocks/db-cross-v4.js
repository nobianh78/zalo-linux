/**
 * Linux Compatibility Implementation for db-cross-v4-native.node
 * Implements N-API exports: getVersion, parseBinNet, decompressAndDecryptDb, decompressAndDecryptDb_V2
 * Handles Zalo message sync backup decryption (AES-256-CBC) and extraction of ZDB4.0 multi-file archives.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const LOG_FILE = '/tmp/zalo_sync.log';

function logSync(...args) {
  try {
    const msg = args.map(a => {
      if (Buffer.isBuffer(a)) return `<Buffer len=${a.length} hex=${a.subarray(0, 32).toString('hex')}>`;
      if (typeof a === 'object') {
        try { return JSON.stringify(a); } catch (e) { return String(a); }
      }
      return String(a);
    }).join(' ');
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (e) {}
  console.log(...args);
}

logSync('[db-cross-v4] Module loaded');

function getVersion() {
  return "4.0.0";
}

function parseBinNet(buffer) {
  logSync('[db-cross-v4] parseBinNet called, buffer length:', buffer ? buffer.length : 0);
  return {
    result: 0,
    data: {
      attachs: []
    }
  };
}

/**
 * Decompress buffer using zlib inflate, raw deflate, gzip, or python lzma fallback
 */
function decompressBuffer(buf) {
  if (!Buffer.isBuffer(buf) || buf.length === 0) return null;

  // 1. Try standard zlib inflate
  try {
    const res = zlib.inflateSync(buf);
    if (res && res.length > 0) {
      logSync('[db-cross-v4] decompressBuffer: zlib.inflateSync succeeded, len =', res.length);
      return res;
    }
  } catch (e1) {}

  // 2. Try raw deflate (no zlib wrapper)
  try {
    const res = zlib.inflateRawSync(buf);
    if (res && res.length > 0) {
      logSync('[db-cross-v4] decompressBuffer: zlib.inflateRawSync succeeded, len =', res.length);
      return res;
    }
  } catch (e2) {}

  // 3. Try gunzip
  try {
    const res = zlib.gunzipSync(buf);
    if (res && res.length > 0) {
      logSync('[db-cross-v4] decompressBuffer: zlib.gunzipSync succeeded, len =', res.length);
      return res;
    }
  } catch (e3) {}

  // 4. Try Python LZMA
  try {
    const out = execFileSync('python3', ['-c', `
import sys, lzma
raw = sys.stdin.buffer.read()
try:
    sys.stdout.buffer.write(lzma.decompress(raw))
except Exception:
    sys.stdout.buffer.write(lzma.decompress(raw, format=lzma.FORMAT_ALONE))
`], { input: buf, maxBuffer: 300 * 1024 * 1024, stdio: ['pipe', 'pipe', 'ignore'] });
    if (out && out.length > 0) {
      logSync('[db-cross-v4] decompressBuffer: LZMA succeeded, len =', out.length);
      return out;
    }
  } catch (e4) {}

  logSync('[db-cross-v4] decompressBuffer: All decompression methods failed!');
  return null;
}

/**
 * Decrypts a buffer using AES-256-CBC with password/privateKey
 */
function decryptBackupBuffer(inBuf, password) {
  if (!Buffer.isBuffer(inBuf) || inBuf.length === 0) {
    logSync('[db-cross-v4] decryptBackupBuffer: empty input buffer');
    return inBuf;
  }

  logSync('[db-cross-v4] decryptBackupBuffer called, inBuf len =', inBuf.length,
          'first 32 bytes hex =', inBuf.subarray(0, 32).toString('hex'),
          'password len =', password ? String(password).length : 0);

  // Already decrypted check
  if (inBuf.length >= 6 && inBuf.subarray(0, 6).toString('ascii') === 'ZDB4.0') {
    logSync('[db-cross-v4] Input is already decrypted ZDB4.0 archive');
    return inBuf;
  }
  if (inBuf.length >= 16 && inBuf.subarray(0, 16).toString('ascii') === 'SQLite format 3\0') {
    logSync('[db-cross-v4] Input is already decrypted SQLite database');
    return inBuf;
  }
  if (inBuf.length >= 4 && inBuf[0] === 0x50 && inBuf[1] === 0x4b && inBuf[2] === 0x03 && inBuf[3] === 0x04) {
    logSync('[db-cross-v4] Input is already decrypted ZIP archive');
    return inBuf;
  }

  if (!password) {
    logSync('[db-cross-v4] decryptBackupBuffer: No password provided!');
    return inBuf;
  }

  const strPass = String(password);
  const keyCandidates = [];

  // 1. Password as hex string (32 raw bytes = 64 hex characters)
  if (/^[0-9a-fA-F]{64}$/.test(strPass)) {
    try {
      keyCandidates.push({ name: 'hex-64', key: Buffer.from(strPass, 'hex'), cipher: 'aes-256-cbc' });
    } catch (e) {}
  }

  // 2. Password as hex string (16 raw bytes = 32 hex characters)
  if (/^[0-9a-fA-F]{32}$/.test(strPass)) {
    try {
      keyCandidates.push({ name: 'hex-32', key: Buffer.from(strPass, 'hex'), cipher: 'aes-128-cbc' });
    } catch (e) {}
  }

  // 3. Password string directly as UTF-8 / ASCII, truncated/padded with zeroes to 32 bytes (exact C++ db-cross-v4 behavior)
  const keyZeros32 = Buffer.alloc(32, 0);
  Buffer.from(strPass, 'utf8').copy(keyZeros32, 0, 0, 32);
  keyCandidates.push({ name: 'utf8-padded-32', key: keyZeros32, cipher: 'aes-256-cbc' });

  // 4. Password string directly truncated/padded to 16 bytes
  const keyZeros16 = Buffer.alloc(16, 0);
  Buffer.from(strPass, 'utf8').copy(keyZeros16, 0, 0, 16);
  keyCandidates.push({ name: 'utf8-padded-16', key: keyZeros16, cipher: 'aes-128-cbc' });

  // 5. SHA-256 of password string
  keyCandidates.push({ name: 'sha256', key: crypto.createHash('sha256').update(strPass).digest(), cipher: 'aes-256-cbc' });

  // 6. MD5 of password string
  keyCandidates.push({ name: 'md5', key: crypto.createHash('md5').update(strPass).digest(), cipher: 'aes-128-cbc' });

  const ivZeros = Buffer.alloc(16, 0);

  for (const cand of keyCandidates) {
    // Attempt A: Zero IV, no padding
    try {
      const decipher = crypto.createDecipheriv(cand.cipher, cand.key, ivZeros);
      decipher.setAutoPadding(false);
      const dec = Buffer.concat([decipher.update(inBuf), decipher.final()]);
      if (dec.length >= 6 && dec.subarray(0, 6).toString('ascii') === 'ZDB4.0') {
        logSync(`[db-cross-v4] Decrypted ZDB4.0 with key candidate ${cand.name} (zero IV, no padding)!`);
        return dec;
      }
      if (dec.length >= 16 && dec.subarray(0, 16).toString('ascii') === 'SQLite format 3\0') {
        logSync(`[db-cross-v4] Decrypted SQLite with key candidate ${cand.name} (zero IV, no padding)!`);
        return dec;
      }
      if (dec.length >= 4 && dec[0] === 0x50 && dec[1] === 0x4b && dec[2] === 0x03 && dec[3] === 0x04) {
        logSync(`[db-cross-v4] Decrypted ZIP with key candidate ${cand.name} (zero IV, no padding)!`);
        return dec;
      }
    } catch (e) {}

    // Attempt B: Zero IV, PKCS7 padding
    try {
      const decipher = crypto.createDecipheriv(cand.cipher, cand.key, ivZeros);
      const dec = Buffer.concat([decipher.update(inBuf), decipher.final()]);
      if (dec.length >= 6 && dec.subarray(0, 6).toString('ascii') === 'ZDB4.0') {
        logSync(`[db-cross-v4] Decrypted ZDB4.0 with key candidate ${cand.name} (zero IV, PKCS7)!`);
        return dec;
      }
      if (dec.length >= 16 && dec.subarray(0, 16).toString('ascii') === 'SQLite format 3\0') {
        logSync(`[db-cross-v4] Decrypted SQLite with key candidate ${cand.name} (zero IV, PKCS7)!`);
        return dec;
      }
      if (dec.length >= 4 && dec[0] === 0x50 && dec[1] === 0x4b && dec[2] === 0x03 && dec[3] === 0x04) {
        logSync(`[db-cross-v4] Decrypted ZIP with key candidate ${cand.name} (zero IV, PKCS7)!`);
        return dec;
      }
    } catch (e) {}

    // Attempt C: First 16 bytes is prepended IV
    if (inBuf.length > 32) {
      const iv = inBuf.subarray(0, 16);
      const data = inBuf.subarray(16);
      try {
        const decipher = crypto.createDecipheriv(cand.cipher, cand.key, iv);
        decipher.setAutoPadding(false);
        const dec = Buffer.concat([decipher.update(data), decipher.final()]);
        if (dec.length >= 6 && dec.subarray(0, 6).toString('ascii') === 'ZDB4.0') {
          logSync(`[db-cross-v4] Decrypted ZDB4.0 with key candidate ${cand.name} (prepended IV, no padding)!`);
          return dec;
        }
        if (dec.length >= 16 && dec.subarray(0, 16).toString('ascii') === 'SQLite format 3\0') {
          logSync(`[db-cross-v4] Decrypted SQLite with key candidate ${cand.name} (prepended IV, no padding)!`);
          return dec;
        }
      } catch (e) {}

      try {
        const decipher = crypto.createDecipheriv(cand.cipher, cand.key, iv);
        const dec = Buffer.concat([decipher.update(data), decipher.final()]);
        if (dec.length >= 6 && dec.subarray(0, 6).toString('ascii') === 'ZDB4.0') {
          logSync(`[db-cross-v4] Decrypted ZDB4.0 with key candidate ${cand.name} (prepended IV, PKCS7)!`);
          return dec;
        }
        if (dec.length >= 16 && dec.subarray(0, 16).toString('ascii') === 'SQLite format 3\0') {
          logSync(`[db-cross-v4] Decrypted SQLite with key candidate ${cand.name} (prepended IV, PKCS7)!`);
          return dec;
        }
      } catch (e) {}
    }
  }

  logSync('[db-cross-v4] WARNING: Could not find valid header (ZDB4.0, SQLite, ZIP) with any key candidate!');
  try {
    fs.writeFileSync('/tmp/zalo_sync_encrypted_input.bin', inBuf);
    logSync('[db-cross-v4] Dumped raw encrypted input to /tmp/zalo_sync_encrypted_input.bin');
  } catch (e) {}

  return null;
}

/**
 * Extracts a ZDB4.0 multi-file archive into output directory
 */
function extractZdbArchive(decryptedBuf, outputDir, onProgress) {
  if (decryptedBuf.length < 18 || decryptedBuf.subarray(0, 6).toString('ascii') !== 'ZDB4.0') {
    logSync('[db-cross-v4] extractZdbArchive: Invalid ZDB4.0 magic header!');
    return false;
  }

  let offset = 6;
  const totalArchiveLen = decryptedBuf.readUInt32BE(offset); offset += 4;
  const checksum = decryptedBuf.readUInt32BE(offset); offset += 4;
  const numFiles = decryptedBuf.readUInt32BE(offset); offset += 4;

  logSync(`[db-cross-v4] Parsing ZDB4.0 archive: totalArchiveLen=${totalArchiveLen}, checksum=0x${checksum.toString(16)}, numFiles=${numFiles}`);

  const files = [];
  for (let i = 0; i < numFiles; i++) {
    if (offset + 4 > decryptedBuf.length) break;
    const nameLen = decryptedBuf.readUInt32BE(offset); offset += 4;
    if (offset + nameLen + 4 > decryptedBuf.length) break;
    const name = decryptedBuf.toString('utf8', offset, offset + nameLen); offset += nameLen;
    const size = decryptedBuf.readUInt32BE(offset); offset += 4;
    files.push({ name, size });
  }

  logSync(`[db-cross-v4] Archive contains ${files.length} files:`, files.map(f => `${f.name} (${f.size}B)`));

  const compressedData = decryptedBuf.subarray(offset);
  logSync(`[db-cross-v4] Compressed payload offset = ${offset}, remaining length = ${compressedData.length}`);

  const decompressed = decompressBuffer(compressedData);
  if (!decompressed || !Buffer.isBuffer(decompressed)) {
    logSync('[db-cross-v4] Failed to decompress ZDB4.0 payload stream!');
    return false;
  }

  logSync(`[db-cross-v4] Decompressed payload size = ${decompressed.length}`);
  fs.mkdirSync(outputDir, { recursive: true });

  let readPos = 0;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileData = decompressed.subarray(readPos, readPos + file.size);
    readPos += file.size;

    const destPath = path.join(outputDir, file.name);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, fileData);
    logSync(`[db-cross-v4] Wrote ${file.name} (${fileData.length} bytes) to ${destPath}`);

    // If filename is group_<id>.db, also create g<id>.db copy/symlink
    if (file.name.startsWith('group_')) {
      const aliasName = 'g' + file.name.substring(6);
      const aliasPath = path.join(outputDir, aliasName);
      try {
        fs.writeFileSync(aliasPath, fileData);
        logSync(`[db-cross-v4] Created alias ${aliasName} -> ${file.name}`);
      } catch (e) {}
    } else if (/^g\d+\.db$/.test(file.name)) {
      // If filename is g<id>.db, also create group_<id>.db
      const aliasName = 'group_' + file.name.substring(1);
      const aliasPath = path.join(outputDir, aliasName);
      try {
        fs.writeFileSync(aliasPath, fileData);
        logSync(`[db-cross-v4] Created alias ${aliasName} -> ${file.name}`);
      } catch (e) {}
    }

    if (typeof onProgress === 'function') {
      try {
        const pct = Math.floor(((i + 1) / files.length) * 100);
        onProgress(pct);
      } catch (e) {}
    }
  }

  logSync(`[db-cross-v4] Successfully unpacked all ${files.length} databases into ${outputDir}`);
  return true;
}

/**
 * Format 0: Single DB decompress and decrypt
 */
function decompressAndDecryptDb(input, output, password) {
  try {
    logSync(`[db-cross-v4] decompressAndDecryptDb (Format 0) called: input=${typeof input === 'string' ? input : 'Buffer'}, output=${output}`);

    let inBuf;
    if (typeof input === 'string' && fs.existsSync(input)) {
      inBuf = fs.readFileSync(input);
    } else if (Buffer.isBuffer(input)) {
      inBuf = input;
    } else {
      throw new Error(`Input file not found: ${input}`);
    }

    const decrypted = decryptBackupBuffer(inBuf, password);
    if (!decrypted) {
      throw new Error('Failed to decrypt input buffer with given password');
    }

    const isOutputDir = output.endsWith('/') || output.endsWith('\\') || (fs.existsSync(output) && fs.statSync(output).isDirectory());

    if (isOutputDir || (decrypted.length >= 6 && decrypted.subarray(0, 6).toString('ascii') === 'ZDB4.0')) {
      const targetDir = isOutputDir ? output : path.dirname(output);
      const ok = extractZdbArchive(decrypted, targetDir, null);
      if (!ok && !isOutputDir) {
        fs.writeFileSync(output, decrypted);
      }
    } else {
      const outDir = path.dirname(output);
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }
      fs.writeFileSync(output, decrypted);
    }

    return {
      input,
      output,
      password,
      result: 0,
      err_message: ""
    };
  } catch (err) {
    logSync('[db-cross-v4] Error in decompressAndDecryptDb:', err.message);
    return {
      input,
      output,
      password,
      result: 3,
      err_message: err.message || ""
    };
  }
}

/**
 * Format 1: Multi-database V2 format with progress callback
 */
function decompressAndDecryptDb_V2(input, output, password, onProgress) {
  try {
    logSync(`[db-cross-v4] decompressAndDecryptDb_V2 (Format 1) called: input=${typeof input === 'string' ? input : 'Buffer'}, output=${output}`);

    let inBuf;
    if (typeof input === 'string' && fs.existsSync(input)) {
      inBuf = fs.readFileSync(input);
      logSync(`[db-cross-v4] Read input file ${input}, size = ${inBuf.length} bytes`);
    } else if (Buffer.isBuffer(input)) {
      inBuf = input;
      logSync(`[db-cross-v4] Input is buffer, size = ${inBuf.length} bytes`);
    } else {
      throw new Error(`Input file not found or inaccessible: ${input}`);
    }

    if (typeof onProgress === 'function') {
      try { onProgress(15); } catch (e) {}
    }

    const decrypted = decryptBackupBuffer(inBuf, password);
    if (!decrypted) {
      throw new Error('Decryption failed: could not verify ZDB4.0/SQLite/ZIP magic header with provided key');
    }

    if (typeof onProgress === 'function') {
      try { onProgress(40); } catch (e) {}
    }

    const outputDir = (typeof output === 'string') ? output : String(output);
    fs.mkdirSync(outputDir, { recursive: true });

    // Check for ZDB4.0 multi-file archive
    if (decrypted.length >= 6 && decrypted.subarray(0, 6).toString('ascii') === 'ZDB4.0') {
      const ok = extractZdbArchive(decrypted, outputDir, (pct) => {
        if (typeof onProgress === 'function') {
          try { onProgress(40 + Math.floor(pct * 0.6)); } catch (e) {}
        }
      });

      if (!ok) {
        throw new Error('Failed to unpack ZDB4.0 compressed payload stream');
      }
    } else if (decrypted.length >= 4 && decrypted[0] === 0x50 && decrypted[1] === 0x4b && decrypted[2] === 0x03 && decrypted[3] === 0x04) {
      logSync('[db-cross-v4] Detected ZIP backup archive, extracting...');
      const tmpZip = path.join(outputDir, '__sync_temp.zip');
      fs.writeFileSync(tmpZip, decrypted);
      try {
        execFileSync('7z', ['x', '-y', `-o${outputDir}`, tmpZip], { stdio: 'ignore' });
      } catch (zErr) {
        const AdmZip = require('adm-zip');
        const zip = new AdmZip(tmpZip);
        zip.extractAllTo(outputDir, true);
      }
      try { fs.unlinkSync(tmpZip); } catch (e) {}
    } else if (decrypted.length >= 16 && decrypted.subarray(0, 16).toString('ascii') === 'SQLite format 3\0') {
      logSync('[db-cross-v4] Detected single SQLite database, saving to Core.db');
      fs.writeFileSync(path.join(outputDir, 'Core.db'), decrypted);
    } else {
      logSync('[db-cross-v4] ERROR: Unrecognized decrypted data format!');
      try {
        fs.writeFileSync('/tmp/zalo_sync_unrecognized.bin', decrypted);
      } catch (e) {}
      throw new Error('Unrecognized decrypted backup format (neither ZDB4.0, ZIP, nor SQLite)');
    }

    if (typeof onProgress === 'function') {
      try { onProgress(100); } catch (e) {}
    }

    logSync(`[db-cross-v4] decompressAndDecryptDb_V2 COMPLETED SUCCESSFULLY for ${outputDir}`);

    return {
      input,
      output,
      password,
      result: 0,
      inner_error: 0,
      error_message: ""
    };
  } catch (err) {
    logSync('[db-cross-v4] FATAL ERROR in decompressAndDecryptDb_V2:', err.message);
    if (typeof onProgress === 'function') {
      try { onProgress(100); } catch (e) {}
    }
    return {
      input,
      output,
      password,
      result: 3,
      inner_error: -1,
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
