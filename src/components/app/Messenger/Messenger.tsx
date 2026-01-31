'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChatInput, type ChatSendPayload } from '@/components/app/ChatInput/ChatInput';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowsRotate, faXmark } from '@fortawesome/free-solid-svg-icons';

type Message = {
  id?: string;
  text?: string;
  createdAt?: string;
};

type CopyStatus = {
  id: string;
  ok: boolean;
  at: number;
} | null;

type PostMessageResponse =
  | { data?: Message; error?: string }
  | Message[]
  | null;

export function Messenger() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>(null);

  const copyTimeoutRef = useRef<number | null>(null);

  const messageKey = useCallback((m: Message) => {
    return m?.id ?? `${m?.createdAt ?? ''}-${m?.text ?? ''}`;
  }, []);

  const fetchMessages = useCallback(async () => {
    setIsLoadingMessages(true);
    try {
      const res = await fetch('/api/messages');
      const data = (await res.json().catch(() => null)) as unknown;

      if (!res.ok) {
        console.error('Failed to fetch messages:', data);
        return;
      }

      if (Array.isArray(data)) {
        setMessages(data as Message[]);
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const copyToClipboard = useCallback(async (text: unknown): Promise<boolean> => {
    const value = typeof text === 'string' ? text : '';
    if (!value) return false;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch {
      // fall back below
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }, []);

  const handleMessageClick = useCallback(
    async (m: Message) => {
      const key = messageKey(m);
      const ok = await copyToClipboard(m?.text);

      setCopyStatus({ id: key, ok, at: Date.now() });

      if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = window.setTimeout(() => setCopyStatus(null), 1200);
    },
    [copyToClipboard, messageKey],
  );

  const handleSendMessage = useCallback(
    async (payload: ChatSendPayload) => {
      const hasFiles = Array.isArray(payload.files) && payload.files.length > 0;

      if (hasFiles) {
        const formData = new FormData();
        payload.files?.forEach((file) => formData.append('file', file));

        const res = await fetch('/api/files/upload', { method: 'POST', body: formData });
        const data = (await res.json().catch(() => null)) as unknown;
        console.log('Files uploaded:', data);
        return;
      }

      const text = 'text' in payload ? payload.text : '';
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const data = (await res.json().catch(() => null)) as PostMessageResponse;

      if (!res.ok) {
        console.error('Message send failed:', data);
        return;
      }

      // expected: { data: savedMessage }
      const saved = !Array.isArray(data) && data && typeof data === 'object' ? (data as any).data : null;

      if (saved && typeof saved.text === 'string') {
        setMessages((prev) => [...prev, saved]);
      } else {
        // fallback: refetch if API shape differs
        fetchMessages();
      }
    },
    [fetchMessages],
  );

  const handleDeleteMessage = useCallback(
    async (m: Message, e?: React.MouseEvent<HTMLButtonElement>) => {
      e?.stopPropagation();
      e?.preventDefault();

      if (!m?.id) {
        alert('Cannot delete message: missing id');
        return;
      }

      const confirmed = window.confirm('Delete this message?');
      if (!confirmed) return;

      try {
        const res = await fetch(`/api/messages/${encodeURIComponent(m.id)}`, { method: 'DELETE' });
        const data = (await res.json().catch(() => null)) as { error?: string } | null;

        if (!res.ok) {
          console.error('Failed to delete message:', data);
          alert(data?.error || 'Failed to delete message');
          return;
        }

        setMessages((prev) => prev.filter((x) => x?.id !== m.id));
      } catch (err) {
        console.error('Failed to delete message:', err);
        alert('Failed to delete message');
      }
    },
    [],
  );

  const statusText = useMemo(() => {
    if (!copyStatus) return null;
    return copyStatus.ok ? 'Copied' : 'Copy failed';
  }, [copyStatus]);

  const statusClass = useMemo(() => {
    if (!copyStatus) return '';
    return copyStatus.ok ? 'text-emerald-600' : 'text-red-600';
  }, [copyStatus]);

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="pt-2">
        <div className="sticky top-2 flex items-center gap-2">
          <strong className="text-slate-900 dark:text-slate-100">Messages</strong>

          <button
            type="button"
            onClick={fetchMessages}
            title="Refresh messages"
            className="grid h-8 w-8 place-items-center rounded-full text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
          >
            <FontAwesomeIcon icon={faArrowsRotate}/>
          </button>

          {isLoadingMessages && <span className="text-slate-500 text-sm">Loading…</span>}

          {copyStatus && <span className={`ml-2 text-xs ${statusClass}`}>{statusText}</span>}
        </div>

        {messages.length === 0 && !isLoadingMessages ? (
          <div className="text-slate-500 pt-2 text-sm">No messages yet.</div>
        ) : (
          <div className="pt-2 gap-2 flex flex-col overflow-y-auto h-full">
            {messages.map((m) => {
              const key = messageKey(m);
              const recentlyCopied = copyStatus?.id === key && copyStatus?.ok;

              return (
                <div
                  key={key}
                  className={[
                    'group w-full rounded-lg border px-3 py-2 transition',
                    'border-slate-200 bg-white hover:bg-slate-50',
                    'dark:border-white/10 dark:bg-zinc-800 dark:hover:bg-white/5',
                    recentlyCopied ? 'ring-1 ring-emerald-400/60 bg-emerald-50 dark:bg-emerald-950/30' : '',
                  ].join(' ')}
                >
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => handleMessageClick(m)}
                      title="Click to copy"
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="whitespace-pre-wrap text-slate-900 dark:text-slate-100">{m?.text ?? ''}</div>
                      {m?.createdAt && <div className="mt-1 text-xs text-slate-500">{m.createdAt}</div>}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteMessage(m, e)}
                      title="Delete message"
                      className="grid h-8 w-8 flex-none place-items-center rounded-full text-red-600 opacity-100 transition-opacity hover:bg-red-50 dark:hover:bg-red-500/10 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
                    >
                      <FontAwesomeIcon icon={faXmark} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="sticky bottom-2 z-10 border-t border-slate-200 dark:border-white/0 py-2">
        <ChatInput onSend={handleSendMessage} />
      </div>
    </div>
  );
}
