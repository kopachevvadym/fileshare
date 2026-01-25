# @vamspace/fileshare

Simple local file sharing utility built with Express.

## Running

By default the server starts on http://localhost:3000 and serves the UI at `/`.

## API

### List files

`GET /api/files`

Returns an array of objects:

```json
[
  {
    "name": "1700000000000-example.txt",
    "url": "/shared/1700000000000-example.txt"
  }
]
```

### Upload file

`POST /api/files/upload`

Form-data field: `file` (single file).

Returns 201 with:

```json
{
  "message": "File uploaded successfully",
  "file": { /* multer file object */ }
}
```

### Delete file

`DELETE /api/files/:filename`

- `:filename` must be URL-encoded and must exactly match one of the `name` values returned by `GET /api/files`.
- Only files inside the `shared` directory can be deleted.

Responses:

- `200` – `{ "message": "File deleted successfully", "name": "..." }`
- `400` – `{ "error": "Invalid filename" }` for invalid or unsafe names (path traversal, separators, etc.).
- `404` – `{ "error": "File not found" }` if the file does not exist.
- `500` – `{ "error": "Failed to delete file" }` for unexpected server errors.

## Frontend

Open http://localhost:3000 in a browser to:

- See the list of shared files.
- Upload a new file.
- Delete an existing file using the trash-can icon next to each item.

This tool is intended for local/developer use and does not implement authentication.

