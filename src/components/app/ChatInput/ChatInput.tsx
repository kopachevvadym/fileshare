'use client';

import Image from 'next/image';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperclip, faPaperPlane, faXmark } from '@fortawesome/free-solid-svg-icons';

export type ChatSendPayload =
  | { text: string; files?: never }
  | { files: File[]; text?: never };

export interface ChatInputProps {
  onSend?: (payload: ChatSendPayload) => void | Promise<void>;
}

type SelectedFileEntry = {
  id: string;
  file: File;
  key: string;
  previewUrl: string | null;
};

const MAX_FILES = 20;

function isImageFile(file: File): boolean {
  return file.type?.startsWith('image/') ?? false;
}

function makeId(file: File): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(16).slice(2)}`;
}

function fileKey(file: File): string {
  return `${file.name}__${file.size}__${file.lastModified}`;
}

function revokeAllPreviews(entries: SelectedFileEntry[]): void {
  entries.forEach((x) => {
    if (x.previewUrl) URL.revokeObjectURL(x.previewUrl);
  });
}

/** Memoized preview strip: does NOT rerender when typing */
const FilePreviews = React.memo(function FilePreviews({
                                                        files,
                                                        onRemove,
                                                      }: {
  files: SelectedFileEntry[];
  onRemove: (id: string) => void;
}) {
  if (files.length === 0) return null;

  return (
    <div className="flex gap-2 px-2 pt-2 overflow-x-auto">
      {files.map(({ id, file, previewUrl }) => (
        <div
          key={id}
          title={file.name}
          className="relative h-24 w-24 flex-none overflow-hidden rounded-xl border border-black/10 bg-white"
        >
          {previewUrl ? (
            <Image className="object-cover" src={previewUrl} alt={file.name} fill sizes="96px"/>
          ) : (
            <div className="h-full w-full p-2 flex flex-col justify-between">
              <div className="text-[12px] font-bold opacity-75">
                {(file.name.split('.').pop() || 'FILE').toUpperCase()}
              </div>
              <div className="text-[11px] leading-[1.2] overflow-hidden text-ellipsis">{file.name}</div>
            </div>
          )}

          <button
            type="button"
            onClick={() => onRemove(id)}
            aria-label={`Remove ${file.name}`}
            className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/55 text-white hover:bg-black/75"
          >
            <FontAwesomeIcon icon={faXmark}/>
          </button>
        </div>
      ))}
    </div>
  );
});

export function ChatInput({ onSend }: ChatInputProps) {
  const [text, setText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<SelectedFileEntry[]>([]);
  const [isSending, setIsSending] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Send lock: prevents double-send from Enter + click, or rapid taps
  const sendingRef = useRef(false);

  // Keep latest selectedFiles for unmount cleanup without extra effects/rerenders
  const selectedFilesRef = useRef<SelectedFileEntry[]>([]);
  useEffect(() => {
    selectedFilesRef.current = selectedFiles;
  }, [selectedFiles]);

  useEffect(() => {
    return () => revokeAllPreviews(selectedFilesRef.current);
  }, []);

  const canAttachMore = selectedFiles.length < MAX_FILES;

  const filesLabel = useMemo(() => {
    if (selectedFiles.length === 0) return null;
    return `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} selected${
      selectedFiles.length >= MAX_FILES ? ' (max)' : ''
    }`;
  }, [selectedFiles.length]);

  const hasSomethingToSend = useMemo(() => {
    if (selectedFiles.length > 0) return true;
    return text.trim().length > 0;
  }, [selectedFiles.length, text]);

  const handleSend = useCallback(async (): Promise<void> => {
    if (!onSend) return;
    if (sendingRef.current) return; // ✅ hard lock
    if (!hasSomethingToSend) return;

    sendingRef.current = true;
    setIsSending(true);

    try {
      if (selectedFilesRef.current.length > 0) {
        const files = selectedFilesRef.current.map((x) => x.file);

        await onSend({ files });

        revokeAllPreviews(selectedFilesRef.current);
        setSelectedFiles([]);
        setText('');
        return;
      }

      const trimmed = text.trim();
      if (!trimmed) return;

      await onSend({ text: trimmed });
      setText('');
    } finally {
      // small microtask gap prevents Enter+click in same frame from re-entering
      queueMicrotask(() => {
        sendingRef.current = false;
      });
      setIsSending(false);
    }
  }, [onSend, hasSomethingToSend, text]);

  const handleFileButton = useCallback((): void => {
    if (isSending) return;
    if (selectedFilesRef.current.length >= MAX_FILES) {
      alert(`Maximum of ${MAX_FILES} files can be attached.`);
      return;
    }
    fileInputRef.current?.click();
  }, [isSending]);

  const handleFileChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>((e) => {
    const files = Array.from(e.currentTarget.files ?? []);
    if (files.length === 0) return;

    const newEntries: SelectedFileEntry[] = files.map((file) => ({
      id: makeId(file),
      file,
      key: fileKey(file),
      previewUrl: isImageFile(file) ? URL.createObjectURL(file) : null,
    }));

    setSelectedFiles((prev) => {
      if (prev.length >= MAX_FILES) {
        revokeAllPreviews(newEntries);
        return prev;
      }

      const existingKeys = new Set(prev.map((x) => x.key));
      const filtered: SelectedFileEntry[] = [];
      let remaining = MAX_FILES - prev.length;

      for (const entry of newEntries) {
        if (remaining <= 0) {
          if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
          continue;
        }
        if (!existingKeys.has(entry.key)) {
          filtered.push(entry);
          existingKeys.add(entry.key);
          remaining -= 1;
        } else {
          if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
        }
      }

      if (newEntries.length >= MAX_FILES) {
        alert(
          `Maximum of ${MAX_FILES} files can be attached. Some files were not added due to duplication or limit.`,
        );
      }

      return [...prev, ...filtered];
    });

    e.currentTarget.value = '';
  }, []);

  const handleInputChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      if (isSending) return;

      // If user starts typing, switch back to text mode
      if (selectedFilesRef.current.length > 0) {
        revokeAllPreviews(selectedFilesRef.current);
        setSelectedFiles([]);
      }
      setText(e.currentTarget.value);
    },
    [isSending],
  );

  const resetFiles = useCallback((): void => {
    if (isSending) return;
    revokeAllPreviews(selectedFilesRef.current);
    setSelectedFiles([]);
  }, [isSending]);

  const removeFile = useCallback((id: string): void => {
    setSelectedFiles((prev) => {
      const removed = prev.find((x) => x.id === id);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
  }, []);

  const onKeyDown = useCallback<React.KeyboardEventHandler<HTMLInputElement>>(
    (e) => {
      const native = e.nativeEvent as unknown as { isComposing?: boolean };
      if (e.key === 'Enter' && !native.isComposing) {
        e.preventDefault(); // ✅ prevent accidental double actions
        void handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="w-full">
      <FilePreviews files={selectedFiles} onRemove={removeFile}/>

      {/* Optional files label row */}
      {filesLabel && <div className="px-3 pt-2 text-xs text-white/70">{filesLabel}</div>}

      <div className="w-full flex items-center gap-2 rounded-full bg-[#2f2f2f] px-2 py-2">
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange}/>

        <button
          type="button"
          onClick={handleFileButton}
          disabled={!canAttachMore || isSending}
          title={!canAttachMore ? `Max ${MAX_FILES} files` : 'Attach files'}
          className="grid h-7 w-7 place-items-center rounded-full text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <FontAwesomeIcon icon={faPaperclip}/>
        </button>

        <input
          type="text"
          placeholder="Ask anything"
          value={text} // ✅ controlled by text only
          disabled={selectedFiles.length > 0 || isSending}
          onChange={handleInputChange}
          onKeyDown={onKeyDown}
          className="flex-1 bg-transparent outline-none border-none text-white text-[16px] placeholder:text-[#9a9a9a] disabled:cursor-not-allowed disabled:opacity-80"
        />

        {selectedFiles.length > 0 && (
          <button
            type="button"
            onClick={resetFiles}
            disabled={isSending}
            title="Clear all files"
            className="grid h-7 w-7 place-items-center rounded-full text-white hover:bg-white/10 disabled:opacity-40"
          >
            <FontAwesomeIcon icon={faXmark}/>
          </button>
        )}

        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!hasSomethingToSend || isSending}
          title="Send"
          className="grid h-7 w-7 place-items-center rounded-full bg-white text-black hover:bg-[#e5e5e5] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FontAwesomeIcon icon={faPaperPlane}/>
        </button>
      </div>
    </div>
  );
}
