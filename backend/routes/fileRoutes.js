const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { uploadFile, getFiles, downloadFile, deleteFile } = require('../controllers/fileController');

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});

const upload = multer({ storage });

router.post('/upload', upload.single('file'), uploadFile);
router.get('/', getFiles);
router.get('/download/:filename', downloadFile);
router.delete('/:filename', deleteFile);

module.exports = router;