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
  /** Optional per-message note. Empty/undefined means no note. */
  note?: string;
}

export interface AppendMessageInput {
  text?: unknown;
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
