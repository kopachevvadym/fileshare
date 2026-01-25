import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';

import { ChatInput, type ChatSendPayload } from './ChatInput';

const meta: Meta<typeof ChatInput> = {
  title: 'App/ChatInput',
  component: ChatInput,
  parameters: {
    layout: 'centered',
  },
  args: {
    onSend: () => {},
  },
};

export default meta;

type Story = StoryObj<typeof ChatInput>;

function PayloadLogDemo() {
  const [events, setEvents] = useState<ChatSendPayload[]>([]);

  return (
    <div style={{ width: 720, maxWidth: '95vw' }}>
      <ChatInput
        onSend={(payload) => {
          setEvents((prev) => [payload, ...prev]);
        }}
      />

      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>onSend payloads</div>
        <pre
          style={{
            background: '#0b1020',
            color: '#dbeafe',
            padding: 12,
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.12)',
            maxHeight: 220,
            overflow: 'auto',
            fontSize: 12,
          }}
        >
          {events.length === 0
            ? 'Send a message (or files) to see payloads here.'
            : JSON.stringify(
                events.map((e) =>
                  'text' in e
                    ? { text: e.text }
                    : {
                        files: e.files.map((f) => ({
                          name: f.name,
                          type: f.type,
                          size: f.size,
                        })),
                      },
                ),
                null,
                2,
              )}
        </pre>
      </div>
    </div>
  );
}

export const Playground: Story = {
  render: () => <PayloadLogDemo />,
};
