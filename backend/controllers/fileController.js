const fs = require('fs');
const path = require('path');

// const uploadFile = (req, res) => {
//   if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
//   res.status(200).json({ message: 'File uploaded', file: req.file.filename });
// };

const uploadFile = (req, res) => {
  try {
    console.log('Received file:', req.file);
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    res.status(200).json({ message: 'File uploaded', file: req.file.filename });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

const getFiles = (req, res) => {
  const files = fs.readdirSync(path.join(__dirname, '../uploads'));
  res.status(200).json(files);
};

const downloadFile = (req, res) => {
  const filePath = path.join(__dirname, '../uploads', req.params.filename);
  if (fs.existsSync(filePath)) res.download(filePath);
  else res.status(404).json({ message: 'File not found' });
};

const deleteFile = (req, res) => {
  const filePath = path.join(__dirname, '../uploads', req.params.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    res.status(200).json({ message: 'File deleted' });
  } else res.status(404).json({ message: 'File not found' });
};

module.exports = { uploadFile, getFiles, downloadFile, deleteFile };