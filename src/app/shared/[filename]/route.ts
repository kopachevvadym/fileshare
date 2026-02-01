import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// <repoRoot>/shared
const sharedDir = path.join(__dirname, '../../../../shared');

function isValidFilename(filename: string): boolean {
  if (!filename || typeof filename !== 'string') return false;
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) return false;
  if (filename.startsWith('.')) return false;
  if (filename.length > 255) return false;
  return true;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
): Promise<Response> {
  const { filename } = await params;
  const decoded = decodeURIComponent(filename);

  if (!isValidFilename(decoded)) {
    return Response.json({ error: 'Invalid filename' }, { status: 400 });
  }

  const filePath = path.join(sharedDir, decoded);

  // Extra path traversal safety
  const normalizedShared = path.resolve(sharedDir) + path.sep;
  const normalizedFile = path.resolve(filePath);
  if (!normalizedFile.startsWith(normalizedShared)) {
    return Response.json({ error: 'Invalid filename' }, { status: 400 });
  }

  try {
    const data = await fs.readFile(filePath);

    // Basic content type mapping; browser can still sniff for many types.
    const ext = path.extname(decoded).toLowerCase();
    const contentType =
      ext === '.png'
        ? 'image/png'
        : ext === '.jpg' || ext === '.jpeg'
          ? 'image/jpeg'
          : ext === '.gif'
            ? 'image/gif'
            : ext === '.webp'
              ? 'image/webp'
              : ext === '.pdf'
                ? 'application/pdf'
                : ext === '.txt' || ext === '.log'
                  ? 'text/plain; charset=utf-8'
                  : 'application/octet-stream';

    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // inline to allow viewing in browser tab
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(decoded)}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      return Response.json({ error: 'File not found' }, { status: 404 });
    }

    console.error('Error reading shared file:', err);
    return Response.json({ error: 'Failed to read file' }, { status: 500 });
  }
}
