import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { OcrLine, OcrReplacement } from '../types';

interface Props {
  lines: OcrLine[];
  replacements: OcrReplacement[];
  loading: boolean;
  scale: number;
  onEdit: (line: OcrLine, newText: string) => void;
  onResize: (lineId: string, bbox: OcrReplacement['bbox']) => void;
  onClose: () => void;
}

export default function OcrOverlay({ lines, replacements, loading, scale, onEdit, onResize, onClose }: Props) {
  const [editingLine, setEditingLine] = useState<OcrLine | null>(null);
  const [editText, setEditText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resizeStateRef = useRef<{
    lineId: string;
    startX: number;
    startY: number;
    bbox: OcrReplacement['bbox'];
  } | null>(null);

  const replacementsById = new Map(replacements.map((replacement) => [replacement.lineId, replacement]));

  const handleLineClick = (line: OcrLine) => {
    setEditingLine(line);
    setEditText(line.text);
  };

  const handleCancel = () => {
    setEditingLine(null);
    setEditText('');
  };

  const handleCommit = () => {
    if (!editingLine) return;
    onEdit(editingLine, editText);
    setEditingLine(null);
    setEditText('');
  };

  useEffect(() => {
    if (!editingLine || !textareaRef.current) return;
    textareaRef.current.focus();
    textareaRef.current.select();
  }, [editingLine]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const state = resizeStateRef.current;
      if (!state) return;

      const deltaX = (event.clientX - state.startX) / scale;
      const deltaY = (event.clientY - state.startY) / scale;
      onResize(state.lineId, {
        x0: state.bbox.x0,
        y0: state.bbox.y0,
        x1: Math.max(state.bbox.x0 + 12, state.bbox.x1 + deltaX),
        y1: Math.max(state.bbox.y0 + 12, state.bbox.y1 + deltaY),
      });
    };

    const handlePointerUp = () => {
      resizeStateRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [onResize, scale]);

  const startResize = (
    event: React.PointerEvent,
    lineId: string,
    bbox: OcrReplacement['bbox'],
  ) => {
    event.preventDefault();
    event.stopPropagation();
    resizeStateRef.current = {
      lineId,
      startX: event.clientX,
      startY: event.clientY,
      bbox,
    };
  };

  if (loading) {
    return (
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.3)',
        }}
      >
        <div
          style={{
            background: 'var(--bg-surface)',
            padding: '20px 32px',
            borderRadius: 'var(--radius)',
            color: 'var(--text)',
            fontSize: 16,
          }}
        >
          Running OCR... This may take a moment.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 20,
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        title="Close OCR"
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 30,
          background: 'var(--danger)',
          color: '#fff',
          borderRadius: '50%',
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <X size={16} />
      </button>

      {/* No text found message */}
      {lines.length === 0 && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--bg-surface)',
            padding: '16px 28px',
            borderRadius: 'var(--radius)',
            color: 'var(--text-muted)',
            fontSize: 15,
            boxShadow: 'var(--shadow)',
          }}
        >
          No text detected on this page. Click the X to close.
        </div>
      )}

      {/* Detected text lines */}
      {lines.map((line) => {
        const isEditing = editingLine?.id === line.id;
        const replacement = replacementsById.get(line.id);
        const bbox = replacement?.bbox ?? line.bbox;
        const left = bbox.x0 * scale;
        const top = bbox.y0 * scale;
        const width = (bbox.x1 - bbox.x0) * scale;
        const height = (bbox.y1 - bbox.y0) * scale;
        return (
          isEditing ? (
            <textarea
              key={line.id}
              ref={textareaRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={handleCommit}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  handleCancel();
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleCommit();
                }
              }}
              style={{
                position: 'absolute',
                left: left - 4,
                top: top - 4,
                width: Math.max(48, width + 8),
                minHeight: Math.max(24, height + 10),
                padding: '2px 4px',
                background: '#fff',
                color: '#111',
                border: '2px solid var(--accent)',
                borderRadius: 2,
                resize: 'none',
                overflow: 'auto',
                fontSize: Math.max(12, Math.round(height * 0.88)),
                lineHeight: 1.15,
                fontFamily: 'Arial, sans-serif',
                boxShadow: 'var(--shadow)',
                zIndex: 26,
              }}
            />
          ) : (
            replacement ? (
              <div
                key={line.id}
                style={{
                  position: 'absolute',
                  left: left - 2,
                  top: top - 2,
                  width: width + 4,
                  minHeight: height + 6,
                  zIndex: 24,
                }}
              >
                <div
                  onClick={() => handleLineClick(line)}
                  style={{
                    width: '100%',
                    minHeight: '100%',
                    padding: '2px 4px',
                    background: '#fff',
                    border: '1px solid rgba(74, 144, 217, 0.45)',
                    color: '#111',
                    cursor: 'text',
                    borderRadius: 2,
                    fontSize: Math.max(12, Math.round(height * 0.88)),
                    lineHeight: 1.15,
                    fontFamily: 'Arial, sans-serif',
                    whiteSpace: 'pre-wrap',
                    overflow: 'hidden',
                    height: '100%',
                    boxSizing: 'border-box',
                  }}
                  title={replacement.text}
                >
                  {replacement.text || ' '}
                </div>
                <div
                  onPointerDown={(event) => startResize(event, line.id, replacement.bbox)}
                  style={{
                    position: 'absolute',
                    right: -2,
                    bottom: -2,
                    width: 12,
                    height: 12,
                    background: 'var(--accent)',
                    border: '1px solid #fff',
                    borderRadius: 2,
                    cursor: 'nwse-resize',
                    boxShadow: 'var(--shadow)',
                  }}
                  title="Resize OCR text box"
                />
              </div>
            ) : (
              <div
                key={line.id}
                onClick={() => handleLineClick(line)}
                style={{
                  position: 'absolute',
                  left,
                  top,
                  width,
                  height,
                  background: 'rgba(74, 144, 217, 0.10)',
                  border: '1px solid rgba(74, 144, 217, 0.45)',
                  cursor: 'text',
                  borderRadius: 2,
                  transition: 'background 0.15s',
                }}
                title={line.text}
              />
            )
          )
        );
      })}
    </div>
  );
}
