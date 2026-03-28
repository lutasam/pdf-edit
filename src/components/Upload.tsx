import { useCallback, useRef, useState } from 'react';
import type { DragEvent, ChangeEvent } from 'react';
import { Upload as UploadIcon, FileText } from 'lucide-react';

interface Props {
  onFileLoad: (file: File, data: ArrayBuffer) => void;
}

export default function Upload({ onFileLoad }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (file.type !== 'application/pdf') return;
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          onFileLoad(file, reader.result);
        }
      };
      reader.readAsArrayBuffer(file);
    },
    [onFileLoad],
  );

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return (
    <div
      className="upload-wrapper"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 20,
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 16,
          padding: '60px 80px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          transition: 'border-color 0.2s, background 0.2s',
          background: dragging ? 'rgba(74,144,217,0.08)' : 'transparent',
        }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <FileText size={48} strokeWidth={1.2} color="var(--accent)" />
          <UploadIcon size={48} strokeWidth={1.2} color="var(--text-muted)" />
        </div>
        <p style={{ fontSize: 18, fontWeight: 500 }}>
          Drop a PDF here or click to browse
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          Supports .pdf files
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        onChange={onChange}
      />
    </div>
  );
}
