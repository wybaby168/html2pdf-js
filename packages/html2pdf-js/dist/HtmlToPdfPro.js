const PAGE_SIZES_MM = {
    a4: [210, 297],
    letter: [215.9, 279.4],
    legal: [215.9, 355.6]
};
const DEFAULT_OPTIONS = {
    filename: 'document.pdf',
    page: {
        format: 'a4',
        widthMm: 210,
        heightMm: 297,
        orientation: 'portrait'
    },
    margin: '18mm 14mm 18mm 14mm',
    dpi: 180,
    imageType: 'jpeg',
    imageQuality: 0.94,
    backgroundColor: '#ffffff',
    fitToPage: true,
    bleedPx: 24,
    pageBreakMode: 'avoid',
    avoidBreakSelectors: '.avoid-break,.pdf-avoid-break,figure,table,thead,tr,.card,.hero,.chart,.timeline,.checklist,pre,blockquote',
    forceBreakBeforeSelectors: '.pdf-page-break,[data-pdf-page-break="before"]',
    collectStyles: true,
    includeExternalStylesheets: true,
    inlineImages: true,
    inlineCanvas: true,
    inlineCssResources: false,
    materializePseudoElements: true,
    sanitize: true,
    textLayer: true,
    linkAnnotations: true,
    bookmarks: true,
    extraCss: '',
    fontFaces: [],
    timeoutMs: 20000,
    resourceErrorMode: 'warn',
    engine: 'dom-canvas-text',
    onProgress: () => undefined
};
const SVG_NS = 'http://www.w3.org/2000/svg';
const XHTML_NS = 'http://www.w3.org/1999/xhtml';
function isElement(value) {
    return value instanceof HTMLElement;
}
function isHtmlSource(value) {
    return typeof value === 'object' && value !== null && value.type === 'html';
}
function isMarkdownSource(value) {
    return typeof value === 'object' && value !== null && value.type === 'markdown';
}
function isPlainObject(value) {
    return Object.prototype.toString.call(value) === '[object Object]';
}
function deepMerge(target, ...sources) {
    const output = { ...target };
    for (const source of sources) {
        if (!source)
            continue;
        for (const [key, value] of Object.entries(source)) {
            const current = output[key];
            if (isPlainObject(current) && isPlainObject(value)) {
                output[key] = deepMerge(current, value);
            }
            else if (Array.isArray(value)) {
                output[key] = [...value];
            }
            else if (value !== undefined) {
                output[key] = value;
            }
        }
    }
    return output;
}
function normalizeHeaderFooter(value) {
    if (!value)
        return undefined;
    if (typeof value === 'string') {
        return { text: value, position: 'center', fontSizePx: 10, color: '#4b5563' };
    }
    return {
        position: 'center',
        fontSizePx: 10,
        color: '#4b5563',
        ...value
    };
}
function normalizeOptions(options) {
    const merged = deepMerge(DEFAULT_OPTIONS, options);
    merged.page = normalizePage(options?.page ?? merged.page);
    merged.header = normalizeHeaderFooter(options?.header ?? merged.header);
    merged.footer = normalizeHeaderFooter(options?.footer ?? merged.footer);
    merged.dpi = clampNumber(merged.dpi, 96, 360, DEFAULT_OPTIONS.dpi);
    merged.imageQuality = clampNumber(merged.imageQuality, 0.3, 1, DEFAULT_OPTIONS.imageQuality);
    merged.bleedPx = clampNumber(merged.bleedPx, 0, 120, DEFAULT_OPTIONS.bleedPx);
    merged.fontFaces = Array.isArray(merged.fontFaces) ? merged.fontFaces : [];
    merged.extraCss = merged.extraCss ?? '';
    return merged;
}
function clampNumber(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n))
        return fallback;
    return Math.min(max, Math.max(min, n));
}
function normalizePage(page) {
    const normalized = { ...DEFAULT_OPTIONS.page, ...(page ?? {}) };
    const format = String(normalized.format ?? '').toLowerCase();
    const size = PAGE_SIZES_MM[format];
    if (size) {
        normalized.widthMm = size[0];
        normalized.heightMm = size[1];
    }
    if (!normalized.widthMm || !normalized.heightMm) {
        normalized.widthMm = DEFAULT_OPTIONS.page.widthMm;
        normalized.heightMm = DEFAULT_OPTIONS.page.heightMm;
    }
    if (normalized.orientation === 'landscape') {
        const max = Math.max(normalized.widthMm, normalized.heightMm);
        const min = Math.min(normalized.widthMm, normalized.heightMm);
        normalized.widthMm = max;
        normalized.heightMm = min;
    }
    else {
        const min = Math.min(normalized.widthMm, normalized.heightMm);
        const max = Math.max(normalized.widthMm, normalized.heightMm);
        normalized.widthMm = min;
        normalized.heightMm = max;
    }
    return normalized;
}
function mmToPx(mm) {
    return (mm * 96) / 25.4;
}
function mmToPt(mm) {
    return (mm * 72) / 25.4;
}
function pxToPt(px, pageWidthPx, pageWidthPt) {
    return (px / pageWidthPx) * pageWidthPt;
}
function parseCssLengthToPx(raw) {
    const value = raw.trim().toLowerCase();
    const n = Number.parseFloat(value);
    if (!Number.isFinite(n))
        return 0;
    if (value.endsWith('mm'))
        return mmToPx(n);
    if (value.endsWith('cm'))
        return mmToPx(n * 10);
    if (value.endsWith('in'))
        return n * 96;
    if (value.endsWith('pt'))
        return (n * 96) / 72;
    if (value.endsWith('pc'))
        return n * 16;
    return n;
}
function parseMargin(value) {
    const parts = value.trim().split(/\s+/).filter(Boolean);
    const values = parts.length ? parts.map(parseCssLengthToPx) : [0];
    const [top, right = top, bottom = top, left = right] = values;
    return { top, right, bottom, left };
}
function createPageMetrics(options) {
    const widthMm = options.page.widthMm;
    const heightMm = options.page.heightMm;
    const widthPx = mmToPx(widthMm);
    const heightPx = mmToPx(heightMm);
    const margin = parseMargin(options.margin);
    return {
        widthMm,
        heightMm,
        widthPx,
        heightPx,
        widthPt: mmToPt(widthMm),
        heightPt: mmToPt(heightMm),
        contentWidthPx: Math.max(1, widthPx - margin.left - margin.right),
        contentHeightPx: Math.max(1, heightPx - margin.top - margin.bottom),
        margin
    };
}
function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
function escapeCssString(value) {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
function cssTextFromDeclaration(style) {
    const declarations = [];
    for (let i = 0; i < style.length; i += 1) {
        const prop = style.item(i);
        declarations.push(`${prop}:${style.getPropertyValue(prop)}${style.getPropertyPriority(prop) ? ' !important' : ''};`);
    }
    return declarations.join('');
}
function nextFrame(win = window) {
    return new Promise((resolve) => {
        win.requestAnimationFrame(() => win.requestAnimationFrame(() => resolve()));
    });
}
function withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => {
        if (timer)
            clearTimeout(timer);
    });
}
function dataUrlToBytes(dataUrl) {
    const match = /^data:([^;,]+)(;base64)?,(.*)$/i.exec(dataUrl);
    if (!match)
        throw new Error('Invalid data URL.');
    const mime = match[1];
    const isBase64 = Boolean(match[2]);
    const payload = match[3];
    const binary = isBase64 ? atob(payload) : decodeURIComponent(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1)
        bytes[i] = binary.charCodeAt(i) & 0xff;
    return { mime, bytes };
}
async function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob.'));
        reader.readAsDataURL(blob);
    });
}
async function fetchAsDataUrl(url, baseUrl) {
    const absolute = new URL(url, baseUrl ?? document.baseURI).toString();
    const response = await fetch(absolute, { credentials: 'same-origin' });
    if (!response.ok)
        throw new Error(`Failed to fetch resource: ${absolute}`);
    return blobToDataUrl(await response.blob());
}
function handleResourceError(error, options) {
    if (options.resourceErrorMode === 'throw') {
        throw error instanceof Error ? error : new Error(String(error));
    }
    if (options.resourceErrorMode === 'warn') {
        console.warn('[HtmlToPdfPro] Resource inline failed:', error);
    }
}
function collectTextNodes(root) {
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if (!node.nodeValue || !node.nodeValue.trim())
                return NodeFilter.FILTER_REJECT;
            const parent = node.parentElement;
            if (!parent)
                return NodeFilter.FILTER_REJECT;
            const computed = window.getComputedStyle(parent);
            if (computed.display === 'none' || computed.visibility === 'hidden' || computed.opacity === '0') {
                return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
        }
    });
    while (walker.nextNode())
        nodes.push(walker.currentNode);
    return nodes;
}
function segmentText(value) {
    const Segmenter = Intl.Segmenter;
    if (Segmenter) {
        return Array.from(new Segmenter(undefined, { granularity: 'grapheme' }).segment(value), (part) => part.segment);
    }
    return Array.from(value);
}
function isRenderableWhitespace(value) {
    return /\s/.test(value);
}
function safeFileName(filename) {
    return filename.trim() || 'document.pdf';
}
function pdfNumber(value) {
    if (!Number.isFinite(value))
        return '0';
    return Number(value.toFixed(3)).toString();
}
function escapePdfLiteral(value) {
    return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/\r/g, '\\r').replace(/\n/g, '\\n');
}
function utf16BeHex(value) {
    const units = [0xfe, 0xff];
    for (let i = 0; i < value.length; i += 1) {
        const code = value.charCodeAt(i);
        units.push((code >> 8) & 0xff, code & 0xff);
    }
    return units.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join('');
}
function utf16BeHexWithoutBom(value) {
    const units = [];
    for (let i = 0; i < value.length; i += 1) {
        const code = value.charCodeAt(i);
        units.push((code >> 8) & 0xff, code & 0xff);
    }
    return units.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join('');
}
function escapeHtmlTextToInlineMarkdown(value) {
    return escapeHtml(value)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}
function markdownToHtml(markdown) {
    const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
    const html = [];
    let paragraph = [];
    let inList = false;
    let inCode = false;
    let code = [];
    const flushParagraph = () => {
        if (!paragraph.length)
            return;
        html.push(`<p>${escapeHtmlTextToInlineMarkdown(paragraph.join(' '))}</p>`);
        paragraph = [];
    };
    const closeList = () => {
        if (inList) {
            html.push('</ul>');
            inList = false;
        }
    };
    for (const line of lines) {
        if (/^```/.test(line.trim())) {
            if (inCode) {
                html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
                code = [];
                inCode = false;
            }
            else {
                flushParagraph();
                closeList();
                inCode = true;
            }
            continue;
        }
        if (inCode) {
            code.push(line);
            continue;
        }
        const trimmed = line.trim();
        if (!trimmed) {
            flushParagraph();
            closeList();
            continue;
        }
        const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
        if (heading) {
            flushParagraph();
            closeList();
            const level = heading[1].length;
            html.push(`<h${level}>${escapeHtmlTextToInlineMarkdown(heading[2])}</h${level}>`);
            continue;
        }
        const item = /^[-*+]\s+(.+)$/.exec(trimmed);
        if (item) {
            flushParagraph();
            if (!inList) {
                html.push('<ul>');
                inList = true;
            }
            html.push(`<li>${escapeHtmlTextToInlineMarkdown(item[1])}</li>`);
            continue;
        }
        if (trimmed.startsWith('>')) {
            flushParagraph();
            closeList();
            html.push(`<blockquote>${escapeHtmlTextToInlineMarkdown(trimmed.replace(/^>\s?/, ''))}</blockquote>`);
            continue;
        }
        paragraph.push(trimmed);
    }
    flushParagraph();
    closeList();
    if (inCode)
        html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
    return html.join('\n');
}
function createElementFromHtml(html) {
    const container = document.createElement('div');
    container.className = 'html-to-pdf-pro-html-source';
    container.innerHTML = html;
    return container;
}
function getSourceElement(source) {
    if (isElement(source))
        return source;
    if (isHtmlSource(source))
        return createElementFromHtml(source.html);
    if (isMarkdownSource(source))
        return createElementFromHtml(markdownToHtml(source.markdown));
    const trimmed = source.trim();
    if (trimmed.startsWith('<'))
        return createElementFromHtml(trimmed);
    const target = document.querySelector(source);
    if (!target)
        throw new Error(`Unable to find element for selector: ${source}`);
    return target;
}
function syncElementState(source, clone) {
    if (source instanceof HTMLInputElement && clone instanceof HTMLInputElement) {
        clone.value = source.value;
        clone.checked = source.checked;
        if (source.checked)
            clone.setAttribute('checked', '');
        else
            clone.removeAttribute('checked');
        clone.setAttribute('value', source.value);
    }
    else if (source instanceof HTMLTextAreaElement && clone instanceof HTMLTextAreaElement) {
        clone.value = source.value;
        clone.textContent = source.value;
    }
    else if (source instanceof HTMLSelectElement && clone instanceof HTMLSelectElement) {
        clone.value = source.value;
        Array.from(clone.options).forEach((option, index) => {
            option.selected = source.options[index]?.selected ?? false;
            if (option.selected)
                option.setAttribute('selected', '');
            else
                option.removeAttribute('selected');
        });
    }
    else if (source instanceof HTMLCanvasElement && clone instanceof HTMLCanvasElement) {
        try {
            clone.width = source.width;
            clone.height = source.height;
            const context = clone.getContext('2d');
            if (context)
                context.drawImage(source, 0, 0);
        }
        catch {
            // Canvas can be tainted. Keep the blank clone rather than failing the whole export.
        }
    }
    const sourceChildren = Array.from(source.children);
    const cloneChildren = Array.from(clone.children);
    for (let i = 0; i < sourceChildren.length; i += 1) {
        const sourceChild = sourceChildren[i];
        const cloneChild = cloneChildren[i];
        if (sourceChild && cloneChild)
            syncElementState(sourceChild, cloneChild);
    }
}
function sanitizeClone(root) {
    root.querySelectorAll('script,iframe,object,embed').forEach((node) => node.remove());
    root.querySelectorAll('*').forEach((el) => {
        for (const attr of Array.from(el.attributes)) {
            const name = attr.name.toLowerCase();
            const value = attr.value.trim().toLowerCase();
            if (name.startsWith('on'))
                el.removeAttribute(attr.name);
            if ((name === 'src' || name === 'href' || name === 'xlink:href') && value.startsWith('javascript:')) {
                el.removeAttribute(attr.name);
            }
        }
    });
}
async function collectDocumentCss(options) {
    if (!options.collectStyles)
        return createInjectedCss(options);
    const chunks = [];
    for (const styleEl of Array.from(document.querySelectorAll('style'))) {
        if (styleEl.textContent?.trim())
            chunks.push(styleEl.textContent);
    }
    for (const sheet of Array.from(document.styleSheets)) {
        try {
            const rules = Array.from(sheet.cssRules ?? []);
            if (rules.length)
                chunks.push(rules.map((rule) => rule.cssText).join('\n'));
        }
        catch {
            const owner = sheet.ownerNode;
            if (options.includeExternalStylesheets && owner instanceof HTMLLinkElement && owner.href) {
                try {
                    const response = await fetch(owner.href, { credentials: 'same-origin' });
                    if (response.ok)
                        chunks.push(await response.text());
                }
                catch (error) {
                    handleResourceError(error, options);
                }
            }
        }
    }
    chunks.push(createInjectedCss(options));
    return dedupeCss(chunks.join('\n'));
}
function dedupeCss(css) {
    const seen = new Set();
    const blocks = css.split(/\n(?=@font-face|@page|\.|#|\w|\*)/g);
    const output = [];
    for (const block of blocks) {
        const normalized = block.trim();
        if (!normalized || seen.has(normalized))
            continue;
        seen.add(normalized);
        output.push(block);
    }
    return output.join('\n');
}
function createInjectedCss(options) {
    const fontCss = options.fontFaces
        .map((font) => {
        const parts = [
            `font-family:"${escapeCssString(font.fontFamily)}"`,
            `src:${font.src}`,
            font.fontWeight !== undefined ? `font-weight:${font.fontWeight}` : '',
            font.fontStyle ? `font-style:${font.fontStyle}` : '',
            font.fontDisplay ? `font-display:${font.fontDisplay}` : '',
            font.unicodeRange ? `unicode-range:${font.unicodeRange}` : ''
        ].filter(Boolean);
        return `@font-face{${parts.join(';')}}`;
    })
        .join('\n');
    const headerFooterCss = `
    .html-to-pdf-pro-page { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .html-to-pdf-pro-page * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .html-to-pdf-pro-stage { contain: layout paint style; }
    .pdf-page-break { break-before: page; page-break-before: always; }
    .pdf-avoid-break, .avoid-break { break-inside: avoid; page-break-inside: avoid; }
    table { border-collapse: collapse; }
    thead { display: table-header-group; }
    tr, img, svg, canvas, figure, pre, blockquote { break-inside: avoid; page-break-inside: avoid; }
  `;
    return [fontCss, headerFooterCss, options.extraCss].filter(Boolean).join('\n');
}
async function inlineAssets(root, options) {
    if (options.inlineImages) {
        const images = Array.from(root.querySelectorAll('img'));
        for (const img of images) {
            const src = img.getAttribute('src');
            if (!src || /^data:/i.test(src) || /^blob:/i.test(src))
                continue;
            try {
                img.setAttribute('src', await fetchAsDataUrl(src));
                img.removeAttribute('srcset');
            }
            catch (error) {
                handleResourceError(error, options);
            }
        }
        const svgImages = Array.from(root.querySelectorAll('svg image'));
        for (const image of svgImages) {
            const href = image.getAttribute('href') || image.getAttribute('xlink:href');
            if (!href || /^data:/i.test(href) || /^blob:/i.test(href))
                continue;
            try {
                image.setAttribute('href', await fetchAsDataUrl(href));
                image.removeAttribute('xlink:href');
            }
            catch (error) {
                handleResourceError(error, options);
            }
        }
    }
    if (options.inlineCanvas) {
        root.querySelectorAll('canvas').forEach((canvas) => {
            if (!(canvas instanceof HTMLCanvasElement))
                return;
            try {
                const img = document.createElement('img');
                img.src = canvas.toDataURL('image/png');
                img.width = canvas.width;
                img.height = canvas.height;
                img.style.cssText = canvas.getAttribute('style') ?? '';
                img.className = canvas.className;
                canvas.replaceWith(img);
            }
            catch (error) {
                handleResourceError(error, options);
            }
        });
    }
    if (options.inlineCssResources) {
        await inlineCssUrlResources(root, options);
    }
}
async function inlineCssUrlResources(root, options) {
    const elements = Array.from(root.querySelectorAll('*'));
    for (const el of elements) {
        const style = el.getAttribute('style');
        if (!style || !/url\(/i.test(style))
            continue;
        const replaced = await replaceCssUrls(style, options);
        el.setAttribute('style', replaced);
    }
}
async function replaceCssUrls(css, options) {
    const matches = Array.from(css.matchAll(/url\((['"]?)([^'")]+)\1\)/gi));
    let output = css;
    for (const match of matches) {
        const url = match[2];
        if (/^(data:|blob:|#)/i.test(url))
            continue;
        try {
            const dataUrl = await fetchAsDataUrl(url);
            output = output.replace(match[0], `url("${dataUrl}")`);
        }
        catch (error) {
            handleResourceError(error, options);
        }
    }
    return output;
}
function materializePseudoElements(root) {
    const all = Array.from(root.querySelectorAll('*'));
    for (const el of all) {
        materializePseudo(el, 'before');
        materializePseudo(el, 'after');
    }
}
function materializePseudo(el, pseudo) {
    const computed = window.getComputedStyle(el, `::${pseudo}`);
    const content = computed.content;
    if (!content || content === 'none' || content === 'normal')
        return;
    const text = parseCssContent(content);
    if (!text)
        return;
    const span = document.createElement('span');
    span.textContent = text;
    span.setAttribute('aria-hidden', 'true');
    span.className = `html-to-pdf-pro-pseudo-${pseudo}`;
    const css = cssTextFromDeclaration(computed);
    span.setAttribute('style', css);
    if (pseudo === 'before')
        el.prepend(span);
    else
        el.append(span);
}
function parseCssContent(content) {
    if ((content.startsWith('"') && content.endsWith('"')) || (content.startsWith("'") && content.endsWith("'"))) {
        return content.slice(1, -1).replace(/\\A/g, '\n').replace(/\\"/g, '"').replace(/\\'/g, "'");
    }
    return '';
}
function elementText(element) {
    return (element.textContent ?? '').replace(/\s+/g, ' ').trim();
}
async function loadImage(url) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Failed to load rendered page image.'));
        image.src = url;
    });
}
function buildSnapshotHtml(sourceCss, root) {
    return [
        '<!doctype html>',
        '<html>',
        '<head>',
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>',
        sourceCss,
        '</style>',
        '</head>',
        '<body>',
        root.outerHTML,
        '</body>',
        '</html>'
    ].join('\n');
}
export class HtmlToPdfPro {
    constructor(options = {}) {
        Object.defineProperty(this, "options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.options = normalizeOptions(options);
    }
    async toPdf(source, overrideOptions = {}) {
        const options = normalizeOptions({ ...this.options, ...overrideOptions });
        if (options.engine !== 'dom-canvas-text') {
            throw new Error(`Unsupported engine: ${options.engine}`);
        }
        options.onProgress({ phase: 'clone', message: 'Cloning source DOM.' });
        const layout = await this.createLayout(source, options);
        try {
            options.onProgress({ phase: 'paginate', message: 'Computing page slices.' });
            const pages = paginate(layout, options);
            options.onProgress({ phase: 'render-start', message: 'Rendering pages.', totalPages: pages.length });
            const pageInputs = [];
            const allBookmarks = [];
            for (const page of pages) {
                options.onProgress({
                    phase: 'render-page',
                    page: page.index + 1,
                    totalPages: pages.length,
                    ratio: page.index / Math.max(1, pages.length)
                });
                const result = await renderPage(layout, page, pages.length, options);
                const { bytes } = dataUrlToBytes(result.visual.dataUrl);
                pageInputs.push({
                    imageBytes: bytes,
                    imageMime: 'image/jpeg',
                    imageWidth: result.visual.widthPx,
                    imageHeight: result.visual.heightPx,
                    glyphs: result.glyphs,
                    links: result.links
                });
                allBookmarks.push(...result.bookmarks);
            }
            options.onProgress({ phase: 'pdf', message: 'Assembling PDF.' });
            return buildPdf(pageInputs, allBookmarks, layout.metrics, options);
        }
        finally {
            layout.cleanup();
        }
    }
    async outputBlob(source, overrideOptions = {}) {
        const bytes = await this.toPdf(source, overrideOptions);
        return new Blob([bytes], { type: 'application/pdf' });
    }
    async download(source, overrideOptions = {}) {
        const options = normalizeOptions({ ...this.options, ...overrideOptions });
        const blob = await this.outputBlob(source, options);
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = safeFileName(options.filename);
        anchor.rel = 'noopener';
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 5000);
        options.onProgress({ phase: 'save', filename: options.filename, ratio: 1 });
    }
    async fromHtml(html, overrideOptions = {}) {
        return this.toPdf({ type: 'html', html }, overrideOptions);
    }
    async downloadHtml(html, overrideOptions = {}) {
        await this.download({ type: 'html', html }, overrideOptions);
    }
    async fromMarkdown(markdown, overrideOptions = {}) {
        return this.toPdf({ type: 'markdown', markdown }, overrideOptions);
    }
    async downloadMarkdown(markdown, overrideOptions = {}) {
        await this.download({ type: 'markdown', markdown }, overrideOptions);
    }
    async serialize(source, overrideOptions = {}) {
        const options = normalizeOptions({ ...this.options, ...overrideOptions });
        const layout = await this.createLayout(source, options);
        try {
            return layout.snapshotHtml;
        }
        finally {
            layout.cleanup();
        }
    }
    async nativePrint(source, overrideOptions = {}) {
        const snapshot = await this.serialize(source, overrideOptions);
        const printWindow = window.open('', '_blank', 'noopener,noreferrer');
        if (!printWindow)
            throw new Error('Unable to open print window.');
        printWindow.document.open();
        printWindow.document.write(snapshot);
        printWindow.document.close();
        await nextFrame(printWindow);
        printWindow.focus();
        printWindow.print();
    }
    async createLayout(source, options) {
        const sourceEl = getSourceElement(source);
        const sourceRect = sourceEl.getBoundingClientRect();
        const metrics = createPageMetrics(options);
        const sourceWidth = Math.max(1, Math.ceil(sourceRect.width || sourceEl.scrollWidth || metrics.contentWidthPx));
        const clone = sourceEl.cloneNode(true);
        syncElementState(sourceEl, clone);
        if (options.sanitize)
            sanitizeClone(clone);
        options.onProgress({ phase: 'styles', message: 'Collecting CSS.' });
        const sourceCss = await collectDocumentCss(options);
        const stage = document.createElement('div');
        stage.className = 'html-to-pdf-pro-stage';
        stage.style.cssText = [
            'position:absolute',
            'left:-100000px',
            'top:0',
            `width:${sourceWidth}px`,
            'min-height:1px',
            'overflow:visible',
            'background:transparent',
            'z-index:-1',
            'pointer-events:none'
        ].join(';');
        const style = document.createElement('style');
        style.textContent = sourceCss;
        stage.append(style);
        const root = document.createElement('div');
        root.className = 'html-to-pdf-pro-layout-root';
        root.style.cssText = [`width:${sourceWidth}px`, 'position:relative', 'overflow:visible'].join(';');
        root.append(clone);
        stage.append(root);
        document.body.append(stage);
        options.onProgress({ phase: 'assets', message: 'Inlining assets.' });
        await inlineAssets(root, options);
        if (options.materializePseudoElements)
            materializePseudoElements(root);
        options.onProgress({ phase: 'layout', message: 'Measuring layout.' });
        if (document.fonts?.ready)
            await withTimeout(document.fonts.ready, options.timeoutMs, 'Font loading');
        await nextFrame();
        const rootRect = root.getBoundingClientRect();
        const layoutWidthPx = Math.max(1, Math.ceil(rootRect.width || root.scrollWidth || sourceWidth));
        const layoutHeightPx = Math.max(1, Math.ceil(rootRect.height || root.scrollHeight));
        const zoom = options.fitToPage ? Math.min(1, metrics.contentWidthPx / layoutWidthPx) : 1;
        const scaledWidth = layoutWidthPx * zoom;
        const xOffsetPx = Math.max(0, (metrics.contentWidthPx - scaledWidth) / 2);
        return {
            stage,
            root,
            sourceCss,
            metrics,
            layoutWidthPx,
            layoutHeightPx,
            zoom,
            xOffsetPx,
            snapshotHtml: buildSnapshotHtml(sourceCss, root),
            cleanup: () => {
                stage.remove();
            }
        };
    }
}
function paginate(layout, options) {
    const available = Math.max(1, layout.metrics.contentHeightPx / layout.zoom);
    const total = layout.layoutHeightPx;
    const forced = collectForcedBreaks(layout, options);
    const pages = [];
    let start = 0;
    let index = 0;
    while (start < total - 1) {
        let end = Math.min(total, start + available);
        const nextForced = forced.find((pos) => pos > start + 1 && pos < end - 1);
        if (nextForced !== undefined)
            end = nextForced;
        else if (options.pageBreakMode === 'avoid' && end < total)
            end = adjustBreakToAvoidElements(layout, start, end, available, options);
        if (end <= start + 1)
            end = Math.min(total, start + available);
        pages.push({ index, startY: start, endY: end });
        start = end;
        index += 1;
        if (index > 1000)
            throw new Error('Pagination produced too many pages. Please check source height.');
    }
    return pages.length ? pages : [{ index: 0, startY: 0, endY: total }];
}
function collectForcedBreaks(layout, options) {
    const breaks = new Set();
    const rootRect = layout.root.getBoundingClientRect();
    for (const el of Array.from(layout.root.querySelectorAll(options.forceBreakBeforeSelectors))) {
        const rect = el.getBoundingClientRect();
        const top = rect.top - rootRect.top;
        if (top > 1 && top < layout.layoutHeightPx - 1)
            breaks.add(Math.round(top));
    }
    return Array.from(breaks).sort((a, b) => a - b);
}
function adjustBreakToAvoidElements(layout, start, proposed, available, options) {
    const rootRect = layout.root.getBoundingClientRect();
    const minEnd = start + Math.max(available * 0.35, 80);
    let candidate = proposed;
    const avoidElements = Array.from(layout.root.querySelectorAll(options.avoidBreakSelectors));
    for (const el of avoidElements) {
        const rect = el.getBoundingClientRect();
        const top = rect.top - rootRect.top;
        const bottom = rect.bottom - rootRect.top;
        if (top < proposed && bottom > proposed && top > minEnd) {
            candidate = Math.min(candidate, top);
        }
    }
    if (candidate < minEnd)
        return proposed;
    const blockBoundaries = [];
    const blockSelector = 'section,article,header,footer,div,p,table,thead,tbody,tr,ul,ol,li,figure,blockquote,pre,h1,h2,h3,h4,h5,h6';
    for (const el of Array.from(layout.root.querySelectorAll(blockSelector))) {
        const rect = el.getBoundingClientRect();
        const bottom = rect.bottom - rootRect.top;
        if (bottom > minEnd && bottom < candidate)
            blockBoundaries.push(bottom);
    }
    if (blockBoundaries.length) {
        const best = Math.max(...blockBoundaries);
        if (proposed - best < available * 0.25)
            return best;
    }
    return candidate;
}
async function renderPage(layout, page, totalPages, options) {
    const visual = await renderPageVisual(layout, page, totalPages, options);
    const glyphs = options.textLayer ? extractPageText(layout, page, totalPages, options) : [];
    const links = options.linkAnnotations ? extractPageLinks(layout, page) : [];
    const bookmarks = options.bookmarks ? extractPageBookmarks(layout, page) : [];
    return { visual, glyphs, links, bookmarks };
}
async function renderPageVisual(layout, page, totalPages, options) {
    const metrics = layout.metrics;
    const outputScale = options.dpi / 96;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(metrics.widthPx * outputScale));
    canvas.height = Math.max(1, Math.ceil(metrics.heightPx * outputScale));
    const context = canvas.getContext('2d');
    if (!context)
        throw new Error('Canvas 2D context is not available.');
    if (options.backgroundColor) {
        context.fillStyle = options.backgroundColor;
        context.fillRect(0, 0, canvas.width, canvas.height);
    }
    const svgUrl = createPageSvgUrl(layout, page, totalPages, options);
    try {
        const image = await withTimeout(loadImage(svgUrl), options.timeoutMs, 'Page SVG render');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
    }
    finally {
        URL.revokeObjectURL(svgUrl);
    }
    const mime = 'image/jpeg';
    return {
        dataUrl: canvas.toDataURL(mime, options.imageQuality),
        widthPx: canvas.width,
        heightPx: canvas.height
    };
}
function createPageSvgUrl(layout, page, totalPages, options) {
    const doc = document.implementation.createHTMLDocument('');
    const pageEl = doc.createElement('div');
    pageEl.setAttribute('xmlns', XHTML_NS);
    pageEl.className = 'html-to-pdf-pro-page';
    pageEl.setAttribute('style', [
        `width:${layout.metrics.widthPx}px`,
        `height:${layout.metrics.heightPx}px`,
        `background:${options.backgroundColor ?? 'transparent'}`,
        'position:relative',
        'overflow:hidden',
        'margin:0',
        'padding:0'
    ].join(';'));
    const style = doc.createElement('style');
    style.textContent = layout.sourceCss;
    pageEl.append(style);
    const viewport = doc.createElement('div');
    viewport.setAttribute('style', [
        'position:absolute',
        `left:${layout.metrics.margin.left + layout.xOffsetPx}px`,
        `top:${layout.metrics.margin.top}px`,
        `width:${layout.metrics.contentWidthPx - layout.xOffsetPx * 2}px`,
        `height:${layout.metrics.contentHeightPx}px`,
        'overflow:hidden',
        'margin:0',
        'padding:0'
    ].join(';'));
    const content = doc.createElement('div');
    content.setAttribute('style', [
        'position:absolute',
        'left:0',
        `top:${-page.startY * layout.zoom}px`,
        `width:${layout.layoutWidthPx}px`,
        `transform:scale(${layout.zoom})`,
        'transform-origin:0 0',
        'margin:0',
        'padding:0'
    ].join(';'));
    content.append(doc.importNode(layout.root.cloneNode(true), true));
    viewport.append(content);
    pageEl.append(viewport);
    appendHeaderFooter(pageEl, layout, page.index + 1, totalPages, options);
    const serialized = new XMLSerializer().serializeToString(pageEl);
    const svg = [
        `<svg xmlns="${SVG_NS}" width="${layout.metrics.widthPx}" height="${layout.metrics.heightPx}" viewBox="0 0 ${layout.metrics.widthPx} ${layout.metrics.heightPx}">`,
        `<foreignObject x="0" y="0" width="100%" height="100%">`,
        serialized,
        '</foreignObject>',
        '</svg>'
    ].join('');
    return URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
}
function appendHeaderFooter(pageEl, layout, pageNumber, totalPages, options) {
    if (options.header)
        appendHeaderFooterLine(pageEl, layout, options.header, pageNumber, totalPages, 'header');
    if (options.footer)
        appendHeaderFooterLine(pageEl, layout, options.footer, pageNumber, totalPages, 'footer');
}
function appendHeaderFooterLine(pageEl, layout, config, pageNumber, totalPages, slot) {
    const doc = pageEl.ownerDocument;
    const text = formatPageText(config.text, pageNumber, totalPages);
    const fontSize = config.fontSizePx ?? 10;
    const offset = config.offsetPx ?? 0;
    const div = doc.createElement('div');
    const horizontal = config.position === 'left' ? `left:${layout.metrics.margin.left}px;text-align:left` : config.position === 'right' ? `right:${layout.metrics.margin.right}px;text-align:right` : `left:${layout.metrics.margin.left}px;right:${layout.metrics.margin.right}px;text-align:center`;
    const vertical = slot === 'header'
        ? `top:${Math.max(4, layout.metrics.margin.top / 2 - fontSize / 2 + offset)}px`
        : `bottom:${Math.max(4, layout.metrics.margin.bottom / 2 - fontSize / 2 + offset)}px`;
    div.textContent = text;
    div.setAttribute('style', [
        'position:absolute',
        horizontal,
        vertical,
        `font-size:${fontSize}px`,
        `line-height:${fontSize * 1.25}px`,
        `color:${config.color ?? '#4b5563'}`,
        'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        'white-space:nowrap',
        'overflow:hidden',
        'text-overflow:ellipsis'
    ].join(';'));
    pageEl.append(div);
}
function formatPageText(text, pageNumber, totalPages) {
    return text.replace(/\{page\}/g, String(pageNumber)).replace(/\{pages\}/g, String(totalPages));
}
function extractPageText(layout, page, totalPages, options) {
    const rootRect = layout.root.getBoundingClientRect();
    const glyphs = [];
    const range = document.createRange();
    for (const node of collectTextNodes(layout.root)) {
        const parent = node.parentElement;
        if (!parent)
            continue;
        const computed = window.getComputedStyle(parent);
        const fontSize = Math.max(1, parseCssLengthToPx(computed.fontSize || '12px') * layout.zoom);
        const segments = segmentText(node.nodeValue ?? '');
        let offset = 0;
        let lastX = 0;
        let lastY = 0;
        for (const segment of segments) {
            const start = offset;
            const end = offset + segment.length;
            offset = end;
            try {
                range.setStart(node, start);
                range.setEnd(node, end);
            }
            catch {
                continue;
            }
            const rect = Array.from(range.getClientRects()).find((r) => r.width > 0 || r.height > 0);
            if (!rect) {
                if (isRenderableWhitespace(segment) && glyphs.length) {
                    glyphs.push({ text: segment, pageIndex: page.index, xPx: lastX, yPx: lastY, fontSizePx: fontSize });
                }
                continue;
            }
            const topInSource = rect.top - rootRect.top;
            if (topInSource < page.startY - 1 || topInSource > page.endY + 1)
                continue;
            const xPx = layout.metrics.margin.left + layout.xOffsetPx + (rect.left - rootRect.left) * layout.zoom;
            const yTop = layout.metrics.margin.top + (topInSource - page.startY) * layout.zoom;
            const yPx = yTop + rect.height * layout.zoom * 0.78;
            lastX = xPx + rect.width * layout.zoom;
            lastY = yPx;
            glyphs.push({ text: segment, pageIndex: page.index, xPx, yPx, fontSizePx: fontSize });
        }
    }
    range.detach();
    appendHeaderFooterGlyphs(glyphs, layout, page.index + 1, totalPages, options);
    return glyphs;
}
function appendHeaderFooterGlyphs(glyphs, layout, pageNumber, totalPages, options) {
    if (options.header)
        appendLineGlyphs(glyphs, layout, options.header, pageNumber, totalPages, 'header');
    if (options.footer)
        appendLineGlyphs(glyphs, layout, options.footer, pageNumber, totalPages, 'footer');
}
function appendLineGlyphs(glyphs, layout, config, pageNumber, totalPages, slot) {
    const text = formatPageText(config.text, pageNumber, totalPages);
    const size = config.fontSizePx ?? 10;
    const estimatedWidth = text.length * size * 0.52;
    let x = layout.metrics.margin.left;
    if (config.position === 'center')
        x = (layout.metrics.widthPx - estimatedWidth) / 2;
    if (config.position === 'right')
        x = layout.metrics.widthPx - layout.metrics.margin.right - estimatedWidth;
    const y = slot === 'header'
        ? Math.max(4, layout.metrics.margin.top / 2 + size / 2)
        : layout.metrics.heightPx - Math.max(4, layout.metrics.margin.bottom / 2 - size / 2);
    let currentX = x;
    for (const char of segmentText(text)) {
        glyphs.push({ text: char, pageIndex: pageNumber - 1, xPx: currentX, yPx: y, fontSizePx: size });
        currentX += size * 0.52;
    }
}
function extractPageLinks(layout, page) {
    const rootRect = layout.root.getBoundingClientRect();
    const links = [];
    for (const anchor of Array.from(layout.root.querySelectorAll('a[href]'))) {
        const href = anchor.href || anchor.getAttribute('href') || '';
        if (!href || href.startsWith('javascript:'))
            continue;
        for (const rect of Array.from(anchor.getClientRects())) {
            const topInSource = rect.top - rootRect.top;
            if (topInSource < page.startY || topInSource > page.endY)
                continue;
            links.push({
                pageIndex: page.index,
                href,
                xPx: layout.metrics.margin.left + layout.xOffsetPx + (rect.left - rootRect.left) * layout.zoom,
                yPx: layout.metrics.margin.top + (topInSource - page.startY) * layout.zoom,
                widthPx: rect.width * layout.zoom,
                heightPx: rect.height * layout.zoom
            });
        }
    }
    return links;
}
function extractPageBookmarks(layout, page) {
    const rootRect = layout.root.getBoundingClientRect();
    const items = [];
    for (const heading of Array.from(layout.root.querySelectorAll('h1,h2,h3,h4,h5,h6,[data-pdf-bookmark]'))) {
        const text = heading.getAttribute('data-pdf-bookmark') || elementText(heading);
        if (!text)
            continue;
        const rect = heading.getBoundingClientRect();
        const topInSource = rect.top - rootRect.top;
        if (topInSource < page.startY || topInSource > page.endY)
            continue;
        const level = /^H([1-6])$/i.test(heading.tagName) ? Number(heading.tagName.slice(1)) : Number(heading.dataset.pdfBookmarkLevel || 1);
        items.push({
            pageIndex: page.index,
            title: text,
            yPx: layout.metrics.margin.top + (topInSource - page.startY) * layout.zoom,
            level
        });
    }
    return items;
}
class PdfBuilder {
    constructor() {
        Object.defineProperty(this, "objects", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: [undefined]
        });
        Object.defineProperty(this, "encoder", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new TextEncoder()
        });
    }
    reserve() {
        this.objects.push(undefined);
        return this.objects.length - 1;
    }
    add(content) {
        const id = this.reserve();
        this.set(id, content);
        return id;
    }
    set(id, content) {
        this.objects[id] = typeof content === 'string' ? this.encoder.encode(content) : content;
    }
    stream(dict, data) {
        const bytes = typeof data === 'string' ? this.encoder.encode(data) : data;
        const head = this.encoder.encode(`<< ${dict} /Length ${bytes.length} >>\nstream\n`);
        const tail = this.encoder.encode('\nendstream');
        const result = new Uint8Array(head.length + bytes.length + tail.length);
        result.set(head, 0);
        result.set(bytes, head.length);
        result.set(tail, head.length + bytes.length);
        return result;
    }
    build(rootId) {
        const chunks = [];
        const header = this.encoder.encode('%PDF-1.7\n%\xFF\xFF\xFF\xFF\n');
        chunks.push(header);
        let offset = header.length;
        const offsets = [0];
        for (let id = 1; id < this.objects.length; id += 1) {
            const object = this.objects[id];
            if (!object)
                throw new Error(`PDF object ${id} was reserved but not written.`);
            offsets[id] = offset;
            const prefix = this.encoder.encode(`${id} 0 obj\n`);
            const suffix = this.encoder.encode('\nendobj\n');
            chunks.push(prefix, object, suffix);
            offset += prefix.length + object.length + suffix.length;
        }
        const xrefOffset = offset;
        const xrefRows = ['xref', `0 ${this.objects.length}`, '0000000000 65535 f '];
        for (let id = 1; id < this.objects.length; id += 1) {
            xrefRows.push(`${String(offsets[id]).padStart(10, '0')} 00000 n `);
        }
        const trailer = [
            ...xrefRows,
            'trailer',
            `<< /Size ${this.objects.length} /Root ${rootId} 0 R >>`,
            'startxref',
            String(xrefOffset),
            '%%EOF'
        ].join('\n');
        chunks.push(this.encoder.encode(trailer));
        const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const output = new Uint8Array(total);
        let pos = 0;
        for (const chunk of chunks) {
            output.set(chunk, pos);
            pos += chunk.length;
        }
        return output;
    }
}
function buildPdf(pages, bookmarks, metrics, options) {
    const pdf = new PdfBuilder();
    const pagesObjectId = pdf.reserve();
    const fontSubsets = createFonts(pdf, pages.flatMap((page) => page.glyphs.map((glyph) => glyph.text)));
    const pageObjectIds = [];
    for (const [index, page] of pages.entries()) {
        const imageObjectId = pdf.add(pdf.stream(`/Type /XObject /Subtype /Image /Width ${page.imageWidth} /Height ${page.imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`, page.imageBytes));
        const annotationIds = page.links.map((link) => pdf.add(createLinkAnnotation(link, metrics)));
        const contentObjectId = pdf.add(pdf.stream('', createContentStream(page, index, imageObjectId, fontSubsets, metrics)));
        const annots = annotationIds.length ? `/Annots [${annotationIds.map((id) => `${id} 0 R`).join(' ')}]` : '';
        const pageObjectId = pdf.add([
            '<< /Type /Page',
            `/Parent ${pagesObjectId} 0 R`,
            `/MediaBox [0 0 ${pdfNumber(metrics.widthPt)} ${pdfNumber(metrics.heightPt)}]`,
            `/Resources << /XObject << /Im${index + 1} ${imageObjectId} 0 R >> /Font << ${fontSubsets.map((font) => `/F${font.id} ${font.fontObjectId} 0 R`).join(' ')} >> >>`,
            `/Contents ${contentObjectId} 0 R`,
            annots,
            '>>'
        ].filter(Boolean).join('\n'));
        pageObjectIds.push(pageObjectId);
    }
    pdf.set(pagesObjectId, `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjectIds.length} >>`);
    const outlineRootId = options.bookmarks && bookmarks.length ? createOutlines(pdf, bookmarks, pageObjectIds, metrics) : undefined;
    const catalogId = pdf.add(`<< /Type /Catalog /Pages ${pagesObjectId} 0 R${outlineRootId ? ` /Outlines ${outlineRootId} 0 R /PageMode /UseOutlines` : ''} >>`);
    return pdf.build(catalogId);
}
function createContentStream(page, pageIndex, imageObjectId, fonts, metrics) {
    const commands = [
        'q',
        `${pdfNumber(metrics.widthPt)} 0 0 ${pdfNumber(metrics.heightPt)} 0 0 cm`,
        `/Im${pageIndex + 1} Do`,
        'Q'
    ];
    if (page.glyphs.length) {
        commands.push('q');
        for (const glyph of page.glyphs) {
            const font = findFontSubset(fonts, glyph.text);
            if (!font)
                continue;
            const code = font.charToCode.get(glyph.text);
            if (!code)
                continue;
            const x = pxToPt(glyph.xPx, metrics.widthPx, metrics.widthPt);
            const y = metrics.heightPt - pxToPt(glyph.yPx, metrics.heightPx, metrics.heightPt);
            const fontSize = pxToPt(glyph.fontSizePx, metrics.widthPx, metrics.widthPt);
            commands.push('BT', '3 Tr', `/F${font.id} ${pdfNumber(fontSize)} Tf`, `1 0 0 1 ${pdfNumber(x)} ${pdfNumber(y)} Tm`, `<${code.toString(16).padStart(2, '0').toUpperCase()}> Tj`, 'ET');
        }
        commands.push('Q');
    }
    void imageObjectId;
    return commands.join('\n');
}
function createFonts(pdf, chars) {
    const unique = Array.from(new Set(chars.filter((char) => char.length > 0)));
    const subsets = [];
    for (let i = 0; i < unique.length; i += 255) {
        const chunk = unique.slice(i, i + 255);
        const id = subsets.length + 1;
        const subset = createFontSubset(pdf, id, chunk);
        subsets.push(subset);
    }
    if (!subsets.length)
        subsets.push(createFontSubset(pdf, 1, [' ']));
    return subsets;
}
function createFontSubset(pdf, id, chars) {
    const charToCode = new Map();
    const charProcEntries = [];
    const encodingNames = [];
    const widths = [];
    chars.forEach((char, index) => {
        const code = index + 1;
        charToCode.set(char, code);
        const glyphName = `g${code}`;
        const procId = pdf.add(pdf.stream('', '1000 0 d0'));
        charProcEntries.push(`/${glyphName} ${procId} 0 R`);
        encodingNames.push(`/${glyphName}`);
        widths.push('1000');
    });
    const toUnicodeId = pdf.add(pdf.stream('', createToUnicodeCMap(chars)));
    const fontObjectId = pdf.add([
        '<< /Type /Font /Subtype /Type3',
        `/Name /F${id}`,
        '/FontBBox [0 -200 1000 1000]',
        '/FontMatrix [0.001 0 0 0.001 0 0]',
        `/CharProcs << ${charProcEntries.join(' ')} >>`,
        `/Encoding << /Type /Encoding /Differences [1 ${encodingNames.join(' ')}] >>`,
        `/FirstChar 1 /LastChar ${chars.length}`,
        `/Widths [${widths.join(' ')}]`,
        '/Resources << >>',
        `/ToUnicode ${toUnicodeId} 0 R`,
        '>>'
    ].join('\n'));
    return { id, fontObjectId, charToCode };
}
function createToUnicodeCMap(chars) {
    const lines = [
        '/CIDInit /ProcSet findresource begin',
        '12 dict begin',
        'begincmap',
        '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
        '/CMapName /HtmlToPdfProUnicode def',
        '/CMapType 2 def',
        '1 begincodespacerange',
        '<01> <FF>',
        'endcodespacerange'
    ];
    for (let i = 0; i < chars.length; i += 100) {
        const slice = chars.slice(i, i + 100);
        lines.push(`${slice.length} beginbfchar`);
        slice.forEach((char, offset) => {
            const code = i + offset + 1;
            lines.push(`<${code.toString(16).padStart(2, '0').toUpperCase()}> <${utf16BeHexWithoutBom(char)}>`);
        });
        lines.push('endbfchar');
    }
    lines.push('endcmap', 'CMapName currentdict /CMap defineresource pop', 'end', 'end');
    return lines.join('\n');
}
function findFontSubset(fonts, char) {
    return fonts.find((font) => font.charToCode.has(char));
}
function createLinkAnnotation(link, metrics) {
    const x1 = pxToPt(link.xPx, metrics.widthPx, metrics.widthPt);
    const yTop = pxToPt(link.yPx, metrics.heightPx, metrics.heightPt);
    const x2 = pxToPt(link.xPx + link.widthPx, metrics.widthPx, metrics.widthPt);
    const yBottom = pxToPt(link.yPx + link.heightPx, metrics.heightPx, metrics.heightPt);
    const y1 = metrics.heightPt - yBottom;
    const y2 = metrics.heightPt - yTop;
    return [
        '<< /Type /Annot /Subtype /Link',
        `/Rect [${pdfNumber(x1)} ${pdfNumber(y1)} ${pdfNumber(x2)} ${pdfNumber(y2)}]`,
        '/Border [0 0 0]',
        `/A << /S /URI /URI (${escapePdfLiteral(link.href)}) >>`,
        '>>'
    ].join('\n');
}
function createOutlines(pdf, bookmarks, pageObjectIds, metrics) {
    const rootId = pdf.reserve();
    const outlineIds = bookmarks.map(() => pdf.reserve());
    bookmarks.forEach((bookmark, index) => {
        const prev = index > 0 ? `/Prev ${outlineIds[index - 1]} 0 R` : '';
        const next = index < outlineIds.length - 1 ? `/Next ${outlineIds[index + 1]} 0 R` : '';
        const pageId = pageObjectIds[bookmark.pageIndex] ?? pageObjectIds[0];
        const y = metrics.heightPt - pxToPt(bookmark.yPx, metrics.heightPx, metrics.heightPt);
        void bookmark.level;
        pdf.set(outlineIds[index], [
            '<< /Title',
            `<${utf16BeHex(bookmark.title)}>`,
            `/Parent ${rootId} 0 R`,
            prev,
            next,
            `/Dest [${pageId} 0 R /XYZ 0 ${pdfNumber(y)} null]`,
            '>>'
        ].filter(Boolean).join(' '));
    });
    pdf.set(rootId, `<< /Type /Outlines /First ${outlineIds[0]} 0 R /Last ${outlineIds[outlineIds.length - 1]} 0 R /Count ${outlineIds.length} >>`);
    return rootId;
}
