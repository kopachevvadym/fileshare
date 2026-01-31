import * as messageService from '@/lib/messages';

type ServiceError = Error & { code?: string };

interface RouteParams {
  params: {
    id: string;
  };
}

export async function DELETE(
  _request: Request,
  { params }: RouteParams
): Promise<Response> {
  try {
    const removed = messageService.deleteMessageById(params.id);

    return Response.json(
      { message: 'Message deleted', data: removed },
      { status: 200 }
    );
  } catch (err) {
    const e = err as ServiceError;

    if (e?.code === 'EINVAL_ID') {
      return Response.json(
        { error: 'Invalid message id' },
        { status: 400 }
      );
    }

    if (e?.code === 'ENOENT') {
      return Response.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    console.error('Error deleting message:', err);
    return Response.json(
      { error: 'Failed to delete message' },
      { status: 500 }
    );
  }
}