const express = require('express');
const router = express.Router();
const { uploadFile, getFiles, downloadFile, deleteFile } = require('./files.controller');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: path.join(__dirname, '../../shared'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});

const upload = multer({ storage });

router.get('/', getFiles);
router.get('/:filename', downloadFile);
router.delete('/:filename', deleteFile);
router.post('/upload', upload.array('file', 20), uploadFile);

module.exports = router;