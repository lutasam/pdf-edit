import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import AnnotationCanvas from './AnnotationCanvas';
import OcrOverlay from './OcrOverlay';
import type { AnnotationCanvasHandle } from './AnnotationCanvas';
import type { Tool, OcrLine, OcrReplacement } from '../types';

// Configure PDF.js worker — must use the same pdfjs-dist version that react-pdf bundles
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Props {
  pdfData: Uint8Array;
  pageNum: number;
  scale: number;
  activeTool: Tool;
  brushColor: string;
  brushWidth: number;
  onNumPagesChange: (n: number) => void;
  /** Exposed so App can call export */
  canvasRef: React.RefObject<AnnotationCanvasHandle | null>;
  /** Called before page change so we can save annotations */
  onBeforePageChange?: () => void;
  /** Called to load annotations for the new page */
  savedAnnotation?: string;
  /** OCR state */
  ocrLines: OcrLine[] | null;
  ocrReplacements: OcrReplacement[];
  ocrLoading: boolean;
  pageScale: number;
  onOcrEdit: (line: OcrLine, newText: string) => void;
  onOcrResize: (lineId: string, bbox: OcrReplacement['bbox']) => void;
  onOcrClose: () => void;
}

export default function PDFViewer({
  pdfData,
  pageNum,
  scale,
  activeTool,
  brushColor,
  brushWidth,
  onNumPagesChange,
  canvasRef,
  savedAnnotation,
  ocrLines,
  ocrReplacements,
  ocrLoading,
  pageScale,
  onOcrEdit,
  onOcrResize,
  onOcrClose,
}: Props) {
  const [pageDims, setPageDims] = useState<{ width: number; height: number }>({
    width: 612,
    height: 792,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const annotationReady = useRef(false);

  // Pan state
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  // Keep a ref to the current scale so onPageLoadSuccess can always divide correctly
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  // Memoize file prop so react-pdf doesn't reload on every render.
  // IMPORTANT: copy the data — pdfjs transfers the ArrayBuffer, which would
  // detach the original Uint8Array and break export.
  const file = useMemo(() => ({ data: new Uint8Array(pdfData) }), [pdfData]);

  // When page renders, capture its BASE (unscaled) dimensions
  const onPageLoadSuccess = useCallback(
    (page: { width: number; height: number }) => {
      // page.width/height include the current scale, so divide it out
      setPageDims({
        width: Math.round(page.width / scaleRef.current),
        height: Math.round(page.height / scaleRef.current),
      });
    },
    [],
  );

  // Restore annotation when page changes or annotation canvas mounts
  useEffect(() => {
    if (annotationReady.current && savedAnnotation && canvasRef.current) {
      canvasRef.current.loadJSON(savedAnnotation);
    }
  }, [pageNum, savedAnnotation, canvasRef]);

  const handleCanvasReady = useCallback(() => {
    annotationReady.current = true;
    if (savedAnnotation && canvasRef.current) {
      canvasRef.current.loadJSON(savedAnnotation);
    }
  }, [savedAnnotation, canvasRef]);

  const scaledW = pageDims.width * scale;
  const scaledH = pageDims.height * scale;

  // Pan handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (activeTool !== 'pan') return;
      isPanning.current = true;
      const container = containerRef.current!;
      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        scrollLeft: container.scrollLeft,
        scrollTop: container.scrollTop,
      };
      container.style.cursor = 'grabbing';
      e.preventDefault();
    },
    [activeTool],
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    const container = containerRef.current!;
    container.scrollLeft = panStart.current.scrollLeft - dx;
    container.scrollTop = panStart.current.scrollTop - dy;
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!isPanning.current) return;
    isPanning.current = false;
    if (containerRef.current) {
      containerRef.current.style.cursor = activeTool === 'pan' ? 'grab' : '';
    }
  }, [activeTool]);

  // Update cursor style when switching to/from pan tool
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.cursor = activeTool === 'pan' ? 'grab' : '';
    }
  }, [activeTool]);

  const showOcr = ocrLoading || ocrLines !== null;

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        flex: 1,
        overflow: 'auto',
        background: 'var(--bg)',
        cursor: activeTool === 'pan' ? 'grab' : undefined,
      }}
    >
      <div
        style={{
          width: 'max-content',
          minWidth: '100%',
          minHeight: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: 24,
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: scaledW,
            height: scaledH,
            boxShadow: 'var(--shadow)',
            borderRadius: 4,
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <Document
            file={file}
            onLoadSuccess={(pdf) => onNumPagesChange(pdf.numPages)}
          >
            <Page
              pageNumber={pageNum}
              scale={scale}
              onLoadSuccess={onPageLoadSuccess}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </Document>

          <AnnotationCanvas
            ref={canvasRef}
            width={scaledW}
            height={scaledH}
            activeTool={activeTool}
            brushColor={brushColor}
            brushWidth={brushWidth}
            onCanvasReady={handleCanvasReady}
          />

          {showOcr && (
            <OcrOverlay
              lines={ocrLines ?? []}
              replacements={ocrReplacements}
              loading={ocrLoading}
              scale={pageScale}
              onEdit={onOcrEdit}
              onResize={onOcrResize}
              onClose={onOcrClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
