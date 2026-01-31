import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sharedDir = path.join(__dirname, '../../shared');
export const messagesPath = path.join(sharedDir, 'messages.json');


export interface Message {
  id: number;
  text: string;
  createdAt: string;
}

export interface AppendMessageInput {
  text?: unknown;
}

type ServiceErrorCode = 'EINVAL_TEXT' | 'EINVAL_ID' | 'ENOENT';

interface ServiceError extends Error {
  code?: ServiceErrorCode;
}

function ensureSharedDir(): void {
  fs.mkdirSync(sharedDir, { recursive: true });
}

function writeMessages(messages: Message[]): void {
  ensureSharedDir();
  fs.writeFileSync(
    messagesPath,
    JSON.stringify(messages, null, 2) + '\n',
    'utf8',
  );
}

export function safeReadMessages(): Message[] {
  ensureSharedDir();

  if (!fs.existsSync(messagesPath)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(messagesPath, 'utf8');
    if (!raw.trim()) return [];

    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Message[]) : [];
  } catch {
    // Corrupted file → fail safe
    return [];
  }
}

export function appendMessage({ text }: AppendMessageInput): Message {
  const trimmed = typeof text === 'string' ? text.trim() : '';

  if (!trimmed) {
    const err: ServiceError = new Error('Message text is required');
    err.code = 'EINVAL_TEXT';
    throw err;
  }

  const messages = safeReadMessages();

  const entry: Message = {
    id: Date.now(),
    text: trimmed,
    createdAt: new Date().toISOString(),
  };

  messages.push(entry);
  writeMessages(messages);

  return entry;
}

export function deleteMessageById(id: unknown): Message {
  const numericId = Number(id);

  if (!Number.isFinite(numericId)) {
    const err: ServiceError = new Error('Invalid message id');
    err.code = 'EINVAL_ID';
    throw err;
  }

  const messages = safeReadMessages();
  const idx = messages.findIndex(m => m.id === numericId);

  if (idx === -1) {
    const err: ServiceError = new Error('Message not found');
    err.code = 'ENOENT';
    throw err;
  }

  const [removed] = messages.splice(idx, 1);
  writeMessages(messages);

  return removed;
}
