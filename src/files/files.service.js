import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sharedDir = path.join(__dirname, '../../shared');

export function isValidFilename(filename) {
    if (!filename || typeof filename !== 'string') return false;

    // Disallow path separators and parent directory traversal
    if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) return false;

    // Optionally disallow leading dots (hidden/system files)
    if (filename.startsWith('.')) return false;

    // Simple length guard
    if (filename.length > 255) return false;

    return true;
}

export function listFiles() {
    return fs.readdirSync(sharedDir);
}

export function getFilePath(filename) {
    if (!isValidFilename(filename)) {
        const err = new Error('Invalid filename');
        err.code = 'EINVAL_FILENAME';
        throw err;
    }

    const filePath = path.join(sharedDir, filename);

    // Extra safety: ensure resolved path is still within sharedDir
    const normalizedShared = path.resolve(sharedDir) + path.sep;
    const normalizedFile = path.resolve(filePath);

    if (!normalizedFile.startsWith(normalizedShared)) {
        const err = new Error('Invalid filename');
        err.code = 'EINVAL_FILENAME';
        throw err;
    }

    return filePath;
}

export function deleteFile(filename) {
    const filePath = getFilePath(filename);

    if (!fs.existsSync(filePath)) {
        const err = new Error('File not found');
        err.code = 'ENOENT';
        throw err;
    }

    fs.unlinkSync(filePath);
}

export { sharedDir };
