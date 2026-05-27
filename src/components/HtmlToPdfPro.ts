import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export type HtmlToPdfSource = string | HTMLElement;
export type HtmlToPdfImageType = 'jpeg' | 'png';
export type HtmlToPdfOrientation = 'portrait' | 'landscape';
export type HtmlToPdfPageFormat = 'a4' | 'letter' | 'legal' | string;

export type HtmlToPdfProgressPhase =
  | 'clone'
  | 'assets'
  | 'pagedjs'
  | 'paginated'
  | 'render-start'
  | 'render-page'
  | 'render-complete'
  | 'save';

export interface HtmlToPdfPageOptions {
  /** Built-in: a4 / letter / legal. Custom names are ignored unless widthMm and heightMm are provided. */
  format?: HtmlToPdfPageFormat;
  /** Custom page width, millimetres. */
  widthMm?: number;
  /** Custom page height, millimetres. */
  heightMm?: number;
  orientation?: HtmlToPdfOrientation;
}

export interface HtmlToPdfProgressEvent {
  phase: HtmlToPdfProgressPhase;
  message?: string;
  page?: number;
  totalPages?: number;
  ratio?: number;
  filename?: string;
  flow?: unknown;
}

export type HtmlToPdfProgressHandler = (event: HtmlToPdfProgressEvent) => void;

export interface HtmlToPdfProOptions {
  filename?: string;
  page?: HtmlToPdfPageOptions;
  /** CSS @page margin shorthand, for example: 18mm 14mm 19mm 14mm. */
  margin?: string;
  /** html2canvas scale. Higher means sharper but heavier. Defaults to devicePixelRatio clamped to 2~3. */
  scale?: number | null;
  imageType?: HtmlToPdfImageType;
  imageQuality?: number;
  backgroundColor?: string;
  useCORS?: boolean;
  allowTaint?: boolean;
  foreignObjectRendering?: boolean;
  removeContainer?: boolean;
  /** Keep the hidden iframe in DOM for debugging paged output. */
  debug?: boolean;
  /** Paged.js browser polyfill URL. Prefer a pinned self-hosted URL in production. */
  pagedScriptUrl?: string;
  /** Extra CSS injected into the render iframe after page CSS is collected. */
  extraCss?: string;
  timeoutMs?: number;
  onProgress?: HtmlToPdfProgressHandler;
}

export interface ResolvedHtmlToPdfProOptions {
  filename: string;
  page: Required<Pick<HtmlToPdfPageOptions, 'widthMm' | 'heightMm'>> & HtmlToPdfPageOptions;
  margin: string;
  scale: number;
  imageType: HtmlToPdfImageType;
  imageQuality: number;
  backgroundColor: string;
  useCORS: boolean;
  allowTaint: boolean;
  foreignObjectRendering: boolean;
  removeContainer: boolean;
  debug: boolean;
  pagedScriptUrl: string;
  extraCss: string;
  timeoutMs: number;
  onProgress: HtmlToPdfProgressHandler;
}

export interface PagedFrameResult {
  iframe: HTMLIFrameElement;
  window: Window;
  document: Document;
  flow: unknown;
  pages: HTMLElement[];
  options: ResolvedHtmlToPdfProOptions;
}

type PagedWindow = Window &
  typeof globalThis & {
    PagedPolyfill?: {
      preview: () => unknown | Promise<unknown>;
    };
  };

const PAGE_SIZES_MM: Record<string, readonly [number, number]> = {
  a4: [210, 297],
  letter: [215.9, 279.4],
  legal: [215.9, 355.6]
};

const DEFAULT_OPTIONS: ResolvedHtmlToPdfProOptions = {
  filename: 'document.pdf',
  page: {
    format: 'a4',
    widthMm: 210,
    heightMm: 297,
    orientation: 'portrait'
  },
  margin: '18mm 14mm 18mm 14mm',
  scale: 0,
  imageType: 'jpeg',
  imageQuality: 0.96,
  backgroundColor: '#ffffff',
  useCORS: true,
  allowTaint: false,
  foreignObjectRendering: false,
  removeContainer: true,
  debug: false,
  pagedScriptUrl: 'https://unpkg.com/pagedjs@0.4.3/dist/paged.polyfill.js',
  extraCss: '',
  timeoutMs: 15000,
  onProgress: () => undefined
};

function isElement(value: unknown): value is HTMLElement {
  return value instanceof HTMLElement;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function deepMerge<T extends Record<string, unknown>>(target: T, ...sources: Array<Partial<T> | undefined>): T {
  const output: Record<string, unknown> = { ...target };

  for (const source of sources) {
    if (!source) continue;

    for (const [key, value] of Object.entries(source)) {
      const current = output[key];
      if (isPlainObject(current) && isPlainObject(value)) {
        output[key] = deepMerge(current, value);
      } else if (value !== undefined) {
        output[key] = value;
      }
    }
  }

  return output as T;
}

function mmToPt(mm: number): number {
  return (mm * 72) / 25.4;
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(value: unknown): string {
  return escapeHtml(value).replace(/`/g, '&#096;');
}

function nextFrame(win: Window): Promise<void> {
  return new Promise((resolve) => {
    win.requestAnimationFrame(() => {
      win.requestAnimationFrame(() => resolve());
    });
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function normalizePage(page?: HtmlToPdfPageOptions): ResolvedHtmlToPdfProOptions['page'] {
  const normalized = { ...DEFAULT_OPTIONS.page, ...(page ?? {}) };
  const format = String(normalized.format ?? '').toLowerCase();
  const size = PAGE_SIZES_MM[format];

  if (size) {
    normalized.widthMm = size[0];
    normalized.heightMm = size[1];
  }

  if (normalized.orientation === 'landscape') {
    const max = Math.max(normalized.widthMm, normalized.heightMm);
    const min = Math.min(normalized.widthMm, normalized.heightMm);
    normalized.widthMm = max;
    normalized.heightMm = min;
  } else {
    const min = Math.min(normalized.widthMm, normalized.heightMm);
    const max = Math.max(normalized.widthMm, normalized.heightMm);
    normalized.widthMm = min;
    normalized.heightMm = max;
  }

  return normalized;
}

function getTarget(source: HtmlToPdfSource): HTMLElement {
  if (typeof source === 'string') {
    const selected = document.querySelector<HTMLElement>(source);
    if (!selected) throw new Error(`Cannot find source element: ${source}`);
    return selected;
  }

  if (!isElement(source)) {
    throw new TypeError('source must be a selector string or an HTMLElement');
  }

  return source;
}

function cloneNodeWithState(source: HTMLElement): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement;

  const sourceFields = source.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select');
  const cloneFields = clone.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select');

  sourceFields.forEach((field, index) => {
    const cloned = cloneFields[index];
    if (!cloned) return;

    if (field instanceof HTMLTextAreaElement && cloned instanceof HTMLTextAreaElement) {
      cloned.value = field.value;
      cloned.textContent = field.value;
      return;
    }

    if (field instanceof HTMLSelectElement && cloned instanceof HTMLSelectElement) {
      cloned.value = field.value;
      Array.from(cloned.options).forEach((option) => {
        option.selected = option.value === field.value;
      });
      return;
    }

    if (field instanceof HTMLInputElement && cloned instanceof HTMLInputElement) {
      if (field.type === 'checkbox' || field.type === 'radio') {
        cloned.checked = field.checked;
        if (field.checked) cloned.setAttribute('checked', 'checked');
        else cloned.removeAttribute('checked');
      } else {
        cloned.value = field.value;
        cloned.setAttribute('value', field.value);
      }
    }
  });

  const sourceCanvases = source.querySelectorAll<HTMLCanvasElement>('canvas');
  const cloneCanvases = clone.querySelectorAll<HTMLCanvasElement>('canvas');

  sourceCanvases.forEach((canvas, index) => {
    const clonedCanvas = cloneCanvases[index];
    if (!clonedCanvas || !clonedCanvas.parentNode) return;

    try {
      const img = document.createElement('img');
      img.src = canvas.toDataURL('image/png');
      img.width = canvas.width;
      img.height = canvas.height;
      img.style.cssText = clonedCanvas.getAttribute('style') || '';
      img.className = clonedCanvas.className;
      clonedCanvas.parentNode.replaceChild(img, clonedCanvas);
    } catch {
      // A tainted canvas cannot be serialized. Keep the cloned canvas as-is.
    }
  });

  return clone;
}

function collectDocumentStyles(): string {
  const result: string[] = [];
  const nodes = document.querySelectorAll<HTMLStyleElement | HTMLLinkElement>('style, link[rel~="stylesheet"]');

  nodes.forEach((node) => {
    if (node instanceof HTMLStyleElement) {
      result.push(node.outerHTML);
      return;
    }

    const href = node.getAttribute('href');
    if (!href) return;

    const absoluteHref = new URL(href, document.baseURI).href;
    const media = node.getAttribute('media');
    const crossOrigin = node.getAttribute('crossorigin');

    result.push(
      `<link rel="stylesheet" href="${escapeAttr(absoluteHref)}"` +
        (media ? ` media="${escapeAttr(media)}"` : '') +
        (crossOrigin ? ` crossorigin="${escapeAttr(crossOrigin)}"` : '') +
        '>'
    );
  });

  return result.join('\n');
}

function basePagedCss(options: ResolvedHtmlToPdfProOptions): string {
  const page = options.page;
  return [
    '<style data-html-to-pdf-pro="base">',
    `@page { size: ${page.widthMm}mm ${page.heightMm}mm; margin: ${options.margin}; }`,
    'html, body { margin: 0; padding: 0; background: #fff; }',
    'body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }',
    'img, svg, canvas, video { max-width: 100%; }',
    '.pdf-avoid-break, .avoid-break, figure, pre, blockquote, .card, .panel { break-inside: avoid; page-break-inside: avoid; }',
    '.pdf-page-break { break-before: page; page-break-before: always; }',
    'table { border-collapse: collapse; }',
    'thead { display: table-header-group; }',
    'tfoot { display: table-footer-group; }',
    'tr { break-inside: avoid; page-break-inside: avoid; }',
    '.pagedjs_pages { display: block !important; }',
    '.pagedjs_page { background: #fff !important; box-shadow: none !important; margin: 0 auto !important; overflow: hidden !important; }',
    '.pagedjs_pagebox { box-shadow: none !important; }',
    '</style>'
  ].join('\n');
}

function waitForStylesheets(doc: Document, timeoutMs: number): Promise<void> {
  const links = Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"]'));
  if (!links.length) return Promise.resolve();

  return Promise.all(
    links.map((link) => {
      if (link.sheet) return Promise.resolve();

      return new Promise<void>((resolve) => {
        const done = () => resolve();
        link.addEventListener('load', done, { once: true });
        link.addEventListener('error', done, { once: true });
        setTimeout(done, timeoutMs || 3000);
      });
    })
  ).then(() => undefined);
}

function waitForFontsAndImages(win: Window, doc: Document, timeoutMs: number): Promise<void> {
  const fontPromise = doc.fonts?.ready?.catch(() => undefined) ?? Promise.resolve();
  const images = Array.from(doc.images || []);
  const imagePromise = Promise.all(
    images.map((img) => {
      if (img.complete && img.naturalWidth !== 0) return Promise.resolve();
      if (img.decode) return img.decode().catch(() => undefined);

      return new Promise<void>((resolve) => {
        const done = () => resolve();
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
        setTimeout(done, timeoutMs || 3000);
      });
    })
  );

  return Promise.all([fontPromise, imagePromise]).then(() => nextFrame(win));
}

function loadScript(doc: Document, src: string, timeoutMs: number): Promise<void> {
  return withTimeout(
    new Promise<void>((resolve, reject) => {
      const script = doc.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      doc.head.appendChild(script);
    }),
    timeoutMs,
    `Loading ${src}`
  );
}

function createIframe(options: ResolvedHtmlToPdfProOptions): HTMLIFrameElement {
  const iframe = document.createElement('iframe');
  iframe.title = 'HtmlToPdfPro render frame';
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.left = '-100000px';
  iframe.style.top = '0';
  iframe.style.width = `${Math.ceil(options.page.widthMm + 30)}mm`;
  iframe.style.height = `${Math.ceil(options.page.heightMm + 30)}mm`;
  iframe.style.border = '0';
  iframe.style.background = '#fff';
  iframe.style.zIndex = '-1';
  document.body.appendChild(iframe);
  return iframe;
}

function pageOrientation(options: ResolvedHtmlToPdfProOptions): HtmlToPdfOrientation {
  return options.page.widthMm > options.page.heightMm ? 'landscape' : 'portrait';
}

/**
 * Professional browser-side HTML to PDF exporter.
 *
 * Pipeline:
 * 1. Clone the target DOM and current document styles into an isolated iframe.
 * 2. Use Paged.js to apply CSS Paged Media rules and create page DOM.
 * 3. Rasterize each page with html2canvas.
 * 4. Pack the pages into a jsPDF document.
 */
export class HtmlToPdfPro {
  private readonly defaultOptions: ResolvedHtmlToPdfProOptions;

  constructor(defaultOptions: HtmlToPdfProOptions = {}) {
    this.defaultOptions = this.resolveOptions(defaultOptions);
  }

  public resolveOptions(options: HtmlToPdfProOptions = {}): ResolvedHtmlToPdfProOptions {
    const merged = deepMerge(
      DEFAULT_OPTIONS as unknown as Record<string, unknown>,
      this.defaultOptions as unknown as Record<string, unknown>,
      options as Record<string, unknown>
    ) as unknown as ResolvedHtmlToPdfProOptions;

    merged.page = normalizePage(merged.page);
    merged.scale = merged.scale || Math.min(3, Math.max(2, window.devicePixelRatio || 2));
    merged.onProgress = typeof merged.onProgress === 'function' ? merged.onProgress : () => undefined;
    return merged;
  }

  public async createPagedFrame(source: HtmlToPdfSource, options: HtmlToPdfProOptions = {}): Promise<PagedFrameResult> {
    const opt = this.resolveOptions(options);
    const target = getTarget(source);
    const clone = cloneNodeWithState(target);
    const iframe = createIframe(opt);
    const win = iframe.contentWindow as PagedWindow | null;
    const doc = iframe.contentDocument;

    if (!win || !doc) {
      throw new Error('Cannot access render iframe document.');
    }

    this.emit(opt, 'clone', { message: 'Clone DOM and collect styles' });

    doc.open();
    doc.write(
      [
        '<!doctype html>',
        '<html>',
        '<head>',
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        `<base href="${escapeAttr(document.baseURI)}">`,
        '<script>window.PagedConfig = { auto: false };<\/script>',
        basePagedCss(opt),
        collectDocumentStyles(),
        opt.extraCss ? `<style data-html-to-pdf-pro="extra">${opt.extraCss}</style>` : '',
        '</head>',
        '<body><main id="html-to-pdf-pro-root"></main></body>',
        '</html>'
      ].join('\n')
    );
    doc.close();

    doc.getElementById('html-to-pdf-pro-root')?.appendChild(doc.importNode(clone, true));

    this.emit(opt, 'assets', { message: 'Wait for CSS, fonts and images' });
    await waitForStylesheets(doc, Math.min(5000, opt.timeoutMs));
    await waitForFontsAndImages(win, doc, Math.min(5000, opt.timeoutMs));

    this.emit(opt, 'pagedjs', { message: 'Load Paged.js and paginate' });
    if (!win.PagedPolyfill) {
      await loadScript(doc, opt.pagedScriptUrl, opt.timeoutMs);
    }

    if (!win.PagedPolyfill || typeof win.PagedPolyfill.preview !== 'function') {
      throw new Error('Paged.js did not expose window.PagedPolyfill.preview().');
    }

    const flow = await withTimeout(Promise.resolve(win.PagedPolyfill.preview()), opt.timeoutMs, 'Paged.js preview');
    await nextFrame(win);

    const pages = Array.from(doc.querySelectorAll<HTMLElement>('.pagedjs_page'));
    if (!pages.length) {
      throw new Error('Paged.js produced no pages. Check your source element and @page CSS.');
    }

    this.emit(opt, 'paginated', {
      message: 'Pagination complete',
      totalPages: pages.length,
      flow
    });

    return { iframe, window: win, document: doc, flow, pages, options: opt };
  }

  public async toPdf(source: HtmlToPdfSource, options: HtmlToPdfProOptions = {}): Promise<jsPDF> {
    const opt = this.resolveOptions(options);
    const frameResult = await this.createPagedFrame(source, opt);
    const { iframe, document: doc, window: frameWindow } = frameResult;
    const pages = Array.from(doc.querySelectorAll<HTMLElement>('.pagedjs_page'));
    const pageWidthPt = mmToPt(opt.page.widthMm);
    const pageHeightPt = mmToPt(opt.page.heightMm);
    const orientation = pageOrientation(opt);

    const pdf = new jsPDF({
      orientation,
      unit: 'pt',
      format: [pageWidthPt, pageHeightPt],
      compress: true,
      putOnlyUsedFonts: true
    });

    this.emit(opt, 'render-start', { totalPages: pages.length });

    try {
      for (const [index, page] of pages.entries()) {
        page.scrollIntoView();
        await nextFrame(frameWindow);

        const rect = page.getBoundingClientRect();
        const canvas = await html2canvas(page, {
          backgroundColor: opt.backgroundColor,
          scale: opt.scale,
          useCORS: opt.useCORS,
          allowTaint: opt.allowTaint,
          foreignObjectRendering: opt.foreignObjectRendering,
          logging: false,
          windowWidth: Math.ceil(rect.width),
          windowHeight: Math.ceil(rect.height),
          scrollX: 0,
          scrollY: 0
        });

        const mime = opt.imageType === 'png' ? 'image/png' : 'image/jpeg';
        const format = opt.imageType === 'png' ? 'PNG' : 'JPEG';
        const dataUrl = canvas.toDataURL(mime, opt.imageQuality);

        if (index > 0) pdf.addPage([pageWidthPt, pageHeightPt], orientation);
        pdf.addImage(dataUrl, format, 0, 0, pageWidthPt, pageHeightPt, undefined, 'FAST');

        this.emit(opt, 'render-page', {
          page: index + 1,
          totalPages: pages.length,
          ratio: (index + 1) / pages.length
        });
      }

      this.emit(opt, 'render-complete', { totalPages: pages.length });
      return pdf;
    } finally {
      if (opt.removeContainer && !opt.debug && iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    }
  }

  public async download(source: HtmlToPdfSource, options: HtmlToPdfProOptions = {}): Promise<jsPDF> {
    const opt = this.resolveOptions(options);
    const pdf = await this.toPdf(source, opt);
    pdf.save(opt.filename);
    this.emit(opt, 'save', { filename: opt.filename });
    return pdf;
  }

  public async outputBlob(source: HtmlToPdfSource, options: HtmlToPdfProOptions = {}): Promise<Blob> {
    const pdf = await this.toPdf(source, options);
    return pdf.output('blob');
  }

  public async nativePrint(source: HtmlToPdfSource, options: HtmlToPdfProOptions = {}): Promise<PagedFrameResult> {
    const opt = this.resolveOptions({ debug: true, removeContainer: false, ...options });
    const frameResult = await this.createPagedFrame(source, opt);
    const { iframe, window: frameWindow } = frameResult;

    const cleanup = () => {
      if (opt.removeContainer && !opt.debug && iframe.parentNode) iframe.parentNode.removeChild(iframe);
    };

    frameWindow.addEventListener('afterprint', cleanup, { once: true });
    frameWindow.focus();
    frameWindow.print();
    return frameResult;
  }

  private emit(options: ResolvedHtmlToPdfProOptions, phase: HtmlToPdfProgressPhase, payload: Omit<HtmlToPdfProgressEvent, 'phase'> = {}): void {
    options.onProgress({ phase, ...payload });
  }
}

export function createHtmlToPdfPro(options?: HtmlToPdfProOptions): HtmlToPdfPro {
  return new HtmlToPdfPro(options);
}
