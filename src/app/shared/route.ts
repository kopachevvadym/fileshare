import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// <repoRoot>/shared
const sharedDir = path.join(__dirname, '../../../shared');

export async function GET(): Promise<Response> {
  try {
    const entries = await fs.readdir(sharedDir);
    const files = entries
      .filter((name) => name !== 'messages.json')
      .map((name) => ({ name, url: `/shared/${encodeURIComponent(name)}` }));

    return Response.json(files, { status: 200 });
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      return Response.json([], { status: 200 });
    }

    console.error('Error listing shared files:', err);
    return Response.json({ error: 'Failed to list files' }, { status: 500 });
  }
}
