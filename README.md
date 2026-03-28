# PDF Edit

A browser-based PDF editor built with React and TypeScript. Upload a PDF and annotate it directly in the browser — draw, add text, insert images, sign, erase, OCR-edit existing text, and export the result as a new PDF.

## Features

- **Upload PDF** — Drag-and-drop or click to open any PDF file
- **Open New File** — Switch to a different PDF at any time via the toolbar
- **Freehand Drawing** — Draw on pages with configurable brush color and width
- **Text Annotations** — Click anywhere to place editable text
- **Image Overlay** — Insert images from your computer onto any page
- **Signature** — Draw a signature in a modal and stamp it on the document
- **Eraser** — Click any annotation to delete it
- **Pan / Drag** — Hand tool for scrolling around when zoomed in
- **OCR Text Editing** — Run OCR (Tesseract.js) on a page to detect text, then click any detected line to edit and replace it
- **Undo / Redo** — Step back and forward through your annotation history
- **Zoom** — Zoom in/out (25%–300%)
- **Multi-Page** — Navigate between pages; annotations are saved per page
- **Export** — Download the annotated PDF with all changes baked in

## Tech Stack

| Layer | Library |
|-------|---------|
| Framework | React 19 + TypeScript |
| Build | Vite |
| PDF Rendering | react-pdf (pdfjs-dist) |
| Annotation Canvas | Fabric.js 7 |
| Signature Capture | react-signature-canvas + signature_pad |
| PDF Export | pdf-lib |
| OCR | Tesseract.js 7 |
| Icons | Lucide React |

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** (comes with Node.js)

### Install & Run

```bash
# Clone the repo
git clone https://github.com/lutasam/pdf-edit.git
cd pdf-edit

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

### Build for Production

```bash
npm run build
npm run preview   # preview the production build locally
```

## How to Use

1. **Open a PDF** — Drop a PDF onto the upload screen, or click to browse. Once loaded, use the **Open** button in the toolbar to switch files.

2. **Draw** — Select the pencil tool, pick a color and brush width, then draw freely on the page.

3. **Add Text** — Select the text tool and click on the page. An editable text box appears at the click position.

4. **Insert Image** — Select the image tool, pick an image file, and it will be placed on the page. Drag to reposition, resize with handles.

5. **Sign** — Click the signature tool to open the signature pad. Draw your signature, then click Apply to stamp it on the page.

6. **Erase** — Select the eraser tool and click any annotation object to delete it.

7. **Pan** — Select the hand tool, then click-and-drag to scroll around the page (useful when zoomed in).

8. **OCR Edit** — Click the OCR tool to scan the current page for text. Detected lines appear as highlighted regions. Click a line to open an editor where you can modify the text. Click Apply to replace the original text on the canvas.

9. **Undo / Redo** — Use the undo/redo buttons to step through your changes.

10. **Navigate Pages** — Use the left/right arrows or the page indicator to move between pages. Annotations are saved automatically when switching pages.

11. **Zoom** — Use the +/− buttons to zoom in or out.

12. **Export** — Click **Export** to download the PDF with all your annotations embedded.

## License

MIT