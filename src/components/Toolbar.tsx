import type { Tool } from '../types';
import {
  MousePointer2,
  Pencil,
  Type,
  ImagePlus,
  PenTool,
  Eraser,
  Hand,
  ScanText,
  ChevronLeft,
  ChevronRight,
  Download,
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
  Palette,
  FolderOpen,
} from 'lucide-react';
import { useRef, useState } from 'react';

interface Props {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  pageNum: number;
  numPages: number;
  onPageChange: (page: number) => void;
  onExport: () => void;
  onOpenFile: () => void;
  scale: number;
  onScaleChange: (s: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  brushColor: string;
  onBrushColorChange: (c: string) => void;
  brushWidth: number;
  onBrushWidthChange: (w: number) => void;
}

const tools: { id: Tool; icon: typeof MousePointer2; label: string }[] = [
  { id: 'select', icon: MousePointer2, label: 'Select' },
  { id: 'draw', icon: Pencil, label: 'Draw' },
  { id: 'text', icon: Type, label: 'Add Text' },
  { id: 'image', icon: ImagePlus, label: 'Add Image' },
  { id: 'signature', icon: PenTool, label: 'Signature' },
  { id: 'eraser', icon: Eraser, label: 'Delete Selected' },
  { id: 'pan', icon: Hand, label: 'Pan / Drag' },
  { id: 'ocr', icon: ScanText, label: 'OCR Edit Text' },
];

const btnStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 38,
  height: 38,
  borderRadius: 'var(--radius)',
  background: active ? 'var(--accent)' : 'transparent',
  color: active ? '#fff' : 'var(--text)',
  transition: 'background 0.15s, color 0.15s',
});

export default function Toolbar(props: Props) {
  const {
    activeTool,
    onToolChange,
    pageNum,
    numPages,
    onPageChange,
    onExport,
    onOpenFile,
    scale,
    onScaleChange,
    onUndo,
    onRedo,
    brushColor,
    onBrushColorChange,
    brushWidth,
    onBrushWidthChange,
  } = props;

  const colorRef = useRef<HTMLInputElement>(null);
  const [showBrushOptions, setShowBrushOptions] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '6px 12px',
        background: 'var(--toolbar-bg)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}
    >
      {/* Tool buttons */}
      {tools.map((t) => (
        <button
          key={t.id}
          title={t.label}
          style={btnStyle(activeTool === t.id)}
          onClick={() => onToolChange(t.id)}
        >
          <t.icon size={18} />
        </button>
      ))}

      {/* Brush options toggle (visible when draw is active) */}
      {activeTool === 'draw' && (
        <>
          <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 4px' }} />
          <button
            title="Brush options"
            style={btnStyle(showBrushOptions)}
            onClick={() => setShowBrushOptions(!showBrushOptions)}
          >
            <Palette size={18} />
          </button>
          {showBrushOptions && (
            <>
              <button
                title="Brush color"
                style={{
                  ...btnStyle(false),
                  position: 'relative',
                }}
                onClick={() => colorRef.current?.click()}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: brushColor,
                    border: '2px solid var(--text-muted)',
                  }}
                />
                <input
                  ref={colorRef}
                  type="color"
                  value={brushColor}
                  onChange={(e) => onBrushColorChange(e.target.value)}
                  style={{
                    position: 'absolute',
                    opacity: 0,
                    width: 0,
                    height: 0,
                  }}
                />
              </button>
              <select
                title="Brush width"
                value={brushWidth}
                onChange={(e) => onBrushWidthChange(Number(e.target.value))}
                style={{
                  background: 'var(--bg-surface)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '4px 8px',
                  fontSize: 13,
                }}
              >
                {[1, 2, 3, 5, 8, 12, 20].map((w) => (
                  <option key={w} value={w}>
                    {w}px
                  </option>
                ))}
              </select>
            </>
          )}
        </>
      )}

      <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 4px' }} />

      {/* Undo / Redo */}
      <button title="Undo" style={btnStyle(false)} onClick={onUndo}>
        <Undo2 size={18} />
      </button>
      <button title="Redo" style={btnStyle(false)} onClick={onRedo}>
        <Redo2 size={18} />
      </button>

      <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 4px' }} />

      {/* Zoom */}
      <button
        title="Zoom out"
        style={btnStyle(false)}
        onClick={() => onScaleChange(Math.max(0.25, scale - 0.25))}
      >
        <ZoomOut size={18} />
      </button>
      <span style={{ fontSize: 13, minWidth: 42, textAlign: 'center' }}>
        {Math.round(scale * 100)}%
      </span>
      <button
        title="Zoom in"
        style={btnStyle(false)}
        onClick={() => onScaleChange(Math.min(3, scale + 0.25))}
      >
        <ZoomIn size={18} />
      </button>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Page navigation */}
      <button
        title="Previous page"
        style={btnStyle(false)}
        onClick={() => onPageChange(Math.max(1, pageNum - 1))}
        disabled={pageNum <= 1}
      >
        <ChevronLeft size={18} />
      </button>
      <span style={{ fontSize: 13, minWidth: 70, textAlign: 'center' }}>
        {pageNum} / {numPages}
      </span>
      <button
        title="Next page"
        style={btnStyle(false)}
        onClick={() => onPageChange(Math.min(numPages, pageNum + 1))}
        disabled={pageNum >= numPages}
      >
        <ChevronRight size={18} />
      </button>

      <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 8px' }} />

      {/* Open File */}
      <button
        title="Open PDF File"
        onClick={onOpenFile}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 14px',
          borderRadius: 'var(--radius)',
          background: 'var(--bg-elevated)',
          color: 'var(--text)',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <FolderOpen size={16} />
        Open
      </button>

      {/* Export */}
      <button
        title="Export PDF"
        onClick={onExport}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 14px',
          borderRadius: 'var(--radius)',
          background: 'var(--accent)',
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <Download size={16} />
        Export
      </button>
    </div>
  );
}
