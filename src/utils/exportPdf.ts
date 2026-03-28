import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { OcrReplacement } from '../types';

/**
 * Exports the annotated PDF by overlaying annotation canvas images
 * onto the original PDF pages using pdf-lib.
 */
export async function exportAnnotatedPdf(
  originalPdfBytes: ArrayBuffer | Uint8Array,
  annotationImages: Map<number, string>, // pageNum (1-based) → PNG data URL
  ocrReplacements?: Map<number, OcrReplacement[]>,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const [pageNum, dataUrl] of annotationImages) {
    const pageIndex = pageNum - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;

    const page = pages[pageIndex];
    const { width, height } = page.getSize();

    // Convert data URL to bytes
    const base64 = dataUrl.split(',')[1];
    if (!base64) continue;
    const imageBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

    const pngImage = await pdfDoc.embedPng(imageBytes);

    page.drawImage(pngImage, {
      x: 0,
      y: 0,
      width,
      height,
    });
  }

  if (ocrReplacements) {
    for (const [pageNum, replacements] of ocrReplacements) {
      const pageIndex = pageNum - 1;
      if (pageIndex < 0 || pageIndex >= pages.length || replacements.length === 0) continue;

      const page = pages[pageIndex];
      const { height } = page.getSize();

      for (const replacement of replacements) {
        const boxWidth = replacement.bbox.x1 - replacement.bbox.x0;
        const boxHeight = replacement.bbox.y1 - replacement.bbox.y0;
        const paddingX = Math.max(4, boxWidth * 0.08);
        const paddingY = Math.max(3, boxHeight * 0.22);
        const rectX = replacement.bbox.x0 - paddingX;
        const rectY = height - replacement.bbox.y1 - paddingY;
        const rectWidth = boxWidth + paddingX * 2;
        const rectHeight = boxHeight + paddingY * 2;

        page.drawRectangle({
          x: rectX,
          y: rectY,
          width: rectWidth,
          height: rectHeight,
          color: rgb(1, 1, 1),
        });

        const fontSize = Math.max(10, Math.min(18, boxHeight * 0.85));
        const lines = replacement.text.split(/\r?\n/).filter(Boolean);
        const textLines = lines.length > 0 ? lines : [''];

        textLines.forEach((line, index) => {
          page.drawText(line, {
            x: replacement.bbox.x0,
            y: height - replacement.bbox.y0 - fontSize - index * (fontSize * 1.1),
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
            maxWidth: boxWidth,
            lineHeight: fontSize * 1.1,
          });
        });
      }
    }
  }

  return pdfDoc.save();
}

/** Trigger browser download of a Uint8Array as a file */
export function downloadBlob(data: Uint8Array, filename: string) {
  const blob = new Blob([data as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
