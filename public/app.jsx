// React and ReactDOM are loaded as globals via script tags in index.html.
// Do not redeclare them (e.g. `const React = React;`) or it breaks in strict mode.


function ChatInput({onSend}) {
    const MAX_FILES = 20;

    const [text, setText] = React.useState("");
    const [selectedFiles, setSelectedFiles] = React.useState([]); // [{ id, file, previewUrl }]
    const fileInputRef = React.useRef(null);

    const isImageFile = (file) => file?.type?.startsWith("image/");

    const makeId = (file) =>
        (typeof crypto !== "undefined" && crypto.randomUUID)
            ? crypto.randomUUID()
            : `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(16).slice(2)}`;

    const fileKey = (file) => `${file.name}__${file.size}__${file.lastModified}`;

    const handleSend = () => {
        if (selectedFiles.length > 0) {
            onSend?.({files: selectedFiles.map((x) => x.file)});

            selectedFiles.forEach((x) => x.previewUrl && URL.revokeObjectURL(x.previewUrl));
            setSelectedFiles([]);
            setText("");
            return;
        }

        if (!text.trim()) return;
        onSend?.({text: text.trim()});
        setText("");
    };

    const handleFileButton = () => {
        if (selectedFiles.length >= MAX_FILES) {

            alert(`Maximum of ${MAX_FILES} files can be attached.`);
            return;
        }
        fileInputRef.current?.click();
    };

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const newEntries = files.map((file) => ({
            id: makeId(file),
            file,
            key: fileKey(file),
            previewUrl: isImageFile(file) ? URL.createObjectURL(file) : null,
        }));

        // APPEND (do not reset) + DEDUPE by key + LIMIT to MAX_FILES
        setSelectedFiles((prev) => {
            if (prev.length >= MAX_FILES) {
                // cleanup any created preview URLs to avoid leaks
                newEntries.forEach((entry) => entry.previewUrl && URL.revokeObjectURL(entry.previewUrl));
                return prev;
            }

            const existingKeys = new Set(prev.map((x) => x.key));
            const filtered = [];
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
                alert(`Maximum of ${MAX_FILES} files can be attached. Some files were not added due to duplication or limit.`);
            }

            return [...prev, ...filtered];
        });

        // keep text untouched; input is disabled while files exist (your current behavior)
        // allow choosing the same files again later
        e.target.value = "";
    };

    const handleInputChange = (e) => {
        // If user starts typing, treat that as switching back to text mode
        if (selectedFiles.length > 0) {
            selectedFiles.forEach((x) => x.previewUrl && URL.revokeObjectURL(x.previewUrl));
            setSelectedFiles([]);
        }
        setText(e.target.value);
    };

    const resetFiles = () => {
        selectedFiles.forEach((x) => x.previewUrl && URL.revokeObjectURL(x.previewUrl));
        setSelectedFiles([]);
    };

    const removeFile = (id) => {
        setSelectedFiles((prev) => {
            const removed = prev.find((x) => x.id === id);
            if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
            return prev.filter((x) => x.id !== id);
        });
    };

    const label = selectedFiles.length > 0
        ? `${selectedFiles.length} file${selectedFiles.length > 1 ? "s" : ""} selected${selectedFiles.length >= MAX_FILES ? " (max)" : ""}`
        : text;

    return (
        <div className="chat-input-container">
            {selectedFiles.length > 0 && (
                <div className="file-previews">
                    {selectedFiles.map(({id, file, previewUrl}) => (
                        <div className="file-tile" key={id} title={file.name}>
                            {previewUrl ? (
                                <img className="file-thumb" src={previewUrl} alt={file.name}/>
                            ) : (
                                <div className="file-generic">
                                    <div className="file-ext">
                                        {(file.name.split(".").pop() || "FILE").toUpperCase()}
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
                    style={{display: "none"}}
                    onChange={handleFileChange}
                />

                <button
                    className="icon-btn left"
                    onClick={handleFileButton}
                    type="button"
                    disabled={selectedFiles.length >= MAX_FILES}
                    title={selectedFiles.length >= MAX_FILES ? `Max ${MAX_FILES} files` : "Attach files"}
                >
                    <i className="fa-solid fa-paperclip"></i>
                </button>

                <input
                    type="text"
                    placeholder="Ask anything"
                    value={label}
                    disabled={selectedFiles.length > 0}
                    onChange={handleInputChange}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
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


function Messenger() {
    const [messages, setMessages] = React.useState([]);
    const [isLoadingMessages, setIsLoadingMessages] = React.useState(false);
    const [copyStatus, setCopyStatus] = React.useState(null); // { id, ok, at }

    const fetchMessages = async () => {
        setIsLoadingMessages(true);
        try {
            const res = await fetch('/api/messages');
            const data = await res.json().catch(() => null);

            if (!res.ok) {
                console.error('Failed to fetch messages:', data);
                return;
            }

            if (Array.isArray(data)) {
                setMessages(data);
            }
        } catch (err) {
            console.error('Failed to fetch messages:', err);
        } finally {
            setIsLoadingMessages(false);
        }
    };

    React.useEffect(() => {
        fetchMessages();
    }, []);

    const copyToClipboard = async (text) => {
        const value = typeof text === 'string' ? text : '';
        if (!value) return false;

        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(value);
                return true;
            }
        } catch (_) {
            // fall back below
        }

        // Fallback for older browsers
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
        } catch (_) {
            return false;
        }
    };

    const handleMessageClick = async (m) => {
        const ok = await copyToClipboard(m?.text);
        setCopyStatus({ id: m?.id ?? `${m?.createdAt ?? ''}-${m?.text ?? ''}`, ok, at: Date.now() });
        // auto-clear after a moment
        window.setTimeout(() => setCopyStatus(null), 1200);
    };

    const handleSendMessage = async (message) => {
        const hasFiles = Array.isArray(message.files) && message.files.length > 0;

        if (hasFiles) {
            const formData = new FormData();
            // IMPORTANT: field name must match multer middleware: upload.array('file', ...)
            message.files.forEach((file) => formData.append('file', file));

            const res = await fetch('/api/files/upload', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json().catch(() => null);
            console.log('Files uploaded:', data);
            return;
        }

        const res = await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: message.text }),
        });
        const data = await res.json().catch(() => null);

        if (!res.ok) {
            console.error('Message send failed:', data);
            return;
        }

        // Append saved message to list (or refetch if something unexpected)
        const saved = data?.data;
        if (saved && typeof saved.text === 'string') {
            setMessages((prev) => [...prev, saved]);
        } else {
            fetchMessages();
        }
    };

    const handleDeleteMessage = async (m, e) => {
        e?.stopPropagation?.();
        e?.preventDefault?.();

        if (!m?.id) {
            alert('Cannot delete message: missing id');
            return;
        }

        const confirmed = window.confirm('Delete this message?');
        if (!confirmed) return;

        try {
            const res = await fetch(`/api/messages/${encodeURIComponent(m.id)}`, { method: 'DELETE' });
            const data = await res.json().catch(() => null);

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
    };

    return (
        <div className="messenger">
            <div style={{ padding: '8px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong>Messages</strong>
                    <button type="button" className="icon-btn" onClick={fetchMessages} title="Refresh messages">
                        <i className="fa-solid fa-arrows-rotate"></i>
                    </button>
                    {isLoadingMessages && <span style={{ color: '#666' }}>Loading&nbsp;...</span>}
                    {copyStatus && (
                        <span style={{ color: copyStatus.ok ? '#0a7' : '#c00', marginLeft: 8, fontSize: 12 }}>
                            {copyStatus.ok ? 'Copied' : 'Copy failed'}
                        </span>
                    )}
                </div>

                {messages.length === 0 && !isLoadingMessages ? (
                    <div style={{ color: '#666', paddingTop: 6 }}>No messages yet.</div>
                ) : (
                    <div style={{ paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {messages.map((m) => {
                            const key = m?.id ?? `${m?.createdAt ?? ''}-${m?.text ?? ''}`;
                            const recentlyCopied = copyStatus?.id === key;

                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => handleMessageClick(m)}
                                    title="Click to copy"
                                    style={{
                                        textAlign: 'left',
                                        padding: '8px 10px',
                                        border: '1px solid #eee',
                                        borderRadius: 8,
                                        background: recentlyCopied && copyStatus?.ok ? '#f3fffb' : 'white',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ whiteSpace: 'pre-wrap' }}>{m?.text}</div>
                                            {m?.createdAt && (
                                                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{m.createdAt}</div>
                                            )}
                                        </div>

                                        <button
                                            type="button"
                                            className="icon-btn"
                                            onClick={(e) => handleDeleteMessage(m, e)}
                                            title="Delete message"
                                            style={{
                                                flex: 'none',
                                                width: 30,
                                                height: 30,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: '#c00',
                                            }}
                                        >
                                            <i className="fa-solid fa-xmark"></i>
                                        </button>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            <ChatInput onSend={handleSendMessage}/>
        </div>
    );
}


const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(Messenger));


const loadingFiles = document.getElementById('loading-files');
const fileList = document.getElementById('file-list');

function clearFileList(keepLoader = true) {
    Array.from(fileList.children).forEach(child => {
        if (keepLoader && child === loadingFiles) return;
        fileList.removeChild(child);
    });
}

function showEmptyMessage() {
    const li = document.createElement('li');
    li.textContent = 'No files have been shared yet.';
    li.style.fontStyle = 'italic';
    li.style.color = '#666';
    li.style.padding = '1rem 0';
    fileList.appendChild(li);
}

function showErrorMessage(message) {
    const li = document.createElement('li');
    li.textContent = message || 'Failed to load files. Please refresh the page.';
    li.style.color = '#c00';
    li.style.padding = '1rem 0';
    fileList.appendChild(li);
}

async function deleteFile(name, listItem, deleteButton) {
    const confirmed = window.confirm(`Delete "${name}"?`);
    if (!confirmed) return;

    try {
        deleteButton.disabled = true;
        deleteButton.classList.add('loading');

        const res = await fetch(`/api/files/${encodeURIComponent(name)}`, {
            method: 'DELETE',
        });

        if (!res.ok) {
            let message = 'Failed to delete file. Please try again.';
            try {
                const data = await res.json();
                if (data && data.error) {
                    message = data.error;
                }
            } catch (_) {
                // ignore JSON parse errors
            }
            alert(message);
            deleteButton.disabled = false;
            deleteButton.classList.remove('loading');
            return;
        }

        fileList.removeChild(listItem);

        const hasFileItems = Array.from(fileList.children).some(
            child => child.tagName === 'LI' && child !== loadingFiles
        );
        if (!hasFileItems) {
            showEmptyMessage();
        }
    } catch (error) {
        console.error('Error deleting file:', error);
        alert('Failed to delete file. Please try again.');
        deleteButton.disabled = false;
        deleteButton.classList.remove('loading');
    }
}

async function fetchFiles() {
    try {
        loadingFiles.style.display = 'block';
        clearFileList(false); // keep loader

        const res = await fetch('/api/files');

        if (!res.ok) {
            throw new Error('Failed to load files');
        }

        const files = await res.json();
        clearFileList(false); // remove previous items but keep loader

        if (!Array.isArray(files) || files.length === 0) {
            showEmptyMessage();
        } else {
            files.forEach(file => {
                const li = document.createElement('li');
                li.className = 'file-item';

                const fileContent = document.createElement('div');
                fileContent.className = 'file-item-content';

                const a = document.createElement('a');
                a.href = file.url;
                a.className = 'file-link';
                a.target = '_blank';
                a.rel = 'noopener noreferrer';

                // icon
                const icon = document.createElement('i');
                const fileExt = (file.name || '').split('.').pop().toLowerCase();

                if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(fileExt)) {
                    icon.className = 'fas fa-file-image file-icon';
                } else if (fileExt === 'pdf') {
                    icon.className = 'fas fa-file-pdf file-icon';
                } else if (['doc', 'docx'].includes(fileExt)) {
                    icon.className = 'fas fa-file-word file-icon';
                } else if (['xls', 'xlsx'].includes(fileExt)) {
                    icon.className = 'fas fa-file-excel file-icon';
                } else if (['zip', 'rar', '7z'].includes(fileExt)) {
                    icon.className = 'fas fa-file-archive file-icon';
                } else {
                    icon.className = 'fas fa-file file-icon';
                }

                a.appendChild(icon);

                const fileName = document.createElement('span');
                fileName.className = 'file-name';
                fileName.textContent = file.name;
                a.appendChild(fileName);

                fileContent.appendChild(a);

                const deleteButton = document.createElement('button');
                deleteButton.type = 'button';
                deleteButton.className = 'delete-btn';
                deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
                deleteButton.addEventListener('click', event => {
                    event.preventDefault();
                    deleteFile(file.name, li, deleteButton);
                });

                fileContent.appendChild(deleteButton);

                li.appendChild(fileContent);
                fileList.appendChild(li);
            });
        }
    } catch (error) {
        console.error('Error fetching files:', error);
        clearFileList(false);
        showErrorMessage('Failed to load files. Please refresh the page.');
    } finally {
        loadingFiles.style.display = 'none';
    }
}

// Initialize
fetchFiles();
