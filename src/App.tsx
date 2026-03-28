import { useState, useRef, useCallback } from 'react';
import { pdfjs } from 'react-pdf';
import Upload from './components/Upload';
import PDFViewer from './components/PDFViewer';
import Toolbar from './components/Toolbar';
import SignatureModal from './components/SignatureModal';
import { useAnnotations } from './hooks/useAnnotations';
import { exportAnnotatedPdf, downloadBlob } from './utils/exportPdf';
import type { Tool, OcrLine, OcrReplacement } from './types';
import type { AnnotationCanvasHandle } from './components/AnnotationCanvas';

function normalizeOcrText(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function areBboxesNear(left: OcrLine['bbox'], right: OcrLine['bbox']) {
  const centerLeftX = (left.x0 + left.x1) / 2;
  const centerLeftY = (left.y0 + left.y1) / 2;
  const centerRightX = (right.x0 + right.x1) / 2;
  const centerRightY = (right.y0 + right.y1) / 2;

  return Math.abs(centerLeftX - centerRightX) <= 6 && Math.abs(centerLeftY - centerRightY) <= 6;
}

function dedupeOcrLines(lines: OcrLine[]) {
  const deduped: OcrLine[] = [];

  for (const line of lines) {
    const normalized = normalizeOcrText(line.text);
    const duplicate = deduped.find(
      (existing) =>
        normalizeOcrText(existing.text) === normalized && areBboxesNear(existing.bbox, line.bbox),
    );

    if (!duplicate) {
      deduped.push(line);
    }
  }

  return deduped;
}

export default function App() {
  // PDF state — stored as Uint8Array to avoid ArrayBuffer detach on transfer
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [pdfName, setPdfName] = useState('document.pdf');
  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(1);

  // Tool state
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [scale, setScale] = useState(1);
  const [brushColor, setBrushColor] = useState('#e74c3c');
  const [brushWidth, setBrushWidth] = useState(3);

  // Signature modal
  const [showSignature, setShowSignature] = useState(false);

  // OCR state
  const [ocrLines, setOcrLines] = useState<OcrLine[] | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrReplacementsByPage, setOcrReplacementsByPage] = useState<Record<number, OcrReplacement[]>>({});

  // Annotation persistence
  const annotations = useAnnotations();
  const canvasRef = useRef<AnnotationCanvasHandle>(null);

  const buildPdfTextLines = useCallback(async (pdfBytes: Uint8Array, targetPage: number) => {
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(pdfBytes) });
    const pdfDocument = await loadingTask.promise;
    try {
      const page = await pdfDocument.getPage(targetPage);
      const viewport = page.getViewport({ scale: 1 });
      const textContent = await page.getTextContent();
      const rawItems = textContent.items.filter(
        (item) => 'str' in item && typeof item.str === 'string' && item.str.trim().length > 0,
      ) as Array<{
        str: string;
        transform: number[];
        width: number;
        height?: number;
        hasEOL?: boolean;
      }>;

      const grouped: OcrLine[] = [];
      let currentLine:
        | {
            text: string;
            bbox: { x0: number; y0: number; x1: number; y1: number };
            baselineY: number;
            lastX: number;
            height: number;
          }
        | null = null;

      const flushLine = () => {
        if (!currentLine || !currentLine.text.trim()) return;
        grouped.push({
          id: `pdf-${targetPage}-${grouped.length}-${Math.round(currentLine.bbox.x0)}-${Math.round(currentLine.bbox.y0)}`,
          text: currentLine.text.trim(),
          bbox: currentLine.bbox,
          confidence: 100,
        });
        currentLine = null;
      };

      for (const item of rawItems) {
        const x = item.transform[4];
        const glyphHeight = Math.max(Math.abs(item.transform[3]), item.height ?? 0, 8);
        const top = viewport.height - item.transform[5] - glyphHeight;
        const right = x + Math.max(item.width, 4);
        const baselineY = item.transform[5];
        const text = item.str.trim();

        if (!currentLine) {
          currentLine = {
            text,
            bbox: { x0: x, y0: top, x1: right, y1: top + glyphHeight },
            baselineY,
            lastX: right,
            height: glyphHeight,
          };
        } else {
          const sameVisualLine = Math.abs(currentLine.baselineY - baselineY) <= Math.max(3, glyphHeight * 0.25);
          const forwardProgress = x >= currentLine.lastX - Math.max(8, currentLine.height * 0.5);

          if (!sameVisualLine || !forwardProgress) {
            flushLine();
            currentLine = {
              text,
              bbox: { x0: x, y0: top, x1: right, y1: top + glyphHeight },
              baselineY,
              lastX: right,
              height: glyphHeight,
            };
          } else {
            const gap = x - currentLine.lastX;
            currentLine.text = `${currentLine.text}${gap > Math.max(4, glyphHeight * 0.15) ? ' ' : ''}${text}`;
            currentLine.bbox = {
              x0: Math.min(currentLine.bbox.x0, x),
              y0: Math.min(currentLine.bbox.y0, top),
              x1: Math.max(currentLine.bbox.x1, right),
              y1: Math.max(currentLine.bbox.y1, top + glyphHeight),
            };
            currentLine.lastX = right;
            currentLine.height = Math.max(currentLine.height, glyphHeight);
          }
        }

        if (item.hasEOL) {
          flushLine();
        }
      }

      flushLine();

      return dedupeOcrLines(grouped);
    } finally {
      await loadingTask.destroy();
    }
  }, []);

  const buildOcrLinesFromRender = useCallback(async (pdfBytes: Uint8Array, targetPage: number) => {
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(pdfBytes) });
    const pdfDocument = await loadingTask.promise;
    try {
      const page = await pdfDocument.getPage(targetPage);
      const renderScale = 2;
      const viewport = page.getViewport({ scale: renderScale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) {
        return [];
      }

      await page.render({ canvasContext: context, viewport, canvas }).promise;

      const Tesseract = await import('tesseract.js');
      const createWorker = Tesseract.createWorker ?? (Tesseract as { default?: { createWorker?: typeof Tesseract.createWorker } }).default?.createWorker;
      const worker = await createWorker?.('eng');
      if (!worker) {
        return [];
      }

      try {
        const result = await worker.recognize(canvas, {}, { blocks: true });
        const lines: OcrLine[] = [];
        if (result.data.blocks) {
          for (const block of result.data.blocks) {
            for (const paragraph of block.paragraphs) {
              for (const [lineIndex, line] of paragraph.lines.entries()) {
                if (!line.text.trim()) continue;
                lines.push({
                  id: `ocr-${targetPage}-${block.bbox.x0}-${block.bbox.y0}-${lineIndex}`,
                  text: line.text.trim(),
                  bbox: {
                    x0: line.bbox.x0 / renderScale,
                    y0: line.bbox.y0 / renderScale,
                    x1: line.bbox.x1 / renderScale,
                    y1: line.bbox.y1 / renderScale,
                  },
                  confidence: line.confidence,
                });
              }
            }
          }
        }
        return dedupeOcrLines(lines);
      } finally {
        await worker.terminate();
      }
    } finally {
      await loadingTask.destroy();
    }
  }, []);

  // Save current page's annotations before navigating away
  const saveCurrentAnnotations = useCallback(() => {
    if (canvasRef.current) {
      annotations.save(pageNum, canvasRef.current.toJSON());
    }
  }, [pageNum, annotations]);

  // Handle file upload
  const handleFileLoad = useCallback((_file: File, data: ArrayBuffer) => {
    setPdfData(new Uint8Array(data));
    setPdfName(_file.name);
    setPageNum(1);
    setNumPages(0);
    setActiveTool('select');
  }, []);

  // Page change with annotation save/restore
  const handlePageChange = useCallback(
    (newPage: number) => {
      saveCurrentAnnotations();
      setPageNum(newPage);
    },
    [saveCurrentAnnotations],
  );

  // OCR processing
  const runOcr = useCallback(async () => {
    if (!pdfData) return;
    setOcrLoading(true);
    setOcrLines(null);
    try {
      const extractedLines = await buildPdfTextLines(pdfData, pageNum);
      const lines = extractedLines.length > 0
        ? extractedLines
        : await buildOcrLinesFromRender(pdfData, pageNum);
      setOcrLines(lines);
    } catch (err) {
      console.error('OCR failed:', err);
      setOcrLines([]);
    } finally {
      setOcrLoading(false);
    }
  }, [buildOcrLinesFromRender, buildPdfTextLines, pageNum, pdfData]);

  // Tool change
  const handleToolChange = useCallback(
    (tool: Tool) => {
      if (tool === 'signature') {
        setShowSignature(true);
        return;
      }
      if (tool === 'eraser') {
        canvasRef.current?.deleteSelected();
        setActiveTool(tool);
        return;
      }
      if (tool === 'image') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = () => {
          const file = input.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') {
              canvasRef.current?.addImage(reader.result);
            }
          };
          reader.readAsDataURL(file);
        };
        input.click();
        return;
      }
      if (tool === 'ocr') {
        setActiveTool(tool);
        runOcr();
        return;
      }
      setOcrLines(null);
      setActiveTool(tool);
    },
    [runOcr],
  );

  // OCR edit handler
  const handleOcrEdit = useCallback(
    (line: OcrLine, newText: string) => {
      setOcrReplacementsByPage((prev) => {
        const pageEntries = prev[pageNum] ?? [];
        const nextEntries = pageEntries.filter((entry) => entry.lineId !== line.id);
        return {
          ...prev,
          [pageNum]: [
            ...nextEntries,
            {
              lineId: line.id,
              text: newText,
              bbox: line.bbox,
            },
          ],
        };
      });
    },
    [pageNum],
  );

  const handleOcrResize = useCallback(
    (lineId: string, bbox: OcrReplacement['bbox']) => {
      setOcrReplacementsByPage((prev) => {
        const pageEntries = prev[pageNum] ?? [];
        const target = pageEntries.find((entry) => entry.lineId === lineId);
        if (!target) {
          return prev;
        }

        return {
          ...prev,
          [pageNum]: pageEntries.map((entry) =>
            entry.lineId === lineId ? { ...entry, bbox } : entry,
          ),
        };
      });
    },
    [pageNum],
  );

  // Close OCR overlay
  const handleOcrClose = useCallback(() => {
    setOcrLines(null);
    setOcrLoading(false);
    setActiveTool('select');
  }, []);

  // Signature apply
  const handleSignatureApply = useCallback((dataUrl: string) => {
    canvasRef.current?.addImage(dataUrl);
    setShowSignature(false);
  }, []);

  // Open a new PDF file
  const handleOpenFile = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          setPdfData(new Uint8Array(reader.result));
          setPdfName(file.name);
          setPageNum(1);
          setNumPages(0);
          setActiveTool('select');
          setOcrLines(null);
          setOcrLoading(false);
          setOcrReplacementsByPage({});
          annotations.clear();
          canvasRef.current?.clear();
        }
      };
      reader.readAsArrayBuffer(file);
    };
    input.click();
  }, [annotations]);

  // Export
  const handleExport = useCallback(async () => {
    if (!pdfData) return;
    try {
      // Save current page first
      saveCurrentAnnotations();

      // Collect annotation images for all pages
      const images = new Map<number, string>();

      // For current page, grab directly
      if (canvasRef.current?.hasObjects()) {
        images.set(pageNum, canvasRef.current.toDataURL());
      }

      // For other pages, we need to render their saved JSON to get images
      const allAnnotations = annotations.getAll();
      for (const [pNum, json] of allAnnotations) {
        if (pNum === pageNum) continue; // Already handled
        const parsed = JSON.parse(json);
        if (!parsed.objects || parsed.objects.length === 0) continue;

        // Create temporary fabric canvas
        const tmpCanvasEl = document.createElement('canvas');
        tmpCanvasEl.width = 612 * scale;
        tmpCanvasEl.height = 792 * scale;
        document.body.appendChild(tmpCanvasEl);

        const { Canvas: FabricCanvas } = await import('fabric');
        const tmpFc = new FabricCanvas(tmpCanvasEl, {
          width: tmpCanvasEl.width,
          height: tmpCanvasEl.height,
          backgroundColor: 'transparent',
        });

        await tmpFc.loadFromJSON(json);
        tmpFc.renderAll();

        const dataUrl = tmpFc.toDataURL({ format: 'png', multiplier: 1 });
        images.set(pNum, dataUrl);

        tmpFc.dispose();
        document.body.removeChild(tmpCanvasEl);
      }

      if (images.size === 0) {
        // Nothing to annotate, just download original
        const hasOcrEdits = Object.values(ocrReplacementsByPage).some((pageEntries) => pageEntries.length > 0);
        if (!hasOcrEdits) {
          downloadBlob(new Uint8Array(pdfData), pdfName.replace('.pdf', '_edited.pdf'));
          return;
        }
      }

      const ocrReplacementMap = new Map<number, OcrReplacement[]>();
      Object.entries(ocrReplacementsByPage).forEach(([page, entries]) => {
        if (entries.length > 0) {
          ocrReplacementMap.set(Number(page), entries);
        }
      });

      const result = await exportAnnotatedPdf(pdfData, images, ocrReplacementMap);
      downloadBlob(result, pdfName.replace('.pdf', '_edited.pdf'));
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. See console for details.');
    }
  }, [pdfData, pdfName, pageNum, scale, annotations, saveCurrentAnnotations, ocrReplacementsByPage]);

  // No PDF loaded → show upload
  if (!pdfData) {
    return <Upload onFileLoad={handleFileLoad} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar
        activeTool={activeTool}
        onToolChange={handleToolChange}
        pageNum={pageNum}
        numPages={numPages}
        onPageChange={handlePageChange}
        onExport={handleExport}
        onOpenFile={handleOpenFile}
        scale={scale}
        onScaleChange={setScale}
        onUndo={() => canvasRef.current?.undo()}
        onRedo={() => canvasRef.current?.redo()}
        brushColor={brushColor}
        onBrushColorChange={setBrushColor}
        brushWidth={brushWidth}
        onBrushWidthChange={setBrushWidth}
      />

      <PDFViewer
        pdfData={pdfData}
        pageNum={pageNum}
        scale={scale}
        activeTool={activeTool}
        brushColor={brushColor}
        brushWidth={brushWidth}
        onNumPagesChange={setNumPages}
        canvasRef={canvasRef}
        savedAnnotation={annotations.load(pageNum)}
        ocrLines={ocrLines}
        ocrReplacements={ocrReplacementsByPage[pageNum] ?? []}
        ocrLoading={ocrLoading}
        pageScale={scale}
        onOcrEdit={handleOcrEdit}
        onOcrResize={handleOcrResize}
        onOcrClose={handleOcrClose}
      />

      {showSignature && (
        <SignatureModal
          onApply={handleSignatureApply}
          onClose={() => setShowSignature(false)}
        />
      )}
    </div>
  );
}
