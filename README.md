# File share

Simple, local file sharing + lightweight “message board” built with **Next.js**.

- Uploaded files are saved to `./shared/`
- Messages are stored in `./shared/messages.json`

## Requirements

- Node.js (recommended: latest LTS)
- pnpm

## Install

```bash
pnpm install
```

## Run

### Development

```bash
pnpm dev
```

This starts the app on the default Next.js dev URL (usually http://localhost:3000).

### Production

```bash
pnpm build
pnpm start
```

## What gets stored where

- **Files:** `shared/<generated-name>-<original-name>`
- **Messages:** `shared/messages.json`

If `shared/` doesn’t exist yet, it will be created on first upload.

## Routes / API

### UI

- `GET /` – app UI

### Health

- `GET /api/health` → `{ ok: true }`

### Shared files

- `GET /shared` – lists files in `./shared` (excluding `messages.json`)
- `GET /shared/:filename` – serves a single file (basic content-type mapping)

### Messages

- `GET /api/messages` – list messages
- `POST /api/messages` – add a text message (`{ "text": "..." }`)
- `PATCH /api/messages/:id` – update text and/or note (`{ "text": "...", "note": "..." }`)
- `DELETE /api/messages/:id` – delete a message (also best-effort deletes attached shared files)

### Upload

- `POST /api/messages/upload` – multipart upload (field name: `file`, supports multiple) with optional `text`

## Quick examples

### Upload a file

```bash
curl -F "file=@/path/to/file.png" http://localhost:3000/api/messages/upload
```

### Upload multiple files with a custom message

```bash
curl \
  -F "text=Here are the files" \
  -F "file=@/path/to/a.pdf" \
  -F "file=@/path/to/b.png" \
  http://localhost:3000/api/messages/upload
```

### List shared files

```bash
curl http://localhost:3000/shared
```

### Fetch a shared file in the browser

Open the `url` returned by `/shared`, e.g.:

- `http://localhost:3000/shared/<filename>`
