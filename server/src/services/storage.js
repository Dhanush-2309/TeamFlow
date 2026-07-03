const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = process.env.FILE_STORAGE_DIR || path.join(__dirname, '..', '..', 'storage');
fs.mkdirSync(ROOT, { recursive: true });

function saveBuffer(buffer, originalName) {
  const key = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}-${originalName}`;
  fs.writeFileSync(path.join(ROOT, key), buffer);
  return key;
}

function readBuffer(key) {
  return fs.readFileSync(path.join(ROOT, key));
}

module.exports = { saveBuffer, readBuffer, ROOT };
