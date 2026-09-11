const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
const SAMPLES_DIR = path.join(process.cwd(), UPLOAD_DIR, 'samples');
const EXCELS_DIR = path.join(process.cwd(), UPLOAD_DIR, 'excels');

const ensureStorageDirectories = () => {
  if (!fs.existsSync(SAMPLES_DIR)) {
    fs.mkdirSync(SAMPLES_DIR, { recursive: true });
  }
  if (!fs.existsSync(EXCELS_DIR)) {
    fs.mkdirSync(EXCELS_DIR, { recursive: true });
  }
};

module.exports = {
  UPLOAD_DIR,
  SAMPLES_DIR,
  EXCELS_DIR,
  ensureStorageDirectories,
};
