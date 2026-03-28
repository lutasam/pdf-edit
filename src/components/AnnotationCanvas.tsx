import {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react';
import * as fabric from 'fabric';
import type { Tool } from '../types';

export interface AnnotationCanvasHandle {
  /** Export the canvas as a transparent PNG data URL */
  toDataURL: () => string;
  /** Serialize the canvas to JSON */
  toJSON: () => string;
  /** Load canvas from JSON */
  loadJSON: (json: string) => Promise<void>;
  /** Clear all objects */
  clear: () => void;
  /** Add an image from a data URL */
  addImage: (dataUrl: string) => void;
  /** Undo last action */
  undo: () => void;
  /** Redo last undone action */
  redo: () => void;
  /** Delete currently selected object(s) */
  deleteSelected: () => void;
  /** Check if canvas has objects */
  hasObjects: () => boolean;
  /** Cover original text with white rect and place editable text on top */
  addWhiteRectAndText: (text: string, x: number, y: number, width: number, height: number) => void;
}

interface Props {
  width: number;
  height: number;
  activeTool: Tool;
  brushColor: string;
  brushWidth: number;
  onCanvasReady?: () => void;
}

const AnnotationCanvas = forwardRef<AnnotationCanvasHandle, Props>(
  ({ width, height, activeTool, brushColor, brushWidth, onCanvasReady }, ref) => {
    const canvasElRef = useRef<HTMLCanvasElement>(null);
    const fabricRef = useRef<fabric.Canvas | null>(null);
    const historyRef = useRef<string[]>([]);
    const historyIndexRef = useRef(-1);
    const isLoadingRef = useRef(false);

    // Save history snapshot
    const saveHistory = useCallback(() => {
      if (isLoadingRef.current) return;
      const fc = fabricRef.current;
      if (!fc) return;
      const json = JSON.stringify(fc.toJSON());
      // Truncate any redo states
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
      historyRef.current.push(json);
      historyIndexRef.current = historyRef.current.length - 1;
    }, []);

    // Initialize fabric canvas
    useEffect(() => {
      if (!canvasElRef.current) return;
      const fc = new fabric.Canvas(canvasElRef.current, {
        width,
        height,
        backgroundColor: 'transparent',
        selection: true,
      });
      fabricRef.current = fc;

      // Initial history
      saveHistory();

      // Track changes for history
      const onModified = () => saveHistory();
      fc.on('object:added', onModified);
      fc.on('object:removed', onModified);
      fc.on('object:modified', onModified);

      onCanvasReady?.();

      return () => {
        fc.off('object:added', onModified);
        fc.off('object:removed', onModified);
        fc.off('object:modified', onModified);
        fc.dispose();
        fabricRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Initialize only once

    // Update canvas dimensions when they change
    useEffect(() => {
      const fc = fabricRef.current;
      if (!fc) return;
      fc.setDimensions({ width, height });
      fc.renderAll();
    }, [width, height]);

    // Handle tool changes
    useEffect(() => {
      const fc = fabricRef.current;
      if (!fc) return;

      if (activeTool === 'draw') {
        fc.isDrawingMode = true;
        fc.freeDrawingBrush = new fabric.PencilBrush(fc);
        fc.freeDrawingBrush.color = brushColor;
        fc.freeDrawingBrush.width = brushWidth;
        fc.selection = false;
        fc.defaultCursor = 'crosshair';
        fc.hoverCursor = 'crosshair';
      } else if (activeTool === 'eraser') {
        fc.isDrawingMode = false;
        fc.selection = false;
        fc.defaultCursor = 'pointer';
        fc.hoverCursor = 'pointer';

        // When user clicks an object, fabric fires selection:created
        // We immediately delete whatever was selected
        const onSelected = () => {
          const objs = fc.getActiveObjects();
          if (objs.length > 0) {
            objs.forEach((obj) => fc.remove(obj));
            fc.discardActiveObject();
            fc.renderAll();
          }
        };
        fc.on('selection:created', onSelected);
        fc.on('selection:updated', onSelected);
        return () => {
          fc.off('selection:created', onSelected);
          fc.off('selection:updated', onSelected);
          fc.defaultCursor = 'default';
          fc.hoverCursor = 'move';
        };
      } else {
        fc.isDrawingMode = false;
        fc.selection = activeTool === 'select';
        fc.defaultCursor = 'default';
        fc.hoverCursor = 'move';
      }

      if (activeTool === 'text') {
        const onClick = (opt: fabric.TPointerEventInfo) => {
          const pointer = fc.getScenePoint(opt.e);
          const text = new fabric.IText('Type here', {
            left: pointer.x,
            top: pointer.y,
            fontSize: 20,
            fill: brushColor,
            fontFamily: 'sans-serif',
            editable: true,
          });
          fc.add(text);
          fc.setActiveObject(text);
          text.enterEditing();
          // Remove handler after placing one text
          fc.off('mouse:down', onClick);
        };
        fc.on('mouse:down', onClick);
        return () => {
          fc.off('mouse:down', onClick);
        };
      }
    }, [activeTool, brushColor, brushWidth]);

    // Update brush props live while drawing
    useEffect(() => {
      const fc = fabricRef.current;
      if (!fc || !fc.freeDrawingBrush) return;
      fc.freeDrawingBrush.color = brushColor;
      fc.freeDrawingBrush.width = brushWidth;
    }, [brushColor, brushWidth]);

    useImperativeHandle(ref, () => ({
      toDataURL() {
        const fc = fabricRef.current;
        if (!fc) return '';
        // Deselect to avoid rendering selection handles
        fc.discardActiveObject();
        fc.renderAll();
        return fc.toDataURL({ format: 'png', multiplier: 1 });
      },
      toJSON() {
        return JSON.stringify(fabricRef.current?.toJSON() ?? {});
      },
      async loadJSON(json: string) {
        const fc = fabricRef.current;
        if (!fc) return;
        isLoadingRef.current = true;
        await fc.loadFromJSON(json);
        fc.renderAll();
        isLoadingRef.current = false;
      },
      clear() {
        fabricRef.current?.clear();
      },
      addImage(dataUrl: string) {
        const fc = fabricRef.current;
        if (!fc) return;
        const imgEl = new Image();
        imgEl.onload = () => {
          const img = new fabric.FabricImage(imgEl, {
            left: 50,
            top: 50,
            scaleX: Math.min(200 / imgEl.width, 1),
            scaleY: Math.min(200 / imgEl.height, 1),
          });
          fc.add(img);
          fc.setActiveObject(img);
          fc.renderAll();
        };
        imgEl.src = dataUrl;
      },
      undo() {
        if (historyIndexRef.current <= 0) return;
        historyIndexRef.current--;
        const json = historyRef.current[historyIndexRef.current];
        const fc = fabricRef.current;
        if (!fc || !json) return;
        isLoadingRef.current = true;
        fc.loadFromJSON(json).then(() => {
          fc.renderAll();
          isLoadingRef.current = false;
        });
      },
      redo() {
        if (historyIndexRef.current >= historyRef.current.length - 1) return;
        historyIndexRef.current++;
        const json = historyRef.current[historyIndexRef.current];
        const fc = fabricRef.current;
        if (!fc || !json) return;
        isLoadingRef.current = true;
        fc.loadFromJSON(json).then(() => {
          fc.renderAll();
          isLoadingRef.current = false;
        });
      },
      deleteSelected() {
        const fc = fabricRef.current;
        if (!fc) return;
        const active = fc.getActiveObjects();
        active.forEach((obj) => fc.remove(obj));
        fc.discardActiveObject();
        fc.renderAll();
      },
      hasObjects() {
        return (fabricRef.current?.getObjects().length ?? 0) > 0;
      },
      addWhiteRectAndText(text: string, x: number, y: number, width: number, height: number) {
        const fc = fabricRef.current;
        if (!fc) return;
        const paddingX = Math.max(8, width * 0.08);
        const paddingY = Math.max(5, height * 0.32);
        const rect = new fabric.Rect({
          left: x - paddingX,
          top: y - paddingY,
          width: width + paddingX * 2,
          height: height + paddingY * 2,
          fill: 'white',
          selectable: false,
          evented: false,
        });
        fc.add(rect);
        const textObj = new fabric.Textbox(text.trim(), {
          left: x,
          top: y - Math.max(1, height * 0.08),
          width: width,
          fontSize: Math.max(12, Math.round(height * 0.82)),
          fill: 'black',
          fontFamily: 'sans-serif',
          editable: true,
          lineHeight: 1,
          backgroundColor: 'white',
        });
        fc.add(textObj);
        fc.setActiveObject(textObj);
        fc.renderAll();
      },
    }));

    const disablePointer = activeTool === 'pan' || activeTool === 'ocr';

    return (
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 10,
          pointerEvents: disablePointer ? 'none' : 'auto',
        }}
      >
        <canvas ref={canvasElRef} />
      </div>
    );
  },
);

AnnotationCanvas.displayName = 'AnnotationCanvas';
export default AnnotationCanvas;
