import { useEffect, useRef, useState } from 'react';


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
        // cleanup any created preview URLs to avoid leaks
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
          // if duplicate, cleanup created preview URL to avoid leaks
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

    // keep text untouched; input is disabled while files exist (your current behavior)
    // allow choosing the same files again later
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
      ? `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} selected${selectedFiles.length >= MAX_FILES ? ' (max)' : ''}`
      : text;

  return (
    <div className="chat-input-container">
      {selectedFiles.length > 0 && (
        <div className="file-previews">
          {selectedFiles.map(({ id, file, previewUrl }) => (
            <div className="file-tile" key={id} title={file.name}>
              {previewUrl ? (
                <img className="file-thumb" src={previewUrl} alt={file.name}/>
              ) : (
                <div className="file-generic">
                  <div className="file-ext">
                    {(file.name.split('.').pop() || 'FILE').toUpperCase()}
                  </div>
                  <div className="file-name">{file.name}</div>
                </div>
              )}

              <button
                type="button"
                className="file-remove-btn"
                onClick={() => removeFile(id)}
                aria-label={`Remove ${file.name}`}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="chat-input-wrapper">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        <button
          className="icon-btn left"
          onClick={handleFileButton}
          type="button"
          disabled={selectedFiles.length >= MAX_FILES}
          title={selectedFiles.length >= MAX_FILES ? `Max ${MAX_FILES} files` : 'Attach files'}
        >
          <i className="fa-solid fa-paperclip"></i>
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
        />

        {selectedFiles.length > 0 && (
          <button className="icon-btn" onClick={resetFiles} type="button" title="Clear all files">
            <i className="fa-solid fa-xmark"></i>
          </button>
        )}

        <button className="icon-btn right" onClick={handleSend} type="button">
          <i className="fa-solid fa-paper-plane"></i>
        </button>
      </div>
    </div>
  );
}
