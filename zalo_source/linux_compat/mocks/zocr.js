/**
 * Linux Compatibility Mock for zocr (Optical Character Recognition)
 * Returns supported: false and safe no-op promises to bypass OCR runtime checks.
 */

const unsupportedReason = () => "unsupported-platform";
const isSupported = () => false;

function createOcrEngine(options) {
  return {
    availability: () => ({ supported: false, reason: "unsupported-platform" }),
    recognize: (input, opts) => Promise.reject(new Error("OCR unsupported on Linux")),
    prewarm: () => Promise.resolve({ status: "skipped" }),
    dispose: () => {}
  };
}

module.exports = {
  supported: false,
  isSupported,
  unsupportedReason,
  createOcrEngine,
  recognize: async () => ({ lines: [], textAngleDegrees: 0, meta: {} }),
  prewarm: async () => ({ status: "skipped" }),
  dispose: () => {},
  platform: () => "linux",
  version: () => "1.0.0",
  getPipeTransport: () => null,
  loadError: null
};
