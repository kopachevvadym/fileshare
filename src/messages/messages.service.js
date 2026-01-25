import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sharedDir = path.join(__dirname, '../../shared');
const messagesPath = path.join(sharedDir, 'messages.json');

function ensureSharedDir() {
    fs.mkdirSync(sharedDir, { recursive: true });
}

export function safeReadMessages() {
    ensureSharedDir();

    if (!fs.existsSync(messagesPath)) {
        return [];
    }

    try {
        const raw = fs.readFileSync(messagesPath, 'utf8');
        if (!raw.trim()) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        // If the file is corrupted, don't crash the server.
        return [];
    }
}

function writeMessages(messages) {
    ensureSharedDir();
    fs.writeFileSync(messagesPath, JSON.stringify(messages, null, 2) + '\n', 'utf8');
}

export function appendMessage({ text }) {
    const trimmed = typeof text === 'string' ? text.trim() : '';
    if (!trimmed) {
        const err = new Error('Message text is required');
        err.code = 'EINVAL_TEXT';
        throw err;
    }

    const messages = safeReadMessages();

    const entry = {
        id: Date.now(),
        text: trimmed,
        createdAt: new Date().toISOString(),
    };

    messages.push(entry);
    writeMessages(messages);

    return entry;
}

export function deleteMessageById(id) {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
        const err = new Error('Invalid message id');
        err.code = 'EINVAL_ID';
        throw err;
    }

    const messages = safeReadMessages();
    const idx = messages.findIndex((m) => Number(m?.id) === numericId);

    if (idx === -1) {
        const err = new Error('Message not found');
        err.code = 'ENOENT';
        throw err;
    }

    const [removed] = messages.splice(idx, 1);
    writeMessages(messages);
    return removed;
}

export { messagesPath };
