# HtmlToPdfPro

HtmlToPdfPro 是一套面向业务页面的 **自研高保真 HTML 转 PDF 前端组件**。这一版不再接入 IronPress，也不再使用 `html2canvas`、`jsPDF`、`Paged.js` 或浏览器打印弹窗作为主链路。

核心目标：把现有业务 HTML 页面尽量按屏幕效果原样输出成 PDF，同时让 PDF 内的文字可以复制、搜索，并保留链接标注和书签目录。

## 当前实现路线

```text
业务 DOM
  -> 克隆 DOM / 保留表单和 Canvas 状态
  -> 收集当前页面 CSS / 字体声明 / 额外 CSS
  -> 内联图片、SVG image、Canvas
  -> 基于浏览器真实布局测量元素位置
  -> 自研分页算法计算 page slice
  -> 自研 DOM Canvas Painter 合成视觉层，不使用 html2canvas，也不使用 SVG foreignObject 截图
  -> Range.getClientRects() 按 grapheme/逐字计算文字坐标，避免中文连续文本自动换行时丢字
  -> 自研 PDF writer 先写页面图像，再叠加 0 透明度的可选文字层、链接、书签
  -> Blob 自动下载，不打开打印框
```

严格说，浏览器仍然是最可靠的 HTML/CSS 布局引擎；本项目自研的是 **导出排版管线、分页、文字层提取、PDF 对象组装**。这样可以最大化还原已有页面，而不是重新实现一整套不可能短期追平浏览器的 CSS layout engine。

在线预览：https://htmltopdfpro.vercel.app

npm 包：https://www.npmjs.com/package/@flyfish-dev/html2pdf-js

GitHub 仓库：https://github.com/wybaby168/html2pdf-js

## 包名

```bash
@flyfish-dev/html2pdf-js
```

命名说明：

- 包名符合 npm 专业命名规范：全小写、短横线分词、语义清晰。
- `flyfish-dev` scope 用于明确发布归属，包名主体保持直接、专业、可检索。
- 包名、GitHub 仓库和 Vercel demo 可以互相追溯。

## 仓库结构

```text
html-to-pdf-pro/
├── packages/
│   └── html2pdf-js/
│       ├── src/
│       │   ├── HtmlToPdfPro.ts
│       │   └── index.ts
│       ├── dist/
│       ├── package.json
│       ├── README.md
│       └── tsconfig.json
├── src/
│   ├── demo.css
│   └── demo.ts
├── docs/
│   └── INTEGRATION.md
├── index.html
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── THIRD_PARTY_NOTICES.md
├── tsconfig.json
└── vite.config.ts
```

## 核心能力

- 高保真视觉输出：使用浏览器原生 DOM/CSS 布局结果作为坐标源，自研 Canvas Painter 绘制渐变、阴影、圆角、边框、文本、表格和常见图片/Canvas 内容。
- 可复制文字：组件自行通过 `Range.getClientRects()` 按 grapheme/逐字提取文字位置，并在 PDF 页面最上层叠加 0 透明度的真实 Unicode 文字层。文字层使用 Type0/CIDFont、ToUnicode、ActualText 和零透明度 ExtGState，避免“只有 I-beam 但拖不出选区”的图片遮挡问题，也避免中文长句被浏览器自动换行后出现行首/行尾文字缺失。
- 自动下载：通过 Blob URL 自动保存，不弹出系统打印框。
- 自研 PDF writer：不依赖 `jsPDF`，直接写 PDF objects、xref、image XObject、annotation、outline，以及嵌入式 Type0/CIDFont + ToUnicode/ActualText + 透明 ExtGState 文字层。
- 分页控制：支持 `.pdf-page-break` 强制分页，`.avoid-break` / `.pdf-avoid-break` 避免关键内容断开。
- 链接与目录：支持 `<a href>` 链接标注，支持 `h1`~`h6` / `data-pdf-bookmark` 生成 PDF bookmarks。
- 输入灵活：支持 CSS selector、`HTMLElement`、HTML 字符串、Markdown 字符串。
- TypeScript 组件化：完整类型定义，支持进度回调和多种输出方式。

## 本地运行 Demo

```bash
pnpm install
pnpm dev
```

点击页面上的 **生成高保真可复制 PDF** 即可体验自动生成；点击 **导出 HTML 快照** 可以保存组件实际使用的独立 DOM 快照，方便排查排版问题。

## 在业务项目中使用

```bash
pnpm add @flyfish-dev/html2pdf-js
```

```ts
import { HtmlToPdfPro } from '@flyfish-dev/html2pdf-js';

const exporter = new HtmlToPdfPro({
  filename: 'report.pdf',
  page: { format: 'a4' },
  margin: '18mm 14mm 19mm 14mm',
  dpi: 192,
  imageQuality: 0.96,
  fitToPage: true,
  pageBreakMode: 'avoid',
  textLayer: true,
  linkAnnotations: true,
  bookmarks: true,
  header: 'Business Report',
  footer: 'Page {page} of {pages}',
  extraCss: '.toolbar { display: none !important; }'
});

await exporter.download('#report');
```

## API

### `download(source, options?)`

生成并自动下载 PDF。

```ts
await exporter.download('#report');
await exporter.download(document.querySelector('#report') as HTMLElement, {
  filename: 'custom-report.pdf'
});
```

### `toPdf(source, options?)`

返回 PDF bytes。

```ts
const bytes = await exporter.toPdf('#report');
```

### `outputBlob(source, options?)`

返回 `Blob`，适合上传到接口或存入 IndexedDB。

```ts
const blob = await exporter.outputBlob('#report');
```

### `fromHtml(html, options?)` / `downloadHtml(html, options?)`

直接把 HTML 字符串生成 PDF。

### `fromMarkdown(markdown, options?)` / `downloadMarkdown(markdown, options?)`

内置轻量 Markdown 转 HTML，再走同一套 HTML 导出管线。

### `serialize(source, options?)`

导出组件内部使用的 HTML 快照，方便复现资源内联、样式收集、伪元素物化后的最终输入。

## 常用配置

| 参数 | 默认值 | 说明 |
|---|---:|---|
| `filename` | `document.pdf` | 下载文件名 |
| `page.format` | `a4` | `a4` / `letter` / `legal`，也可用 `widthMm` / `heightMm` 自定义 |
| `margin` | `18mm 14mm 18mm 14mm` | 页面边距，支持 CSS 长度单位 |
| `dpi` | `180` | 视觉层导出分辨率，越高越清晰，也越耗内存 |
| `imageQuality` | `0.94` | JPEG 质量 |
| `fitToPage` | `true` | 将源页面宽度等比压入 PDF 内容区域 |
| `bleedPx` | `24` | 页面切片安全边距 |
| `pageBreakMode` | `avoid` | 分页时尽量避开关键块 |
| `avoidBreakSelectors` | 内置常用选择器 | 避免被分页切开的元素 |
| `forceBreakBeforeSelectors` | `.pdf-page-break,[data-pdf-page-break="before"]` | 强制分页选择器 |
| `collectStyles` | `true` | 收集当前页面 CSS |
| `inlineImages` | `true` | 尝试把图片转成 data URL |
| `inlineCanvas` | `true` | 把 Canvas 状态转为图片 |
| `materializePseudoElements` | `true` | 将可解析的 `::before` / `::after` 文本物化到 DOM |
| `textLayer` | `true` | 生成顶层透明可复制文字层 |
| `linkAnnotations` | `true` | 保留链接点击区域 |
| `bookmarks` | `true` | 生成 PDF 目录书签 |

## 分页标记

```html
<section class="pdf-page-break">从新页开始</section>
<div class="avoid-break">这个模块尽量不要被截断</div>
```

也可以自定义：

```ts
new HtmlToPdfPro({
  forceBreakBeforeSelectors: '.chapter,[data-break-before]',
  avoidBreakSelectors: '.card,.invoice-row,.signature-block'
});
```


## 验证用例

```bash
npm run test:pdf
```

测试会在真实 Chromium 中调用组件生成 PDF，并使用 `pdfinfo`、`pdftotext`、`pdftotext -bbox`、`pdftohtml -xml` 检查结构和文字层。当前包含三组用例：

- `browser-smoke.pdf`：基础分页、渐变、圆角、表格、链接和可复制文字。
- `full-demo.pdf`：项目首页 demo，覆盖中文段落、业务卡片、长表格、5 页分页。
- `complex-elements.pdf`：连续中文自动换行、inline strong/em/code/link、grid、list、table、input/select/textarea、pre/code。

## 重要边界

- 本方案为了“原样还原”会把视觉层作为页面图像写入 PDF，同时写入可选文字层；文字可复制/搜索，但 PDF 内可编辑矢量文本不是主目标。
- 跨域图片、字体或 CSS 如果没有 CORS 权限，可能无法内联；可通过 `resourceErrorMode` 控制忽略、警告或抛错。
- 极长页面或超大图片会消耗浏览器内存，生产环境建议按业务文档拆分导出或降低 `dpi`。
- 数学公式、图表、代码高亮等只要已经在浏览器 DOM 中渲染完成，就可以作为视觉层输出；文字层会尽量提取 DOM 文本。

## License

AGPL-3.0-only. See [LICENSE](./LICENSE).
