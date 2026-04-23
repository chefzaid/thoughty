const { randomUUID } = require('node:crypto');

function uuidToBytes(value) {
  const hex = value.replace(/-/g, '');
  const bytes = new Uint8Array(16);

  for (let index = 0; index < 16; index += 1) {
    const start = index * 2;
    bytes[index] = Number.parseInt(hex.slice(start, start + 2), 16);
  }

  return bytes;
}

function v4(_options, buffer, offset = 0) {
  const value = randomUUID();

  if (buffer === undefined) {
    return value;
  }

  const bytes = uuidToBytes(value);
  for (let index = 0; index < bytes.length; index += 1) {
    buffer[offset + index] = bytes[index];
  }

  return buffer;
}

module.exports = {
  v4,
};