# @flyfish-dev/html2pdf-js

TypeScript browser component for exporting business HTML pages to high-fidelity PDF files.

It is designed for reports, proposals, invoices, statements, contracts, approval documents, and other page-based business documents.

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
  scale: 2.5,
  imageType: 'jpeg',
  imageQuality: 0.96,
  useCORS: true,
  pagedScriptUrl: '/vendor/paged.polyfill.js'
});

await exporter.download('#report');
```

## API

- `download(source, options?)`: generate and download a PDF.
- `toPdf(source, options?)`: return a `jsPDF` instance.
- `outputBlob(source, options?)`: return a `Blob` for upload or custom storage.
- `nativePrint(source, options?)`: open the browser print flow.
- `createPagedFrame(source, options?)`: create the paged iframe for debugging.

`source` can be a CSS selector string or an `HTMLElement`.

## Paged.js

The package includes a pinned Paged.js browser polyfill at:

```text
@flyfish-dev/html2pdf-js/vendor/paged.polyfill.js
```

For production apps, copy that file into your static assets and pass its public URL through `pagedScriptUrl`.

## License

AGPL-3.0-only. See [LICENSE](./LICENSE).
