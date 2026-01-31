'use client';
import { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperclip, faPaperPlane, faXmark } from '@fortawesome/free-solid-svg-icons';
import { Image } from 'next/dist/client/image-component';


export type ChatSendPayload =
  | { text: string; files?: never }
  | { files: File[]; text?: never };

export interface ChatInputProps {
  onSend?: (payload: ChatSendPayload) => void;
}

type SelectedFileEntry = {
  id: string;
  file: File;
  key: string;
  previewUrl: string | null;
};

export function ChatInput({ onSend }: ChatInputProps) {
  const MAX_FILES = 20;

  const [text, setText] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<SelectedFileEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isImageFile = (file: File): boolean => file.type?.startsWith('image/') ?? false;

  const makeId = (file: File): string =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(16).slice(2)}`;

  const fileKey = (file: File): string => `${file.name}__${file.size}__${file.lastModified}`;

  const revokeAllPreviews = (entries: SelectedFileEntry[]): void => {
    entries.forEach((x) => {
      if (x.previewUrl) URL.revokeObjectURL(x.previewUrl);
    });
  };

  // Prevent object-URL leaks if the user navigates away with previews still allocated.
  // Use a ref so unmount cleanup always sees the latest entries.
  const selectedFilesRef = useRef<SelectedFileEntry[]>([]);
  useEffect(() => {
    selectedFilesRef.current = selectedFiles;
  }, [selectedFiles]);

  useEffect(() => {
    return () => {
      revokeAllPreviews(selectedFilesRef.current);
    };
  }, []);

  const handleSend = (): void => {
    if (selectedFiles.length > 0) {
      onSend?.({ files: selectedFiles.map((x) => x.file) });

      revokeAllPreviews(selectedFiles);
      setSelectedFiles([]);
      setText('');
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) return;

    onSend?.({ text: trimmed });
    setText('');
  };

  const handleFileButton = (): void => {
    if (selectedFiles.length >= MAX_FILES) {
      alert(`Maximum of ${MAX_FILES} files can be attached.`);
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const files = Array.from(e.currentTarget.files ?? []);
    if (files.length === 0) return;

    const newEntries: SelectedFileEntry[] = files.map((file) => ({
      id: makeId(file),
      file,
      key: fileKey(file),
      previewUrl: isImageFile(file) ? URL.createObjectURL(file) : null,
    }));

    // APPEND (do not reset) + DEDUPE by key + LIMIT to MAX_FILES
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
  };

  const handleInputChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    // If user starts typing, treat that as switching back to text mode
    if (selectedFiles.length > 0) {
      revokeAllPreviews(selectedFiles);
      setSelectedFiles([]);
    }
    setText(e.currentTarget.value);
  };

  const resetFiles = (): void => {
    revokeAllPreviews(selectedFiles);
    setSelectedFiles([]);
  };

  const removeFile = (id: string): void => {
    setSelectedFiles((prev) => {
      const removed = prev.find((x) => x.id === id);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
  };

  const label =
    selectedFiles.length > 0
      ? `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} selected${
        selectedFiles.length >= MAX_FILES ? ' (max)' : ''
      }`
      : text;

  const canAttachMore = selectedFiles.length < MAX_FILES;

  return (
    <div className="w-full">
      {selectedFiles.length > 0 && (
        <div className="flex gap-2 px-2 pt-2 overflow-x-auto">
          {selectedFiles.map(({ id, file, previewUrl }) => (
            <div
              key={id}
              title={file.name}
              className="relative h-24 w-24 flex-none overflow-hidden rounded-xl border border-black/10 bg-white"
            >
              {previewUrl ? (
                <Image className="h-full w-full object-cover block" src={previewUrl} alt={file.name}/>
              ) : (
                <div className="h-full w-full p-2 flex flex-col justify-between">
                  <div className="text-[12px] font-bold opacity-75">
                    {(file.name.split('.').pop() || 'FILE').toUpperCase()}
                  </div>
                  <div className="text-[11px] leading-[1.2] overflow-hidden text-ellipsis">
                    {file.name}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => removeFile(id)}
                aria-label={`Remove ${file.name}`}
                className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/55 text-white hover:bg-black/75"
              >
                <FontAwesomeIcon icon={faXmark}/>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="w-full flex items-center gap-2 rounded-full bg-[#2f2f2f] px-2 py-2">
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange}/>

        <button
          type="button"
          onClick={handleFileButton}
          disabled={!canAttachMore}
          title={!canAttachMore ? `Max ${MAX_FILES} files` : 'Attach files'}
          className="grid h-7 w-7 place-items-center rounded-full text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <FontAwesomeIcon icon={faPaperclip}/>
        </button>

        <input
          type="text"
          placeholder="Ask anything"
          value={label}
          disabled={selectedFiles.length > 0}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            const native = e.nativeEvent as unknown as { isComposing?: boolean };
            if (e.key === 'Enter' && !native.isComposing) {
              handleSend();
            }
          }}
          className="flex-1 bg-transparent outline-none border-none text-white text-[16px] placeholder:text-[#9a9a9a] disabled:cursor-not-allowed disabled:opacity-80"
        />

        {selectedFiles.length > 0 && (
          <button
            type="button"
            onClick={resetFiles}
            title="Clear all files"
            className="grid h-7 w-7 place-items-center rounded-full text-white hover:bg-white/10"
          >
            <FontAwesomeIcon icon={faXmark}/>
          </button>
        )}

        <button
          type="button"
          onClick={handleSend}
          title="Send"
          className="grid h-7 w-7 place-items-center rounded-full bg-white text-black hover:bg-[#e5e5e5]"
        >
          <FontAwesomeIcon icon={faPaperPlane}/>
        </button>
      </div>
    </div>
  );
}
