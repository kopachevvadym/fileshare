import type { Meta, StoryObj } from '@storybook/react';
import React, { useEffect } from 'react';
import { Messenger } from './Messenger';

type Message = {
  id?: string;
  text?: string;
  createdAt?: string;
};

function makeFetchMock(seed: Message[]) {
  let db = [...seed];

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method ?? 'GET').toUpperCase();

    // GET /api/messages
    if (url.endsWith('/api/messages') && method === 'GET') {
      return new Response(JSON.stringify(db), { status: 200 });
    }

    // POST /api/messages
    if (url.endsWith('/api/messages') && method === 'POST') {
      const raw = init?.body ? String(init.body) : '{}';
      const body = JSON.parse(raw);
      const text = String(body?.text ?? '');

      const saved: Message = {
        id: globalThis.crypto?.randomUUID?.() ?? String(Date.now()),
        text,
        createdAt: new Date().toISOString(),
      };

      db = [...db, saved];

      // match your component expectation: { data: savedMessage }
      return new Response(JSON.stringify({ data: saved }), { status: 200 });
    }

    // PATCH/DELETE /api/messages/:id
    const m = url.match(/\/api\/messages\/([^/?#]+)/);
    if (m) {
      const id = decodeURIComponent(m[1]);

      if (method === 'DELETE') {
        db = db.filter((x) => String(x.id) !== String(id));
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      if (method === 'PATCH') {
        const raw = init?.body ? String(init.body) : '{}';
        const body = JSON.parse(raw);
        const nextText = String(body?.text ?? '');

        const idx = db.findIndex((x) => String(x.id) === String(id));
        if (idx === -1) {
          return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
        }

        db = db.map((x) => (String(x.id) === String(id) ? { ...x, text: nextText } : x));
        const updated = db.find((x) => String(x.id) === String(id));

        return new Response(JSON.stringify({ data: updated }), { status: 200 });
      }
    }

    // POST /api/files/upload (accept)
    if (url.endsWith('/api/files/upload') && method === 'POST') {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    return new Response(JSON.stringify({ error: `Unhandled ${method} ${url}` }), { status: 500 });
  };
}

function FetchMockDecorator({
                              children,
                              seedMessages,
                            }: {
  children: React.ReactNode;
  seedMessages: Message[];
}) {
  useEffect(() => {
    const original = globalThis.fetch;
    globalThis.fetch = makeFetchMock(seedMessages) as any;

    return () => {
      globalThis.fetch = original;
    };
  }, [seedMessages]);

  return <>{children}</>;
}

const meta: Meta<typeof Messenger> = {
  title: 'App/Messenger',
  component: Messenger,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story, ctx) => (
      <FetchMockDecorator seedMessages={ctx.parameters.seedMessages ?? []}>
        <div className="mx-auto max-w-2xl p-4">
          <Story />
        </div>
      </FetchMockDecorator>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof Messenger>;

export const Empty: Story = {
  parameters: { seedMessages: [] },
};

export const WithMessages: Story = {
  parameters: {
    seedMessages: [
      { id: '1', text: 'Hello from Storybook', createdAt: '2026-02-01T10:00:00.000Z' },
      { id: '2', text: 'Try copy/edit/delete me', createdAt: '2026-02-01T10:01:00.000Z' },
    ],
  },
};

export const ManyMessages: Story = {
  parameters: {
    seedMessages: Array.from({ length: 30 }).map((_, i) => ({
      id: String(i + 1),
      text: `Message #${i + 1}`,
      createdAt: new Date(Date.now() - i * 60_000).toISOString(),
    })),
  },
};
