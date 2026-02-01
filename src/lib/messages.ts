import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sharedDir = path.join(__dirname, '../../shared');
export const messagesPath = path.join(sharedDir, 'messages.json');


export type MessageFile = {
  originalName: string;
  filename: string;
  size: number;
  mimetype: string;
  url: string;
};

export interface Message {
  id: number;
  text: string;
  createdAt: string;
  /** Optional per-message note. Empty/undefined means no note. */
  note?: string;
  /** Optional attachments uploaded alongside this message. */
  files?: MessageFile[];
}

export interface AppendMessageInput {
  text?: unknown;
}

export interface AppendMessageWithFilesInput {
  text?: unknown;
  files: MessageFile[];
}

export interface UpdateMessageInput {
  text?: unknown;
  note?: unknown;
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

export function appendMessageWithFiles({ text, files }: AppendMessageWithFilesInput): Message {
  const trimmed = typeof text === 'string' ? text.trim() : '';

  if (!Array.isArray(files) || files.length === 0) {
    const err: ServiceError = new Error('At least one file is required');
    err.code = 'EINVAL_TEXT';
    throw err;
  }

  const messages = safeReadMessages();

  const entry: Message = {
    id: Date.now(),
    text: trimmed || `Uploaded ${files.length} file${files.length === 1 ? '' : 's'}`,
    createdAt: new Date().toISOString(),
    files,
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

export function updateMessageById(id: unknown, { text, note }: UpdateMessageInput): Message {
  const numericId = Number(id);

  if (!Number.isFinite(numericId)) {
    const err: ServiceError = new Error('Invalid message id');
    err.code = 'EINVAL_ID';
    throw err;
  }

  const hasText = typeof text !== 'undefined';
  const hasNote = typeof note !== 'undefined';

  if (!hasText && !hasNote) {
    const err: ServiceError = new Error('No fields to update');
    // reuse existing 400 behavior in routes (treat as invalid text payload)
    err.code = 'EINVAL_TEXT';
    throw err;
  }

  let nextText: string | undefined;
  if (hasText) {
    const trimmed = typeof text === 'string' ? text.trim() : '';

    if (!trimmed) {
      const err: ServiceError = new Error('Message text is required');
      err.code = 'EINVAL_TEXT';
      throw err;
    }

    nextText = trimmed;
  }

  let nextNote: string | undefined;
  let shouldUnsetNote = false;
  if (hasNote) {
    const trimmedNote = typeof note === 'string' ? note.trim() : '';
    if (!trimmedNote) {
      shouldUnsetNote = true;
    } else {
      nextNote = trimmedNote;
    }
  }

  const messages = safeReadMessages();
  const idx = messages.findIndex((m) => m.id === numericId);

  if (idx === -1) {
    const err: ServiceError = new Error('Message not found');
    err.code = 'ENOENT';
    throw err;
  }

  const updated: Message = {
    ...messages[idx],
    ...(hasText ? { text: nextText! } : null),
    ...(hasNote ? (shouldUnsetNote ? { note: undefined } : { note: nextNote }) : null),
  };

  // Ensure we don't persist `note: undefined` in JSON output.
  if (hasNote && shouldUnsetNote) {
    delete (updated as any).note;
  }

  messages[idx] = updated;
  writeMessages(messages);

  return updated;
}

export function isValidSharedFilename(filename: unknown): boolean {
  if (!filename || typeof filename !== 'string') return false;
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) return false;
  if (filename.startsWith('.')) return false;
  return filename.length <= 255;
}

export function getSharedFilePath(filename: unknown): string {
  if (!isValidSharedFilename(filename)) {
    const err: ServiceError = new Error('Invalid filename');
    err.code = 'EINVAL_TEXT';
    throw err;
  }

  const name = filename as string;
  const filePath = path.join(sharedDir, name);

  const normalizedShared = path.resolve(sharedDir) + path.sep;
  const normalizedFile = path.resolve(filePath);
  if (!normalizedFile.startsWith(normalizedShared)) {
    const err: ServiceError = new Error('Invalid filename');
    err.code = 'EINVAL_TEXT';
    throw err;
  }

  return filePath;
}

/** Best-effort delete: ignores missing files. Throws for invalid filenames. */
export function deleteSharedFile(filename: unknown): boolean {
  const filePath = getSharedFilePath(filename);

  try {
    if (!fs.existsSync(filePath)) return false;
    fs.unlinkSync(filePath);
    return true;
  } catch (err) {
    // If it vanished concurrently, ignore.
    if ((err as any)?.code === 'ENOENT') return false;
    throw err;
  }
}
