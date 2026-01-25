import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { uploadFile, getFiles, downloadFile, deleteFile } from './files.controller.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = multer.diskStorage({
    destination: path.join(__dirname, '../../shared'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});

const upload = multer({ storage });

router.get('/', getFiles);
router.get('/:filename', downloadFile);
router.delete('/:filename', deleteFile);
router.post('/upload', upload.array('file', 20), uploadFile);

export default router;
