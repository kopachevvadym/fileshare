'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChatInput, type ChatSendPayload } from '@/components/app/ChatInput/ChatInput';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowsRotate, faFloppyDisk, faPenToSquare, faXmark, faFile, faFileImage, faFilePdf, faFileLines, faFileZipper, faFileAudio, faFileVideo } from '@fortawesome/free-solid-svg-icons';

type MessageFile = {
  originalName: string;
  filename: string;
  size: number;
  mimetype: string;
  url: string;
};

type Message = {
  id?: string;
  text?: string;
  createdAt?: string;
  note?: string;
  files?: MessageFile[];
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

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [noteEditingId, setNoteEditingId] = useState<string | null>(null);
  const [noteDraftText, setNoteDraftText] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  const [contextMenu, setContextMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    message: Message | null;
  }>({ open: false, x: 0, y: 0, message: null });

  const copyTimeoutRef = useRef<number | null>(null);
  const contextCloseTimeoutRef = useRef<number | null>(null);

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
      if (contextCloseTimeoutRef.current) window.clearTimeout(contextCloseTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!contextMenu.open) return;

    const onDoc = () => setContextMenu((s) => ({ ...s, open: false, message: null }));
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu((s) => ({ ...s, open: false, message: null }));
    };

    document.addEventListener('click', onDoc);
    document.addEventListener('contextmenu', onDoc);
    document.addEventListener('keydown', onEsc);

    return () => {
      document.removeEventListener('click', onDoc);
      document.removeEventListener('contextmenu', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [contextMenu.open]);

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

  const isFileMessage = useCallback((m: Message): boolean => {
    return Array.isArray(m?.files) && m.files.length > 0;
  }, []);

  const openFileMessage = useCallback((m: Message): void => {
    const file = Array.isArray(m?.files) ? m.files[0] : null;
    const url = file?.url;

    if (!url) {
      alert('File URL missing');
      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const handleMessageClick = useCallback(
    async (m: Message) => {
      if (isFileMessage(m)) {
        openFileMessage(m);
        return;
      }

      const key = messageKey(m);
      const ok = await copyToClipboard(m?.text);

      setCopyStatus({ id: key, ok, at: Date.now() });

      if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = window.setTimeout(() => setCopyStatus(null), 1200);
    },
    [copyToClipboard, isFileMessage, messageKey, openFileMessage],
  );

  const handleSendMessage = useCallback(
    async (payload: ChatSendPayload) => {
      const hasFiles = Array.isArray(payload.files) && payload.files.length > 0;

      if (hasFiles) {
        const formData = new FormData();
        payload.files?.forEach((file) => formData.append('file', file));

        const res = await fetch('/api/messages/upload', { method: 'POST', body: formData });
        const data = (await res.json().catch(() => null)) as PostMessageResponse;

        if (!res.ok) {
          console.error('Files upload failed:', data);
          return;
        }

        const saved = !Array.isArray(data) && data && typeof data === 'object' ? (data as any).data : null;

        if (saved && (typeof saved.text === 'string' || Array.isArray((saved as any).files))) {
          setMessages((prev) => [...prev, saved]);
        } else {
          fetchMessages();
        }

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

        // if we deleted the message being edited, reset edit state
        setEditingId((cur) => (cur === m.id ? null : cur));
      } catch (err) {
        console.error('Failed to delete message:', err);
        alert('Failed to delete message');
      }
    },
    [],
  );

  const beginEdit = useCallback(
    (m: Message, e?: React.MouseEvent<HTMLButtonElement>) => {
      e?.stopPropagation();
      e?.preventDefault();

      if (!m?.id) {
        alert('Cannot edit message: missing id');
        return;
      }

      setEditingId(m.id);
      setDraftText(m?.text ?? '');
    },
    [],
  );

  const cancelEdit = useCallback((e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.stopPropagation();
    e?.preventDefault();
    setEditingId(null);
    setDraftText('');
  }, []);

  const saveEdit = useCallback(
    async (m: Message, e?: React.MouseEvent<HTMLButtonElement>) => {
      e?.stopPropagation();
      e?.preventDefault();

      if (!m?.id) {
        alert('Cannot edit message: missing id');
        return;
      }

      const nextText = draftText.trim();
      if (!nextText) {
        alert('Message text is required');
        return;
      }

      setIsSavingEdit(true);
      try {
        const res = await fetch(`/api/messages/${encodeURIComponent(m.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: nextText }),
        });

        const data = (await res.json().catch(() => null)) as
          | { data?: Message; error?: string }
          | null;

        if (!res.ok) {
          console.error('Failed to update message:', data);
          alert((data && typeof data === 'object' && 'error' in data && (data as any).error) || 'Failed to update');
          return;
        }

        const updated = data && typeof data === 'object' ? (data as any).data : null;

        if (updated && String(updated?.id) === String(m.id)) {
          setMessages((prev) =>
            prev.map((x) => (String(x?.id) === String(m.id) ? { ...x, ...updated } : x)),
          );
        } else {
          // fallback
          setMessages((prev) =>
            prev.map((x) => (String(x?.id) === String(m.id) ? { ...x, text: nextText } : x)),
          );
        }

        setEditingId(null);
        setDraftText('');
      } catch (err) {
        console.error('Failed to update message:', err);
        alert('Failed to update message');
      } finally {
        setIsSavingEdit(false);
      }
    },
    [draftText],
  );

  const beginNoteEdit = useCallback((m: Message) => {
    if (!m?.id) {
      alert('Cannot add note: missing id');
      return;
    }
    setNoteEditingId(String(m.id));
    setNoteDraftText(m?.note ?? '');
  }, []);

  const cancelNoteEdit = useCallback(() => {
    setNoteEditingId(null);
    setNoteDraftText('');
  }, []);

  const saveNote = useCallback(
    async (m: Message) => {
      if (!m?.id) {
        alert('Cannot add note: missing id');
        return;
      }

      const trimmed = noteDraftText.trim();

      setIsSavingNote(true);
      try {
        const res = await fetch(`/api/messages/${encodeURIComponent(String(m.id))}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note: trimmed }),
        });

        const data = (await res.json().catch(() => null)) as { data?: Message; error?: string } | null;

        if (!res.ok) {
          console.error('Failed to update note:', data);
          alert(data?.error || 'Failed to update note');
          return;
        }

        const updated = data && typeof data === 'object' ? (data as any).data : null;

        if (updated && String(updated?.id) === String(m.id)) {
          setMessages((prev) =>
            prev.map((x) => (String(x?.id) === String(m.id) ? { ...x, ...updated } : x)),
          );
        } else {
          setMessages((prev) =>
            prev.map((x) => {
              if (String(x?.id) !== String(m.id)) return x;
              if (!trimmed) {
                const next = { ...x } as any;
                delete next.note;
                return next;
              }
              return { ...x, note: trimmed };
            }),
          );
        }

        setNoteEditingId(null);
        setNoteDraftText('');
      } catch (err) {
        console.error('Failed to update note:', err);
        alert('Failed to update note');
      } finally {
        setIsSavingNote(false);
      }
    },
    [noteDraftText],
  );

  const openContextMenu = useCallback(
    (e: React.MouseEvent, m: Message) => {
      e.preventDefault();
      e.stopPropagation();

      const x = e.clientX;
      const y = e.clientY;

      setContextMenu({ open: true, x, y, message: m });

      if (contextCloseTimeoutRef.current) window.clearTimeout(contextCloseTimeoutRef.current);
      contextCloseTimeoutRef.current = window.setTimeout(() => {
        setContextMenu((s) => ({ ...s, open: false, message: null }));
      }, 6000);
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
          {isLoadingMessages && <span className="text-slate-500 text-sm">Loading…</span>}

          {copyStatus && <span className={`ml-2 text-xs ${statusClass}`}>{statusText}</span>}
        </div>

        {contextMenu.open && contextMenu.message ? (
          <div
            className="fixed z-50 min-w-44 rounded-md border border-slate-200 bg-white p-1 text-sm shadow-lg dark:border-white/10 dark:bg-zinc-900"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            role="menu"
          >
            <button
              type="button"
              className="w-full rounded px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-white/10"
              onClick={() => {
                const msg = contextMenu.message!;
                setContextMenu((s) => ({ ...s, open: false, message: null }));
                beginNoteEdit(msg);
              }}
            >
              {(contextMenu.message?.note ?? '').trim() ? 'Edit note' : 'Add note'}
            </button>
          </div>
        ) : null}

        {messages.length === 0 && !isLoadingMessages ? (
          <div className="text-slate-500 pt-2 text-sm">No messages yet.</div>
        ) : (
          <div className="pt-2 gap-2 flex flex-col overflow-y-auto h-full">
            {messages.map((m) => {
              const key = messageKey(m);
              const recentlyCopied = copyStatus?.id === key && copyStatus?.ok;
              const isEditing = Boolean(editingId && m?.id && String(editingId) === String(m.id));
              const isNoteEditing = Boolean(noteEditingId && m?.id && String(noteEditingId) === String(m.id));
              const isFile = isFileMessage(m);

              return (
                <div
                  key={key}
                  onContextMenu={(e) => openContextMenu(e, m)}
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
                      onClick={() => !isEditing && !isNoteEditing && handleMessageClick(m)}
                      title={
                        isEditing || isNoteEditing
                          ? undefined
                          : isFile
                            ? 'Click to open'
                            : 'Click to copy'
                      }
                      className="flex-1 min-w-0 text-left"
                      disabled={isEditing || isNoteEditing}
                    >
                      {isEditing ? (
                        <div className="flex flex-col gap-2">
                          <textarea
                            className="w-full min-h-18 resize-y rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-slate-300 dark:border-white/10 dark:bg-zinc-900 dark:text-slate-100"
                            value={draftText}
                            onChange={(e) => setDraftText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                cancelEdit();
                              }
                              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                                void saveEdit(m);
                              }
                            }}
                          />
                          <div className="text-xs text-slate-500">Esc to cancel  Cmd/Ctrl+Enter to save</div>
                        </div>
                      ) : isNoteEditing ? (
                        <div className="flex flex-col gap-2">
                          <div className="text-xs text-slate-500">Note</div>
                          <textarea
                            className="w-full min-h-16 resize-y rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-slate-300 dark:border-white/10 dark:bg-zinc-900 dark:text-slate-100"
                            value={noteDraftText}
                            placeholder="Type a note…"
                            onChange={(e) => setNoteDraftText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') cancelNoteEdit();
                              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                                void saveNote(m);
                              }
                            }}
                          />
                          <div className="text-xs text-slate-500">Esc to cancel  Cmd/Ctrl+Enter to save  (empty saves deletes note)</div>
                        </div>
                      ) : (
                        <>
                          {Array.isArray(m?.files) && m.files.length > 0 ? null : (
                            <div className="whitespace-pre-wrap text-slate-900 dark:text-slate-100">{m?.text ?? ''}</div>
                          )}

                          {Array.isArray(m?.files) && m.files.length > 0 ? (
                            <div className="mt-2 flex flex-col gap-1">
                              {m.files.map((f) => (
                                <a
                                  key={f.filename}
                                  href={f.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-700 underline underline-offset-2 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-200"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span className="mr-2 inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold tracking-wide text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                                    <FontAwesomeIcon icon={fileTypeIcon(f).icon} className="text-[11px]" />
                                    {fileTypeIcon(f).label}
                                  </span>
                                  {f.originalName || f.filename}
                                </a>
                              ))}
                            </div>
                          ) : null}

                          {(m?.note ?? '').trim() ? (
                            <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                              <div className="whitespace-pre-wrap">{m.note}</div>
                            </div>
                          ) : null}
                          {m?.createdAt && <div className="mt-1 text-xs text-slate-500">{m.createdAt}</div>}
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-1">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={(e) => saveEdit(m, e)}
                            title="Save"
                            disabled={isSavingEdit}
                            className="grid h-8 w-8 flex-none place-items-center rounded-full text-slate-700 opacity-100 transition-opacity hover:bg-slate-100 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-white/10 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
                          >
                            <FontAwesomeIcon icon={isSavingEdit ? faArrowsRotate : faFloppyDisk} spin={isSavingEdit} />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => cancelEdit(e)}
                            title="Cancel"
                            disabled={isSavingEdit}
                            className="grid h-8 w-8 flex-none place-items-center rounded-full text-slate-700 opacity-100 transition-opacity hover:bg-slate-100 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-white/10 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
                          >
                            <FontAwesomeIcon icon={faXmark} />
                          </button>
                        </>
                      ) : isNoteEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void saveNote(m)}
                            title="Save note"
                            disabled={isSavingNote}
                            className="grid h-8 w-8 flex-none place-items-center rounded-full text-slate-700 opacity-100 transition-opacity hover:bg-slate-100 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-white/10 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
                          >
                            <FontAwesomeIcon icon={isSavingNote ? faArrowsRotate : faFloppyDisk} spin={isSavingNote} />
                          </button>

                          <button
                            type="button"
                            onClick={() => cancelNoteEdit()}
                            title="Cancel"
                            disabled={isSavingNote}
                            className="grid h-8 w-8 flex-none place-items-center rounded-full text-slate-700 opacity-100 transition-opacity hover:bg-slate-100 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-white/10 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
                          >
                            <FontAwesomeIcon icon={faXmark} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={(e) => beginEdit(m, e)}
                            title="Edit message"
                            className="grid h-8 w-8 flex-none place-items-center rounded-full text-slate-700 opacity-100 transition-opacity hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
                          >
                            <FontAwesomeIcon icon={faPenToSquare} />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleDeleteMessage(m, e)}
                            title="Delete message"
                            className="grid h-8 w-8 flex-none place-items-center rounded-full text-red-600 opacity-100 transition-opacity hover:bg-red-50 dark:hover:bg-red-500/10 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
                          >
                            <FontAwesomeIcon icon={faXmark} />
                          </button>
                        </>
                      )}
                    </div>
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

function guessExt(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : '';
}

function fileTypeIcon(f: MessageFile) {
  const mime = (f.mimetype || '').toLowerCase();
  const ext = guessExt(f.originalName || f.filename);

  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
    return { icon: faFileImage, label: 'IMG' };
  }

  if (mime === 'application/pdf' || ext === 'pdf') {
    return { icon: faFilePdf, label: 'PDF' };
  }

  if (
    mime.startsWith('text/') ||
    ['txt', 'md', 'log', 'csv', 'json', 'xml', 'yaml', 'yml', 'ts', 'tsx', 'js', 'jsx', 'css', 'html'].includes(ext)
  ) {
    return { icon: faFileLines, label: 'TXT' };
  }

  if (mime.includes('zip') || ['zip', 'rar', '7z', 'gz', 'tar'].includes(ext)) {
    return { icon: faFileZipper, label: 'ZIP' };
  }

  if (mime.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'ogg'].includes(ext)) {
    return { icon: faFileAudio, label: 'AUD' };
  }

  if (mime.startsWith('video/') || ['mp4', 'mov', 'mkv', 'webm'].includes(ext)) {
    return { icon: faFileVideo, label: 'VID' };
  }

  return { icon: faFile, label: 'FILE' };
}
