import * as messageService from '@/lib/messages';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// This resolves to <repoRoot>/shared
const sharedDir = path.join(__dirname, '../../../../../shared');

type ServiceError = Error & { code?: string };

type UploadedFile = {
  originalName: string;
  filename: string;
  size: number;
  mimetype: string;
  url: string;
};

function sanitizeFilenamePart(name: string): string {
  const base = (name || 'file')
    .replace(/[/\\]/g, '-')
    .replace(/\.\.+/g, '.')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(0, 120);
  return base || 'file';
}

async function ensureSharedDir(): Promise<void> {
  await fs.mkdir(sharedDir, { recursive: true });
}

async function saveFormFile(file: File): Promise<UploadedFile> {
  const safeOriginal = sanitizeFilenamePart(file.name || 'file');
  const filename = `${Date.now()}-${Math.random().toString(16).slice(2)}-${safeOriginal}`;

  await ensureSharedDir();

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(sharedDir, filename), buffer);

  return {
    originalName: file.name,
    filename,
    size: file.size,
    mimetype: file.type || 'application/octet-stream',
    url: `/shared/${encodeURIComponent(filename)}`,
  };
}

export async function POST(request: Request): Promise<Response> {
  try {
    const form = await request.formData();

    const filesRaw = form.getAll('file');
    const textRaw = form.get('text');
    const clientText = typeof textRaw === 'string' ? textRaw : undefined;

    const files = filesRaw.filter((x): x is File => x instanceof File);

    if (files.length === 0) {
      return Response.json({ error: 'No files uploaded' }, { status: 400 });
    }

    const uploaded: UploadedFile[] = [];
    for (const f of files) {
      uploaded.push(await saveFormFile(f));
    }

    // For file messages, default text is the original filename (single) or a short summary (multiple)
    const derivedText =
      clientText?.trim() ||
      (uploaded.length === 1
        ? uploaded[0].originalName
        : `${uploaded.length} files`);

    const saved = messageService.appendMessageWithFiles({ text: derivedText, files: uploaded });

    return Response.json(
      {
        message: 'Message uploaded',
        count: uploaded.length,
        files: uploaded,
        data: saved,
      },
      { status: 201 },
    );
  } catch (err) {
    const e = err as ServiceError;

    if (e?.code === 'EINVAL_TEXT') {
      return Response.json({ error: e.message }, { status: 400 });
    }

    console.error('Error uploading message files:', err);
    return Response.json({ error: 'Failed to upload files' }, { status: 500 });
  }
}
