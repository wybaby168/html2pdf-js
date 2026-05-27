# @flyfish-dev/html2pdf-js

Self-contained TypeScript HTML to PDF engine for browser applications. It exports high-fidelity visual PDF pages and overlays an invisible selectable Unicode text layer so generated files remain copyable and searchable.

This package does **not** depend on IronPress, html2canvas, jsPDF, Paged.js, Puppeteer, or the browser print dialog.

## Install

```bash
pnpm add @flyfish-dev/html2pdf-js
```

or:

```bash
npm install @flyfish-dev/html2pdf-js
```

## Usage

```ts
import { HtmlToPdfPro } from '@flyfish-dev/html2pdf-js';

const exporter = new HtmlToPdfPro({
  filename: 'report.pdf',
  page: { format: 'a4' },
  margin: '18mm 14mm 19mm 14mm',
  dpi: 192,
  imageQuality: 0.96,
  fitToPage: true,
  textLayer: true,
  linkAnnotations: true,
  bookmarks: true,
  footer: 'Page {page} of {pages}'
});

await exporter.download('#report');
```

## API

- `download(source, options?)`: generate and download a PDF.
- `toPdf(source, options?)`: return PDF bytes as `Uint8Array`.
- `outputBlob(source, options?)`: return a PDF `Blob`.
- `fromHtml(html, options?)` / `downloadHtml(html, options?)`: render an HTML string.
- `fromMarkdown(markdown, options?)` / `downloadMarkdown(markdown, options?)`: render Markdown through the same HTML pipeline.
- `serialize(source, options?)`: export the standalone HTML snapshot used by the engine.

`source` can be a CSS selector string, an `HTMLElement`, an HTML source object, or a Markdown source object.

## Engine

The default engine is `dom-canvas-text`:

1. Clone DOM and preserve form/canvas state.
2. Collect CSS and inline assets where possible.
3. Measure layout with the browser's native engine.
4. Compute page slices with built-in pagination rules.
5. Render each page visually with the built-in DOM Canvas Painter, without html2canvas or SVG foreignObject screenshots.
6. Extract text boxes with `Range.getClientRects()` per grapheme so wrapped CJK/continuous text does not lose characters.
7. Write the PDF directly with image XObjects, topmost invisible selectable Unicode text layer, link annotations, and bookmarks.

## Verification

The repository test suite generates PDFs in real Chromium and validates them with `pdfinfo`, `pdftotext`, `pdftotext -bbox`, and `pdftohtml -xml`. It covers the basic smoke case, the full business demo, and a complex-elements case with wrapped CJK text, inline content, grid/list/table, form controls, and pre/code blocks.

## License

AGPL-3.0-only. See [LICENSE](./LICENSE).
