import * as messageService from '@/lib/messages';

type ServiceError = Error & { code?: string };

export async function GET(): Promise<Response> {
  try {
    const messages = messageService.safeReadMessages();
    return Response.json(messages, { status: 200 });
  } catch (err) {
    console.error('Error reading messages:', err);
    return Response.json({ error: 'Failed to load messages' }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body: unknown = await request.json().catch(() => ({} as unknown));

    // Narrow body to an object with optional text
    const text =
      typeof body === 'object' && body !== null && 'text' in body
        ? (body as { text?: unknown }).text
        : undefined;

    const saved = messageService.appendMessage({ text });

    return Response.json(
      { message: 'Message received', data: saved },
      { status: 201 },
    );
  } catch (err) {
    const e = err as ServiceError;

    if (e?.code === 'EINVAL_TEXT') {
      return Response.json(
        { error: 'Message text is required' },
        { status: 400 },
      );
    }

    console.error('Error saving message:', err);
    return Response.json({ error: 'Failed to save message' }, { status: 500 });
  }
}