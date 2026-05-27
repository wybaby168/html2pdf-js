export type HtmlToPdfSource = string | HTMLElement | HtmlToPdfHtmlSource | HtmlToPdfMarkdownSource;
export type HtmlToPdfImageType = 'jpeg' | 'png';
export type HtmlToPdfOrientation = 'portrait' | 'landscape';
export type HtmlToPdfPageFormat = 'a4' | 'letter' | 'legal' | string;
export type HtmlToPdfEngine = 'dom-canvas-text';
export type HtmlToPdfPageBreakMode = 'slice' | 'avoid';
export type HtmlToPdfHeaderFooterPosition = 'left' | 'center' | 'right';
export interface HtmlToPdfHtmlSource {
    type: 'html';
    html: string;
    baseUrl?: string;
}
export interface HtmlToPdfMarkdownSource {
    type: 'markdown';
    markdown: string;
    baseUrl?: string;
}
export interface HtmlToPdfPageOptions {
    format?: HtmlToPdfPageFormat;
    widthMm?: number;
    heightMm?: number;
    orientation?: HtmlToPdfOrientation;
}
export interface HtmlToPdfFontFace {
    fontFamily: string;
    src: string;
    fontWeight?: string | number;
    fontStyle?: string;
    fontDisplay?: string;
    unicodeRange?: string;
}
export interface HtmlToPdfHeaderFooter {
    text: string;
    position?: HtmlToPdfHeaderFooterPosition;
    fontSizePx?: number;
    color?: string;
    offsetPx?: number;
}
export type HtmlToPdfProgressPhase = 'clone' | 'styles' | 'assets' | 'layout' | 'paginate' | 'render-start' | 'render-page' | 'text-layer' | 'pdf' | 'save';
export interface HtmlToPdfProgressEvent {
    phase: HtmlToPdfProgressPhase;
    message?: string;
    page?: number;
    totalPages?: number;
    ratio?: number;
    filename?: string;
}
export type HtmlToPdfProgressHandler = (event: HtmlToPdfProgressEvent) => void;
export interface HtmlToPdfProOptions {
    filename?: string;
    page?: HtmlToPdfPageOptions;
    /** CSS @page margin shorthand. Supports px, pt, mm, cm and in, for example: 18mm 14mm 19mm 14mm. */
    margin?: string;
    /** Internal export resolution. Visual output is rendered at dpi / 96 scale. */
    dpi?: number;
    imageType?: HtmlToPdfImageType;
    imageQuality?: number;
    backgroundColor?: string | null;
    /** If true, shrink the source layout width to the PDF content width while preserving the original layout. */
    fitToPage?: boolean;
    /** Extra transparent bleed around each slice to avoid antialiasing seams. */
    bleedPx?: number;
    pageBreakMode?: HtmlToPdfPageBreakMode;
    avoidBreakSelectors?: string;
    forceBreakBeforeSelectors?: string;
    collectStyles?: boolean;
    includeExternalStylesheets?: boolean;
    inlineImages?: boolean;
    inlineCanvas?: boolean;
    inlineCssResources?: boolean;
    materializePseudoElements?: boolean;
    sanitize?: boolean;
    textLayer?: boolean;
    linkAnnotations?: boolean;
    bookmarks?: boolean;
    header?: string | HtmlToPdfHeaderFooter;
    footer?: string | HtmlToPdfHeaderFooter;
    extraCss?: string;
    fontFaces?: HtmlToPdfFontFace[];
    timeoutMs?: number;
    resourceErrorMode?: 'ignore' | 'warn' | 'throw';
    engine?: HtmlToPdfEngine;
    onProgress?: HtmlToPdfProgressHandler;
}
export interface ResolvedHtmlToPdfProOptions {
    filename: string;
    page: Required<Pick<HtmlToPdfPageOptions, 'widthMm' | 'heightMm'>> & HtmlToPdfPageOptions;
    margin: string;
    dpi: number;
    imageType: HtmlToPdfImageType;
    imageQuality: number;
    backgroundColor: string | null;
    fitToPage: boolean;
    bleedPx: number;
    pageBreakMode: HtmlToPdfPageBreakMode;
    avoidBreakSelectors: string;
    forceBreakBeforeSelectors: string;
    collectStyles: boolean;
    includeExternalStylesheets: boolean;
    inlineImages: boolean;
    inlineCanvas: boolean;
    inlineCssResources: boolean;
    materializePseudoElements: boolean;
    sanitize: boolean;
    textLayer: boolean;
    linkAnnotations: boolean;
    bookmarks: boolean;
    header?: HtmlToPdfHeaderFooter;
    footer?: HtmlToPdfHeaderFooter;
    extraCss: string;
    fontFaces: HtmlToPdfFontFace[];
    timeoutMs: number;
    resourceErrorMode: 'ignore' | 'warn' | 'throw';
    engine: HtmlToPdfEngine;
    onProgress: HtmlToPdfProgressHandler;
}
export declare class HtmlToPdfPro {
    private readonly options;
    constructor(options?: HtmlToPdfProOptions);
    toPdf(source: HtmlToPdfSource, overrideOptions?: HtmlToPdfProOptions): Promise<Uint8Array>;
    outputBlob(source: HtmlToPdfSource, overrideOptions?: HtmlToPdfProOptions): Promise<Blob>;
    download(source: HtmlToPdfSource, overrideOptions?: HtmlToPdfProOptions): Promise<void>;
    fromHtml(html: string, overrideOptions?: HtmlToPdfProOptions): Promise<Uint8Array>;
    downloadHtml(html: string, overrideOptions?: HtmlToPdfProOptions): Promise<void>;
    fromMarkdown(markdown: string, overrideOptions?: HtmlToPdfProOptions): Promise<Uint8Array>;
    downloadMarkdown(markdown: string, overrideOptions?: HtmlToPdfProOptions): Promise<void>;
    serialize(source: HtmlToPdfSource, overrideOptions?: HtmlToPdfProOptions): Promise<string>;
    nativePrint(source: HtmlToPdfSource, overrideOptions?: HtmlToPdfProOptions): Promise<void>;
    private createLayout;
}
//# sourceMappingURL=HtmlToPdfPro.d.ts.map