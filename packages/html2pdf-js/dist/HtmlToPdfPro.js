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
    dpi: 192,
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
        return new Blob([toArrayBuffer(bytes)], { type: 'application/pdf' });
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
            'position:fixed',
            'left:-100000px',
            'top:0',
            'width:0',
            'height:0',
            'overflow:visible',
            'pointer-events:none',
            'z-index:-1',
            'contain:layout style paint'
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
    const context = canvas.getContext('2d', { alpha: options.backgroundColor === null });
    if (!context)
        throw new Error('Canvas 2D context is not available.');
    context.save();
    context.scale(outputScale, outputScale);
    if (options.backgroundColor) {
        context.fillStyle = options.backgroundColor;
        context.fillRect(0, 0, metrics.widthPx, metrics.heightPx);
    }
    const rootRect = layout.root.getBoundingClientRect();
    context.save();
    context.beginPath();
    context.rect(metrics.margin.left, metrics.margin.top, metrics.contentWidthPx, metrics.contentHeightPx);
    context.clip();
    await paintElementTree(context, layout.root, layout, page, rootRect, options);
    context.restore();
    paintHeaderFooterCanvas(context, layout, page.index + 1, totalPages, options);
    context.restore();
    const mime = 'image/jpeg';
    return {
        dataUrl: canvas.toDataURL(mime, options.imageQuality),
        widthPx: canvas.width,
        heightPx: canvas.height
    };
}
async function paintElementTree(context, node, layout, page, rootRect, options) {
    if (!(node instanceof Element))
        return;
    if (node !== layout.root && !isElementVisible(node))
        return;
    const style = node instanceof HTMLElement || node instanceof SVGElement ? window.getComputedStyle(node) : undefined;
    const opacity = style ? clampNumber(style.opacity, 0, 1, 1) : 1;
    context.save();
    context.globalAlpha *= opacity;
    if (node !== layout.root && style) {
        paintElementBox(context, node, style, layout, page, rootRect);
        await paintReplacedElement(context, node, layout, page, rootRect);
        paintFormControl(context, node, style, layout, page, rootRect);
    }
    for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
            paintTextNode(context, child, layout, page, rootRect);
        }
        else {
            await paintElementTree(context, child, layout, page, rootRect, options);
        }
    }
    context.restore();
}
function isElementVisible(node) {
    const style = window.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden')
        return false;
    if (Number.parseFloat(style.opacity || '1') <= 0)
        return false;
    return true;
}
function paintElementBox(context, element, style, layout, page, rootRect) {
    const rects = Array.from(element.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
    if (!rects.length)
        return;
    for (const domRect of rects) {
        const rect = toPageRect(domRect, layout, page, rootRect);
        if (!rect || rect.width <= 0 || rect.height <= 0)
            continue;
        const radius = parseBorderRadius(style, rect.width, rect.height);
        paintBoxShadow(context, rect, radius, style.boxShadow);
        paintBackground(context, rect, radius, style);
        paintBorders(context, rect, radius, style);
    }
}
async function paintReplacedElement(context, element, layout, page, rootRect) {
    const rect = firstPageRect(element, layout, page, rootRect);
    if (!rect || rect.width <= 0 || rect.height <= 0)
        return;
    try {
        if (element instanceof HTMLImageElement) {
            const src = element.currentSrc || element.src;
            if (!src)
                return;
            const image = element.complete && element.naturalWidth > 0 ? element : await withTimeout(loadImage(src), 5000, 'Image render');
            context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
            return;
        }
        if (element instanceof HTMLCanvasElement) {
            context.drawImage(element, rect.x, rect.y, rect.width, rect.height);
            return;
        }
    }
    catch {
        // Cross-origin or tainted replaced content should not fail the whole PDF.
    }
}
function paintFormControl(context, element, style, layout, page, rootRect) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement))
        return;
    const rect = firstPageRect(element, layout, page, rootRect);
    if (!rect)
        return;
    const value = element instanceof HTMLSelectElement
        ? element.selectedOptions[0]?.textContent ?? element.value
        : element.value;
    if (!value)
        return;
    context.save();
    context.font = canvasFontFromStyle(style, layout.zoom);
    context.fillStyle = safeCanvasColor(style.color, '#111827');
    context.textBaseline = 'alphabetic';
    const paddingLeft = parseCssLengthToPx(style.paddingLeft || '0') * layout.zoom;
    const fontSize = Math.max(1, parseCssLengthToPx(style.fontSize || '12px') * layout.zoom);
    const x = rect.x + paddingLeft;
    const y = rect.y + rect.height / 2 + fontSize * 0.35;
    context.fillText(value, x, y, Math.max(1, rect.width - paddingLeft * 2));
    context.restore();
}
function paintTextNode(context, node, layout, page, rootRect) {
    const parent = node.parentElement;
    if (!parent || !node.nodeValue || !node.nodeValue.trim())
        return;
    if (!isElementVisible(parent))
        return;
    const style = window.getComputedStyle(parent);
    if (style.color === 'transparent' || style.fontSize === '0px')
        return;
    const range = document.createRange();
    const segments = segmentText(node.nodeValue);
    let offset = 0;
    context.save();
    context.font = canvasFontFromStyle(style, layout.zoom);
    context.fillStyle = safeCanvasColor(style.color, '#111827');
    context.textBaseline = 'alphabetic';
    for (const segment of segments) {
        const start = offset;
        const end = offset + segment.length;
        offset = end;
        if (!segment.trim())
            continue;
        try {
            range.setStart(node, start);
            range.setEnd(node, end);
        }
        catch {
            continue;
        }
        const rect = Array.from(range.getClientRects()).find((item) => item.width > 0 || item.height > 0);
        if (!rect)
            continue;
        const pageRect = toPageRect(rect, layout, page, rootRect);
        if (!pageRect)
            continue;
        const fontSize = Math.max(1, parseCssLengthToPx(style.fontSize || '12px') * layout.zoom);
        const baseline = pageRect.y + pageRect.height * 0.78;
        context.fillText(segment, pageRect.x, baseline);
        paintTextDecoration(context, style, pageRect, baseline, fontSize, segment);
    }
    range.detach();
    context.restore();
}
function paintTextDecoration(context, style, rect, baseline, fontSize, text) {
    const line = style.textDecorationLine || '';
    if (!line.includes('underline'))
        return;
    const width = Math.max(rect.width, context.measureText(text).width);
    context.save();
    context.strokeStyle = safeCanvasColor(style.textDecorationColor || style.color, String(context.fillStyle));
    context.lineWidth = Math.max(0.5, fontSize / 16);
    context.beginPath();
    context.moveTo(rect.x, baseline + Math.max(1, fontSize * 0.08));
    context.lineTo(rect.x + width, baseline + Math.max(1, fontSize * 0.08));
    context.stroke();
    context.restore();
}
function firstPageRect(element, layout, page, rootRect) {
    for (const rect of Array.from(element.getClientRects())) {
        const pageRect = toPageRect(rect, layout, page, rootRect);
        if (pageRect)
            return pageRect;
    }
    return undefined;
}
function toPageRect(rect, layout, page, rootRect) {
    const topInSource = rect.top - rootRect.top;
    const bottomInSource = rect.bottom - rootRect.top;
    if (bottomInSource < page.startY || topInSource > page.endY)
        return undefined;
    return {
        x: layout.metrics.margin.left + layout.xOffsetPx + (rect.left - rootRect.left) * layout.zoom,
        y: layout.metrics.margin.top + (topInSource - page.startY) * layout.zoom,
        width: rect.width * layout.zoom,
        height: rect.height * layout.zoom
    };
}
function parseBorderRadius(style, width, height) {
    const maxRadius = Math.max(0, Math.min(width, height) / 2);
    return {
        topLeft: Math.min(maxRadius, parseCssLengthToPx(style.borderTopLeftRadius || '0')),
        topRight: Math.min(maxRadius, parseCssLengthToPx(style.borderTopRightRadius || '0')),
        bottomRight: Math.min(maxRadius, parseCssLengthToPx(style.borderBottomRightRadius || '0')),
        bottomLeft: Math.min(maxRadius, parseCssLengthToPx(style.borderBottomLeftRadius || '0'))
    };
}
function roundedRectPath(context, rect, radius) {
    const x = rect.x;
    const y = rect.y;
    const w = rect.width;
    const h = rect.height;
    const tl = Math.min(radius.topLeft, w / 2, h / 2);
    const tr = Math.min(radius.topRight, w / 2, h / 2);
    const br = Math.min(radius.bottomRight, w / 2, h / 2);
    const bl = Math.min(radius.bottomLeft, w / 2, h / 2);
    context.beginPath();
    context.moveTo(x + tl, y);
    context.lineTo(x + w - tr, y);
    context.quadraticCurveTo(x + w, y, x + w, y + tr);
    context.lineTo(x + w, y + h - br);
    context.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    context.lineTo(x + bl, y + h);
    context.quadraticCurveTo(x, y + h, x, y + h - bl);
    context.lineTo(x, y + tl);
    context.quadraticCurveTo(x, y, x + tl, y);
    context.closePath();
}
function paintBackground(context, rect, radius, style) {
    const color = safeCanvasColor(style.backgroundColor, 'transparent');
    const image = style.backgroundImage || 'none';
    const hasColor = color !== 'transparent' && !/rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/i.test(color);
    const gradient = image.includes('linear-gradient') ? createLinearGradientPaint(context, rect, image) : undefined;
    if (!hasColor && !gradient)
        return;
    context.save();
    roundedRectPath(context, rect, radius);
    context.fillStyle = gradient ?? color;
    context.fill();
    context.restore();
}
function paintBorders(context, rect, radius, style) {
    const top = borderSide(style.borderTopWidth, style.borderTopStyle, style.borderTopColor);
    const right = borderSide(style.borderRightWidth, style.borderRightStyle, style.borderRightColor);
    const bottom = borderSide(style.borderBottomWidth, style.borderBottomStyle, style.borderBottomColor);
    const left = borderSide(style.borderLeftWidth, style.borderLeftStyle, style.borderLeftColor);
    const sides = [top, right, bottom, left].filter((side) => side.width > 0);
    if (!sides.length)
        return;
    const same = sides.length === 4 && top.width === right.width && top.width === bottom.width && top.width === left.width && top.color === right.color && top.color === bottom.color && top.color === left.color;
    if (same) {
        context.save();
        roundedRectPath(context, rect, radius);
        context.strokeStyle = top.color;
        context.lineWidth = top.width;
        context.stroke();
        context.restore();
        return;
    }
    context.save();
    context.lineCap = 'butt';
    if (top.width)
        drawLine(context, rect.x, rect.y + top.width / 2, rect.x + rect.width, rect.y + top.width / 2, top);
    if (right.width)
        drawLine(context, rect.x + rect.width - right.width / 2, rect.y, rect.x + rect.width - right.width / 2, rect.y + rect.height, right);
    if (bottom.width)
        drawLine(context, rect.x, rect.y + rect.height - bottom.width / 2, rect.x + rect.width, rect.y + rect.height - bottom.width / 2, bottom);
    if (left.width)
        drawLine(context, rect.x + left.width / 2, rect.y, rect.x + left.width / 2, rect.y + rect.height, left);
    context.restore();
}
function borderSide(width, style, color) {
    const hidden = !style || style === 'none' || style === 'hidden';
    return {
        width: hidden ? 0 : Math.max(0, parseCssLengthToPx(width || '0')),
        color: safeCanvasColor(color, '#000000')
    };
}
function drawLine(context, x1, y1, x2, y2, side) {
    context.strokeStyle = side.color;
    context.lineWidth = side.width;
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();
}
function paintBoxShadow(context, rect, radius, rawShadow) {
    if (!rawShadow || rawShadow === 'none')
        return;
    const shadows = splitCssTopLevelCommas(rawShadow).map(parseBoxShadow).filter((shadow) => Boolean(shadow));
    for (const shadow of shadows) {
        if (shadow.inset)
            continue;
        const spreadRect = {
            x: rect.x - shadow.spread,
            y: rect.y - shadow.spread,
            width: rect.width + shadow.spread * 2,
            height: rect.height + shadow.spread * 2
        };
        context.save();
        context.shadowColor = shadow.color;
        context.shadowBlur = shadow.blur;
        context.shadowOffsetX = shadow.offsetX;
        context.shadowOffsetY = shadow.offsetY;
        context.fillStyle = shadow.color;
        roundedRectPath(context, spreadRect, radius);
        context.fill();
        context.restore();
    }
}
function parseBoxShadow(value) {
    const inset = /\binset\b/i.test(value);
    const colorMatch = value.match(/rgba?\([^)]*\)|hsla?\([^)]*\)|#[0-9a-f]{3,8}\b|\b[a-z]+\b/i);
    const color = colorMatch ? safeCanvasColor(colorMatch[0], 'rgba(0,0,0,.25)') : 'rgba(0,0,0,.25)';
    const withoutColor = colorMatch ? value.replace(colorMatch[0], '') : value;
    const numbers = withoutColor.match(/-?\d*\.?\d+(?:px)?/gi)?.map(parseCssLengthToPx) ?? [];
    if (numbers.length < 2)
        return undefined;
    return {
        inset,
        offsetX: numbers[0] ?? 0,
        offsetY: numbers[1] ?? 0,
        blur: Math.max(0, numbers[2] ?? 0),
        spread: numbers[3] ?? 0,
        color
    };
}
function createLinearGradientPaint(context, rect, image) {
    const match = /linear-gradient\((.*)\)/i.exec(image);
    if (!match)
        return undefined;
    const parts = splitCssTopLevelCommas(match[1]);
    if (parts.length < 2)
        return undefined;
    let angle = 180;
    let stopStart = 0;
    const first = parts[0].trim();
    if (/deg\b/i.test(first)) {
        angle = Number.parseFloat(first);
        stopStart = 1;
    }
    else if (/to\s+right/i.test(first)) {
        angle = 90;
        stopStart = 1;
    }
    else if (/to\s+left/i.test(first)) {
        angle = 270;
        stopStart = 1;
    }
    else if (/to\s+bottom/i.test(first)) {
        angle = 180;
        stopStart = 1;
    }
    else if (/to\s+top/i.test(first)) {
        angle = 0;
        stopStart = 1;
    }
    const radians = ((angle - 90) * Math.PI) / 180;
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const half = Math.sqrt(rect.width * rect.width + rect.height * rect.height) / 2;
    const x1 = cx - Math.cos(radians) * half;
    const y1 = cy - Math.sin(radians) * half;
    const x2 = cx + Math.cos(radians) * half;
    const y2 = cy + Math.sin(radians) * half;
    const gradient = context.createLinearGradient(x1, y1, x2, y2);
    const stops = parts.slice(stopStart);
    stops.forEach((stop, index) => {
        const parsed = parseGradientStop(stop, stops.length, index);
        gradient.addColorStop(parsed.offset, parsed.color);
    });
    return gradient;
}
function parseGradientStop(stop, total, index) {
    const colorMatch = stop.match(/rgba?\([^)]*\)|hsla?\([^)]*\)|#[0-9a-f]{3,8}\b|\b[a-z]+\b/i);
    const color = colorMatch ? safeCanvasColor(colorMatch[0], '#000000') : '#000000';
    const afterColor = colorMatch ? stop.slice((colorMatch.index ?? 0) + colorMatch[0].length) : '';
    const pctMatch = afterColor.match(/(-?\d*\.?\d+)%/);
    const offset = pctMatch ? Number.parseFloat(pctMatch[1]) / 100 : total <= 1 ? 0 : index / (total - 1);
    return { color, offset: Math.min(1, Math.max(0, offset)) };
}
function splitCssTopLevelCommas(value) {
    const parts = [];
    let depth = 0;
    let current = '';
    for (const char of value) {
        if (char === '(')
            depth += 1;
        if (char === ')')
            depth = Math.max(0, depth - 1);
        if (char === ',' && depth === 0) {
            parts.push(current.trim());
            current = '';
        }
        else {
            current += char;
        }
    }
    if (current.trim())
        parts.push(current.trim());
    return parts;
}
function safeCanvasColor(value, fallback) {
    const color = value.trim();
    if (!color)
        return fallback;
    return color;
}
function canvasFontFromStyle(style, scale = 1) {
    const fontStyle = style.fontStyle && style.fontStyle !== 'normal' ? style.fontStyle : '';
    const fontVariant = style.fontVariant && style.fontVariant !== 'normal' ? style.fontVariant : '';
    const fontWeight = style.fontWeight || '400';
    const fontSizePx = Math.max(1, parseCssLengthToPx(style.fontSize || '12px') * scale);
    const fontFamily = style.fontFamily || 'sans-serif';
    return [fontStyle, fontVariant, fontWeight, `${fontSizePx}px`, fontFamily].filter(Boolean).join(' ');
}
function paintHeaderFooterCanvas(context, layout, pageNumber, totalPages, options) {
    if (options.header)
        paintHeaderFooterLineCanvas(context, layout, options.header, pageNumber, totalPages, 'header');
    if (options.footer)
        paintHeaderFooterLineCanvas(context, layout, options.footer, pageNumber, totalPages, 'footer');
}
function paintHeaderFooterLineCanvas(context, layout, config, pageNumber, totalPages, slot) {
    const text = formatPageText(config.text, pageNumber, totalPages);
    const fontSize = config.fontSizePx ?? 10;
    const offset = config.offsetPx ?? 0;
    const y = slot === 'header'
        ? Math.max(4, layout.metrics.margin.top / 2 + fontSize / 2 + offset)
        : layout.metrics.heightPx - Math.max(4, layout.metrics.margin.bottom / 2 - fontSize / 2 - offset);
    context.save();
    context.font = `${fontSize}px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
    context.fillStyle = config.color ?? '#4b5563';
    context.textBaseline = 'alphabetic';
    context.textAlign = config.position ?? 'center';
    const x = config.position === 'left'
        ? layout.metrics.margin.left
        : config.position === 'right'
            ? layout.metrics.widthPx - layout.metrics.margin.right
            : layout.metrics.widthPx / 2;
    context.fillText(text, x, y, layout.metrics.widthPx - layout.metrics.margin.left - layout.metrics.margin.right);
    context.restore();
}
function formatPageText(text, pageNumber, totalPages) {
    return text.replace(/\{page\}/g, String(pageNumber)).replace(/\{pages\}/g, String(totalPages));
}
function extractPageText(layout, page, totalPages, options) {
    const rootRect = layout.root.getBoundingClientRect();
    const positionedGlyphs = [];
    const range = document.createRange();
    let order = 0;
    for (const node of collectTextNodes(layout.root)) {
        const parent = node.parentElement;
        if (!parent)
            continue;
        const computed = window.getComputedStyle(parent);
        if (computed.color === 'transparent' || computed.fontSize === '0px')
            continue;
        const raw = node.nodeValue ?? '';
        const segments = segmentTextWithOffsets(raw);
        const fontSize = Math.max(1, parseCssLengthToPx(computed.fontSize || '12px') * layout.zoom);
        const isWhitespacePreserved = /pre|break-spaces/i.test(computed.whiteSpace || 'normal');
        for (const segment of segments) {
            // Under normal white-space handling browsers collapse many source whitespace code points.
            // Range rects are the source of truth: only code points with a visible client rect become
            // selectable glyphs. Preserved whitespace keeps its source character when a rect exists.
            const text = segment.text.trim()
                ? segment.text
                : isWhitespacePreserved
                    ? segment.text.replace(/\r\n?/g, '\n')
                    : ' ';
            try {
                range.setStart(node, segment.start);
                range.setEnd(node, segment.end);
            }
            catch {
                order += 1;
                continue;
            }
            const rect = bestRangeRect(range);
            if (!rect || rect.width <= 0 || rect.height <= 0) {
                order += 1;
                continue;
            }
            const topInSource = rect.top - rootRect.top;
            const bottomInSource = rect.bottom - rootRect.top;
            if (bottomInSource < page.startY - 1 || topInSource > page.endY + 1) {
                order += 1;
                continue;
            }
            const xPx = layout.metrics.margin.left + layout.xOffsetPx + (rect.left - rootRect.left) * layout.zoom;
            const yTop = layout.metrics.margin.top + (topInSource - page.startY) * layout.zoom;
            const widthPx = Math.max(0.01, rect.width * layout.zoom);
            const heightPx = Math.max(0.01, rect.height * layout.zoom);
            const yPx = yTop + heightPx * 0.78;
            const lineKey = Math.round((yTop + heightPx / 2) * 1.5);
            positionedGlyphs.push({
                text,
                pageIndex: page.index,
                xPx,
                yPx,
                widthPx,
                heightPx,
                fontSizePx: fontSize,
                order,
                lineKey
            });
            order += 1;
        }
    }
    order = appendFormControlGlyphs(positionedGlyphs, layout, page, order);
    appendHeaderFooterGlyphs(positionedGlyphs, layout, page.index + 1, totalPages, options, order);
    range.detach();
    return orderGlyphsForPdf(positionedGlyphs).map(({ order: _order, lineKey: _lineKey, ...glyph }) => glyph);
}
function segmentTextWithOffsets(value) {
    const segments = segmentText(value);
    const result = [];
    let offset = 0;
    for (const text of segments) {
        const start = offset;
        const end = start + text.length;
        result.push({ text, start, end });
        offset = end;
    }
    return result;
}
function bestRangeRect(range) {
    const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
    if (!rects.length)
        return undefined;
    return rects.reduce((best, rect) => (rect.width * rect.height > best.width * best.height ? rect : best), rects[0]);
}
function orderGlyphsForPdf(glyphs) {
    return [...glyphs].sort((a, b) => {
        if (a.pageIndex !== b.pageIndex)
            return a.pageIndex - b.pageIndex;
        const lineDelta = a.lineKey - b.lineKey;
        if (Math.abs(lineDelta) > 1)
            return lineDelta;
        const xDelta = a.xPx - b.xPx;
        if (Math.abs(xDelta) > 0.5)
            return xDelta;
        return a.order - b.order;
    });
}
function appendFormControlGlyphs(glyphs, layout, page, startOrder) {
    const rootRect = layout.root.getBoundingClientRect();
    let order = startOrder;
    for (const element of Array.from(layout.root.querySelectorAll('input,textarea,select'))) {
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')
            continue;
        const value = element instanceof HTMLSelectElement
            ? element.selectedOptions[0]?.textContent ?? element.value
            : element.value;
        if (!value)
            continue;
        const pageRect = firstPageRect(element, layout, page, rootRect);
        if (!pageRect)
            continue;
        const fontSizePx = Math.max(1, parseCssLengthToPx(style.fontSize || '12px') * layout.zoom);
        const paddingLeft = parseCssLengthToPx(style.paddingLeft || '0') * layout.zoom;
        let cursorX = pageRect.x + paddingLeft;
        const yPx = pageRect.y + pageRect.height / 2 + fontSizePx * 0.35;
        const measurer = getTextMeasureContext();
        measurer.font = canvasFontFromStyle(style);
        for (const segment of segmentText(value)) {
            const widthPx = Math.max(1, measurer.measureText(segment).width * layout.zoom);
            glyphs.push({
                text: segment,
                pageIndex: page.index,
                xPx: cursorX,
                yPx,
                widthPx,
                heightPx: fontSizePx * 1.2,
                fontSizePx,
                order,
                lineKey: Math.round((pageRect.y + pageRect.height / 2) * 1.5)
            });
            cursorX += widthPx;
            order += 1;
        }
    }
    return order;
}
let cachedMeasureCanvas;
let cachedMeasureContext;
function getTextMeasureContext() {
    if (cachedMeasureContext)
        return cachedMeasureContext;
    cachedMeasureCanvas = document.createElement('canvas');
    const context = cachedMeasureCanvas.getContext('2d');
    if (!context)
        throw new Error('Canvas 2D context is not available for text measurement.');
    cachedMeasureContext = context;
    return context;
}
function appendHeaderFooterGlyphs(glyphs, layout, pageNumber, totalPages, options, startOrder) {
    let order = startOrder;
    if (options.header)
        order = appendLineGlyphs(glyphs, layout, options.header, pageNumber, totalPages, 'header', order);
    if (options.footer)
        order = appendLineGlyphs(glyphs, layout, options.footer, pageNumber, totalPages, 'footer', order);
    return order;
}
function appendLineGlyphs(glyphs, layout, config, pageNumber, totalPages, slot, startOrder) {
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
    glyphs.push({
        text,
        pageIndex: pageNumber - 1,
        xPx: x,
        yPx: y,
        widthPx: estimatedWidth,
        heightPx: size * 1.2,
        fontSizePx: size,
        order: startOrder,
        lineKey: Math.round(y * 1.5)
    });
    return startOrder + text.length;
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
const TEXT_LAYER_FONT_BASE64 = 'AAEAAAAKAIAAAwAgT1MvMmV+a9gAAAEoAAAAYGNtYXBLMdr8AAABkAAAADxnbHlmESI83AAAAdQAAAAYaGVhZC93AzQAAACsAAAANmhoZWEHWgMOAAAA5AAAACRobXR4A+gAAAAAAYgAAAAGbG9jYQAMAAAAAAHMAAAABm1heHAABAAGAAABCAAAACBuYW1lJMH+CAAAAewAAAIicG9zdG1/dc8AAAQQAAAALAABAAAAAQAAh96dkV8PPPUAAwPoAAAAAOY8XzYAAAAA5jxfNgAAAAAD6APoAAAAAwACAAAAAAAAAAEAAANw/yQAAAPoAAAAAAPoAAEAAAAAAAAAAAAAAAAAAAABAAEAAAACAAQAAQAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAwPoAZAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAgAAAAAAAAAAAAPz8/PwAAACAloANw/yQAAAPoAPoAAAAAAAAAAAAAAAAAAAAgAAAD6AAAAAAAAAAAAAIAAAADAAAAFAADAAEAAAAUAAQAKAAAAAYABAABAAIAICWg//8AAAAgJaD////h2mEAAQAAAAAAAAAAAAAADAAAAAEAAAAAA+gD6AADAAAxIREhA+j8GAPoAAAADACWAAEAAAAAAAEAFQAAAAEAAAAAAAIABwAVAAEAAAAAAAMAIwAcAAEAAAAAAAQAHQA/AAEAAAAAAAUACwBcAAEAAAAAAAYAHQBnAAMAAQQJAAEAKgCEAAMAAQQJAAIADgCuAAMAAQQJAAMARgC8AAMAAQQJAAQAOgECAAMAAQQJAAUAFgE8AAMAAQQJAAYAOgFSSHRtbFRvUGRmUHJvVGV4dExheWVyUmVndWxhckh0bWxUb1BkZlByb1RleHRMYXllci1SZWd1bGFyLTQuMC4zSHRtbFRvUGRmUHJvVGV4dExheWVyIFJlZ3VsYXJWZXJzaW9uIDEuMUh0bWxUb1BkZlByb1RleHRMYXllci1SZWd1bGFyAEgAdABtAGwAVABvAFAAZABmAFAAcgBvAFQAZQB4AHQATABhAHkAZQByAFIAZQBnAHUAbABhAHIASAB0AG0AbABUAG8AUABkAGYAUAByAG8AVABlAHgAdABMAGEAeQBlAHIALQBSAGUAZwB1AGwAYQByAC0ANAAuADAALgAzAEgAdABtAGwAVABvAFAAZABmAFAAcgBvAFQAZQB4AHQATABhAHkAZQByACAAUgBlAGcAdQBsAGEAcgBWAGUAcgBzAGkAbwBuACAAMQAuADEASAB0AG0AbABUAG8AUABkAGYAUAByAG8AVABlAHgAdABMAGEAeQBlAHIALQBSAGUAZwB1AGwAYQByAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAABAgVnbHlwaA==';
let cachedTextLayerFontBytes;
function getTextLayerFontBytes() {
    if (cachedTextLayerFontBytes)
        return cachedTextLayerFontBytes;
    const binary = atob(TEXT_LAYER_FONT_BASE64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1)
        bytes[i] = binary.charCodeAt(i) & 0xff;
    cachedTextLayerFontBytes = bytes;
    return bytes;
}
function createCidToGidMap(maxCid) {
    const bytes = new Uint8Array((maxCid + 1) * 2);
    for (let cid = 1; cid <= maxCid; cid += 1) {
        const offset = cid * 2;
        bytes[offset] = 0;
        bytes[offset + 1] = 1;
    }
    return bytes;
}
function buildPdf(pages, bookmarks, metrics, options) {
    const pdf = new PdfBuilder();
    const pagesObjectId = pdf.reserve();
    const textFont = createUnicodeTextFont(pdf, collectPdfTextCharacters(pages));
    const pageObjectIds = [];
    for (const [index, page] of pages.entries()) {
        const imageObjectId = pdf.add(pdf.stream(`/Type /XObject /Subtype /Image /Width ${page.imageWidth} /Height ${page.imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`, page.imageBytes));
        const annotationIds = page.links.map((link) => pdf.add(createLinkAnnotation(link, metrics)));
        const contentObjectId = pdf.add(pdf.stream('', createContentStream(page, index, imageObjectId, textFont, metrics)));
        const annots = annotationIds.length ? `/Annots [${annotationIds.map((id) => `${id} 0 R`).join(' ')}]` : '';
        const pageObjectId = pdf.add([
            '<< /Type /Page',
            `/Parent ${pagesObjectId} 0 R`,
            `/MediaBox [0 0 ${pdfNumber(metrics.widthPt)} ${pdfNumber(metrics.heightPt)}]`,
            `/Resources << /XObject << /Im${index + 1} ${imageObjectId} 0 R >> /Font << /F${textFont.id} ${textFont.fontObjectId} 0 R >> /ExtGState << /GSText << /Type /ExtGState /ca 0 /CA 0 >> >> >>`,
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
function collectPdfTextCharacters(pages) {
    const chars = [];
    for (const page of pages) {
        for (const glyph of page.glyphs)
            chars.push(...segmentText(glyph.text));
    }
    return chars.length ? chars : [' '];
}
function createContentStream(page, pageIndex, imageObjectId, font, metrics) {
    const commands = [];
    commands.push('q', `${pdfNumber(metrics.widthPt)} 0 0 ${pdfNumber(metrics.heightPt)} 0 0 cm`, `/Im${pageIndex + 1} Do`, 'Q');
    // Write the text layer *after* the visual image with normal text rendering and zero non-stroking alpha.
    // This preserves the OCR-PDF interaction pattern while avoiding a common viewer edge case where
    // text rendering mode 3 exposes an I-beam cursor but does not create a selectable range. The
    // topmost Type0/CID text is fully transparent, has real glyph outlines, and remains searchable/copyable.
    if (page.glyphs.length) {
        commands.push('q', '/GSText gs', '0 0 0 rg');
        for (const glyph of page.glyphs) {
            const encoded = encodePdfGlyphText(glyph.text, font);
            if (!encoded)
                continue;
            const x = pxToPt(glyph.xPx, metrics.widthPx, metrics.widthPt);
            const y = metrics.heightPt - pxToPt(glyph.yPx, metrics.heightPx, metrics.heightPt);
            const fontSize = Math.max(1, pxToPt(glyph.fontSizePx, metrics.widthPx, metrics.widthPt));
            const widthPt = Math.max(0.1, pxToPt(glyph.widthPx, metrics.widthPx, metrics.widthPt));
            const naturalWidthPt = Math.max(0.1, encoded.count * fontSize);
            const horizontalScale = clampNumber((widthPt / naturalWidthPt) * 100, 5, 1000, 100);
            commands.push(`/Span << /ActualText <${utf16BeHex(glyph.text)}> >> BDC`, 'BT', `/F${font.id} ${pdfNumber(fontSize)} Tf`, '0 Tr', `${pdfNumber(horizontalScale)} Tz`, `1 0 0 1 ${pdfNumber(x)} ${pdfNumber(y)} Tm`, `<${encoded.hex}> Tj`, 'ET', 'EMC');
        }
        commands.push('Q');
    }
    void imageObjectId;
    return commands.join('\n');
}
function encodePdfGlyphText(text, font) {
    const chars = segmentText(text);
    if (!chars.length)
        return undefined;
    const hex = chars
        .map((char) => {
        const code = font.charToCode.get(char) ?? font.charToCode.get(' ');
        return code ? code.toString(16).padStart(4, '0').toUpperCase() : '';
    })
        .join('');
    return hex ? { hex, count: chars.length } : undefined;
}
function createUnicodeTextFont(pdf, chars) {
    const unique = Array.from(new Set(chars.filter((char) => char.length > 0)));
    if (!unique.includes(' '))
        unique.unshift(' ');
    if (unique.length > 65534) {
        throw new Error(`PDF text layer contains too many unique graphemes: ${unique.length}`);
    }
    const charToCode = new Map();
    unique.forEach((char, index) => charToCode.set(char, index + 1));
    const fontBytes = getTextLayerFontBytes();
    const fontFileObjectId = pdf.add(pdf.stream(`/Length1 ${fontBytes.length}`, fontBytes));
    const cidToGidMapObjectId = pdf.add(pdf.stream('', createCidToGidMap(unique.length)));
    const descriptorObjectId = pdf.add([
        '<< /Type /FontDescriptor',
        '/FontName /HtmlToPdfProTextLayer',
        '/Flags 4',
        '/FontBBox [0 -250 1000 1000]',
        '/ItalicAngle 0',
        '/Ascent 880',
        '/Descent -220',
        '/CapHeight 700',
        '/StemV 80',
        `/FontFile2 ${fontFileObjectId} 0 R`,
        '>>'
    ].join('\n'));
    const widths = unique.map(() => '1000').join(' ');
    const cidFontObjectId = pdf.add([
        '<< /Type /Font /Subtype /CIDFontType2',
        '/BaseFont /HtmlToPdfProTextLayer',
        '/CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >>',
        `/FontDescriptor ${descriptorObjectId} 0 R`,
        '/DW 1000',
        `/W [1 [${widths}]]`,
        `/CIDToGIDMap ${cidToGidMapObjectId} 0 R`,
        '>>'
    ].join('\n'));
    const toUnicodeId = pdf.add(pdf.stream('', createToUnicodeCMap(unique)));
    const fontObjectId = pdf.add([
        '<< /Type /Font /Subtype /Type0',
        '/BaseFont /HtmlToPdfProTextLayer',
        '/Encoding /Identity-H',
        `/DescendantFonts [${cidFontObjectId} 0 R]`,
        `/ToUnicode ${toUnicodeId} 0 R`,
        '>>'
    ].join('\n'));
    return { id: 1, fontObjectId, charToCode };
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
        '<0001> <FFFF>',
        'endcodespacerange'
    ];
    for (let i = 0; i < chars.length; i += 100) {
        const slice = chars.slice(i, i + 100);
        lines.push(`${slice.length} beginbfchar`);
        slice.forEach((char, offset) => {
            const code = i + offset + 1;
            lines.push(`<${code.toString(16).padStart(4, '0').toUpperCase()}> <${utf16BeHexWithoutBom(char)}>`);
        });
        lines.push('endbfchar');
    }
    lines.push('endcmap', 'CMapName currentdict /CMap defineresource pop', 'end', 'end');
    return lines.join('\n');
}
function toArrayBuffer(bytes) {
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    return buffer;
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
