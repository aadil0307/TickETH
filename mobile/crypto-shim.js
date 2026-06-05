// Shim for Node's "crypto" module in React Native.
// Metro's resolveRequest redirects require('crypto') here.
// The global polyfill (react-native-get-random-values) is set up in index.js
// BEFORE this module ever loads, so globalThis.crypto is guaranteed to exist.

// Defensive re-import – harmless if already loaded via index.js
require('react-native-get-random-values');

// Reference the (now-guaranteed) global crypto
const webCrypto = globalThis.crypto;

// Build a randomBytes function compatible with Node's crypto.randomBytes
function randomBytes(size) {
  const bytes = new Uint8Array(size);
  webCrypto.getRandomValues(bytes);
  // Return a Buffer-like object
  return {
    buffer: bytes.buffer,
    byteLength: bytes.byteLength,
    [Symbol.iterator]: bytes[Symbol.iterator].bind(bytes),
    toString(encoding) {
      if (encoding === 'hex') {
        return Array.from(bytes)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
      }
      return String.fromCharCode.apply(null, bytes);
    },
  };
}

// Create a subtle-like object that passes through to globalThis.crypto.subtle
// when available (modern RN runtimes support it via Hermes)
const subtle = webCrypto.subtle || {};

module.exports = {
  webcrypto: webCrypto,
  subtle: subtle,
  getRandomValues: webCrypto.getRandomValues
    ? webCrypto.getRandomValues.bind(webCrypto)
    : undefined,
  randomBytes: randomBytes,
  randomUUID:
    typeof webCrypto.randomUUID === 'function'
      ? webCrypto.randomUUID.bind(webCrypto)
      : function () {
          // RFC4122 v4 UUID fallback
          const bytes = new Uint8Array(16);
          webCrypto.getRandomValues(bytes);
          bytes[6] = (bytes[6] & 0x0f) | 0x40;
          bytes[8] = (bytes[8] & 0x3f) | 0x80;
          const hex = Array.from(bytes)
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
          return (
            hex.slice(0, 8) +
            '-' +
            hex.slice(8, 12) +
            '-' +
            hex.slice(12, 16) +
            '-' +
            hex.slice(16, 20) +
            '-' +
            hex.slice(20)
          );
        },
  createHash: function () {
    throw new Error('crypto.createHash is not supported in React Native');
  },
};
