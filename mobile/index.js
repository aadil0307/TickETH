// ──────────────────────────────────────────────────────────────
// TickETH App Entry Point
// Crypto polyfills MUST load before any other module (thirdweb,
// MetaMask, ethers) attempts to access globalThis.crypto.
// ──────────────────────────────────────────────────────────────

// 1. Polyfill crypto.getRandomValues on globalThis.crypto
require('react-native-get-random-values');

// 2. Defensive: guarantee globalThis.crypto exists with getRandomValues
if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = {};
}
if (typeof globalThis.crypto.getRandomValues !== 'function') {
  // Fallback (should not be reached after react-native-get-random-values)
  globalThis.crypto.getRandomValues = function (array) {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  };
}

// 3. Polyfill randomUUID if missing
if (typeof globalThis.crypto.randomUUID !== 'function') {
  globalThis.crypto.randomUUID = function () {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return (
      hex.slice(0, 8) + '-' +
      hex.slice(8, 12) + '-' +
      hex.slice(12, 16) + '-' +
      hex.slice(16, 20) + '-' +
      hex.slice(20)
    );
  };
}

// 4. Boot the Expo Router app
require('expo-router/entry');
