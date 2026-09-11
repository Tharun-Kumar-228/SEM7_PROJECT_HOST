const multer = require('multer');
const path = require('path');
const { SAMPLES_DIR, EXCELS_DIR, ensureStorageDirectories } = require('../config/storage');

ensureStorageDirectories();

// Storage engine for sample stroke images
const sampleStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, SAMPLES_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `sample-${uniqueSuffix}${ext}`);
  },
});

// Storage engine for Excel uploads
const excelStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, EXCELS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase() || '.xlsx';
    cb(null, `excel-${uniqueSuffix}${ext}`);
  },
});

const sampleFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'application/octet-stream'];
  if (allowedMimeTypes.includes(file.mimetype) || file.originalname.match(/\.(png|jpg|jpeg|webp|svg)$/i)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid image file type. Only PNG, JPEG, WEBP, and SVG formats are allowed.'));
  }
};

const excelFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/octet-stream',
  ];
  if (allowedMimeTypes.includes(file.mimetype) || file.originalname.match(/\.xlsx$/i)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only .xlsx Excel files are supported.'));
  }
};

const uploadSample = multer({
  storage: sampleStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: sampleFilter,
});

const uploadExcel = multer({
  storage: excelStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: excelFilter,
});

module.exports = { uploadSample, uploadExcel };
