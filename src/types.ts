export type Tool = 'select' | 'draw' | 'text' | 'image' | 'signature' | 'eraser' | 'pan' | 'ocr';

export interface OcrLine {
  id: string;
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  confidence: number;
}

export interface OcrReplacement {
  lineId: string;
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

export interface AnnotationState {
  /** Serialized fabric.js canvas JSON per page number */
  pages: Map<number, string>;
}
