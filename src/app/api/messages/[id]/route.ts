import * as messageService from '@/lib/messages';

type ServiceError = Error & { code?: string };

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(
  _request: Request,
  { params }: RouteContext,
): Promise<Response> {
  try {
    const { id } = await params;
    const removed = messageService.deleteMessageById(id);

    // Cascade delete attached files (best-effort). If a file is already gone, ignore it.
    if (removed && Array.isArray((removed as any).files)) {
      for (const f of (removed as any).files as Array<{ filename?: unknown }>) {
        if (f && typeof f === 'object' && 'filename' in f) {
          try {
            messageService.deleteSharedFile((f as any).filename);
          } catch (err) {
            // Don't fail message deletion if file deletion fails; just log.
            console.warn('Failed to delete attached file:', (f as any).filename, err);
          }
        }
      }
    }

    return Response.json(
      { message: 'Message deleted', data: removed },
      { status: 200 },
    );
  } catch (err) {
    const e = err as ServiceError;

    if (e?.code === 'EINVAL_ID') {
      return Response.json({ error: 'Invalid message id' }, { status: 400 });
    }

    if (e?.code === 'ENOENT') {
      return Response.json({ error: 'Message not found' }, { status: 404 });
    }

    console.error('Error deleting message:', err);
    return Response.json({ error: 'Failed to delete message' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: RouteContext,
): Promise<Response> {
  try {
    const { id } = await params;
    const body: unknown = await request.json().catch(() => ({} as unknown));

    const text =
      typeof body === 'object' && body !== null && 'text' in body
        ? (body as { text?: unknown }).text
        : undefined;

    const note =
      typeof body === 'object' && body !== null && 'note' in body
        ? (body as { note?: unknown }).note
        : undefined;

    const updated = messageService.updateMessageById(id, { text, note });

    return Response.json(
      { message: 'Message updated', data: updated },
      { status: 200 },
    );
  } catch (err) {
    const e = err as ServiceError;

    if (e?.code === 'EINVAL_ID') {
      return Response.json({ error: 'Invalid message id' }, { status: 400 });
    }

    if (e?.code === 'EINVAL_TEXT') {
      return Response.json(
        { error: 'Message text is required' },
        { status: 400 },
      );
    }

    if (e?.code === 'ENOENT') {
      return Response.json({ error: 'Message not found' }, { status: 404 });
    }

    console.error('Error updating message:', err);
    return Response.json({ error: 'Failed to update message' }, { status: 500 });
  }
}
