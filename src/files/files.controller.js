import * as fileService from './files.service.js';

export function getFiles(req, res) {
    const files = fileService.listFiles();

    const fileUrls = files.map(file => ({
        name: file,
        url: `/shared/${encodeURIComponent(file)}`,
    }));

    res.json(fileUrls.filter(f => f.name !== 'messages.json'));
}

export function downloadFile(req, res) {
    try {
        const filePath = fileService.getFilePath(req.params.filename);
        res.download(filePath);
    } catch (error) {
        if (error.code === 'EINVAL_FILENAME') {
            return res.status(400).json({ error: 'Invalid filename' });
        }

        if (error.code === 'ENOENT') {
            return res.status(404).json({ error: 'File not found' });
        }

        // Generic error
        console.error('Error downloading file:', error);
        return res.status(500).json({ error: 'Failed to download file' });
    }
}

export function uploadFile(req, res) {
    const files = Array.isArray(req.files) ? req.files : (req.file ? [req.file] : []);

    if (files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploaded = files.map(f => ({
        originalname: f.originalname,
        filename: f.filename,
        size: f.size,
        mimetype: f.mimetype,
        url: `/shared/${encodeURIComponent(f.filename)}`,
    }));

    return res.status(201).json({
        message: 'Files uploaded successfully',
        count: uploaded.length,
        files: uploaded,
    });
}

export function deleteFile(req, res) {
    const filename = decodeURIComponent(req.params.filename);

    try {
        fileService.deleteFile(filename);
        return res.json({ message: 'File deleted successfully', name: filename });
    } catch (error) {
        if (error.code === 'EINVAL_FILENAME') {
            return res.status(400).json({ error: 'Invalid filename' });
        }

        if (error.code === 'ENOENT') {
            return res.status(404).json({ error: 'File not found' });
        }

        console.error('Error deleting file:', error);
        return res.status(500).json({ error: 'Failed to delete file' });
    }
}
