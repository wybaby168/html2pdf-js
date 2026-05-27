# HtmlToPdfPro

HtmlToPdfPro 是一个 TypeScript 前端组件，用于把业务 HTML 页面导出为版式稳定、视觉还原度高的 PDF。它适合项目报告、报价单、账单、合同、审批附件、运营报表等需要直接从网页生成交付文档的场景。

在线预览：https://htmltopdfpro.vercel.app

## 核心能力

- 基于浏览器实际渲染结果生成高保真 PDF。
- 支持 `@page`、页眉页脚、页码、强制分页、避免断页、长表格表头重复。
- TypeScript 组件化 API，支持进度回调。
- 导出目标可以是 CSS 选择器，也可以是现有 `HTMLElement`。
- 支持直接下载、返回 `Blob`、返回 `jsPDF` 实例，以及打开浏览器打印。
- Demo 自托管 Paged.js polyfill，减少运行时 CDN 波动。
- 生产构建会压缩、关闭 sourcemap，并对 JavaScript chunk 做混淆。

## 在线 Demo

当前 demo 展示的是一份专业项目交付报告，可导出为 `HtmlToPdfPro-project-report.pdf`。

本地运行：

```bash
pnpm install
pnpm dev
```

打开 Vite 输出的本地地址，点击“下载 PDF”即可体验导出。

## 安装与集成

本仓库包含一个 Vite demo 应用和一个可复用组件。迁移到其他前端项目时，先安装运行时依赖：

```bash
pnpm add html2canvas@1.4.1 jspdf@4.2.1 pagedjs@0.4.3
```

然后复制组件文件：

```text
src/components/HtmlToPdfPro.ts
src/components/index.ts
```

也可以把本项目整理为内部包后在业务项目中引用。

## 最小示例

```ts
import { HtmlToPdfPro } from './components';

const exporter = new HtmlToPdfPro({
  filename: 'report.pdf',
  page: { format: 'a4' },
  margin: '18mm 14mm 19mm 14mm',
  scale: 2.5,
  imageType: 'jpeg',
  imageQuality: 0.96,
  useCORS: true,
  pagedScriptUrl: new URL('./vendor/paged.polyfill.js', window.location.href).toString()
});

await exporter.download('#report');
```

HTML：

```html
<button id="download">导出 PDF</button>

<article id="report">
  <h1>项目报告</h1>
  <p>这里是需要导出的业务内容。</p>
</article>
```

## API

### `new HtmlToPdfPro(options?)`

创建导出实例。建议在页面或模块初始化时创建一次，并在后续导出操作中复用。

### `download(source, options?)`

生成并下载 PDF。`source` 可以是 CSS 选择器或 `HTMLElement`。

```ts
await exporter.download('#report');
await exporter.download(document.querySelector('#report') as HTMLElement, {
  filename: 'custom-report.pdf'
});
```

### `toPdf(source, options?)`

返回 `jsPDF` 实例，适合继续做自定义处理。

```ts
const pdf = await exporter.toPdf('#report');
pdf.save('report.pdf');
```

### `outputBlob(source, options?)`

返回 `Blob`，适合上传到接口、写入 IndexedDB 或自定义保存。

```ts
const blob = await exporter.outputBlob('#report');
const formData = new FormData();
formData.append('file', blob, 'report.pdf');
```

### `nativePrint(source, options?)`

创建分页 DOM 后打开浏览器打印窗口。

```ts
await exporter.nativePrint('#report');
```

### `createPagedFrame(source, options?)`

只创建分页 iframe，不生成 PDF，适合调试分页效果。

```ts
await exporter.createPagedFrame('#report', {
  debug: true,
  removeContainer: false
});
```

## 配置项

| 参数 | 类型 | 默认值 | 说明 |
|---|---|---:|---|
| `filename` | `string` | `document.pdf` | 下载文件名 |
| `page.format` | `a4` / `letter` / `legal` / `string` | `a4` | 内置纸张尺寸；自定义尺寸可传 `widthMm` / `heightMm` |
| `page.widthMm` | `number` | `210` | 页面宽度，单位 mm |
| `page.heightMm` | `number` | `297` | 页面高度，单位 mm |
| `page.orientation` | `portrait` / `landscape` | `portrait` | 页面方向 |
| `margin` | `string` | `18mm 14mm 18mm 14mm` | 默认 `@page` 边距 |
| `scale` | `number` / `null` | 自适应 | 渲染倍率，越大越清晰，也越耗内存 |
| `imageType` | `jpeg` / `png` | `jpeg` | PDF 内页图像格式 |
| `imageQuality` | `number` | `0.96` | JPEG 质量 |
| `backgroundColor` | `string` | `#ffffff` | 渲染背景色 |
| `useCORS` | `boolean` | `true` | 尝试以 CORS 方式加载图片 |
| `allowTaint` | `boolean` | `false` | 是否允许污染 Canvas，通常不建议开启 |
| `foreignObjectRendering` | `boolean` | `false` | html2canvas 的 foreignObject 渲染模式 |
| `removeContainer` | `boolean` | `true` | 导出后是否移除隐藏 iframe |
| `debug` | `boolean` | `false` | 是否保留 iframe 方便调试 |
| `pagedScriptUrl` | `string` | 固定版本 CDN | Paged.js polyfill 地址，生产建议自托管 |
| `extraCss` | `string` | `''` | 注入到渲染 iframe 的额外 CSS |
| `timeoutMs` | `number` | `15000` | 分页脚本和预览超时时间 |
| `onProgress` | `function` | 空函数 | 导出进度回调 |

## 进度回调

```ts
const exporter = new HtmlToPdfPro({
  onProgress(event) {
    if (event.phase === 'render-page') {
      console.log(`正在生成第 ${event.page}/${event.totalPages} 页`);
    }
  }
});
```

进度阶段：

```text
clone
assets
pagedjs
paginated
render-start
render-page
render-complete
save
```

## 推荐分页 CSS

```css
@page {
  size: A4;
  margin: 18mm 14mm 19mm 14mm;

  @top-left {
    content: "业务报告";
    color: #667085;
    font-size: 8.5pt;
  }

  @bottom-center {
    content: "第 " counter(page) " / " counter(pages) " 页";
    color: #667085;
    font-size: 8.5pt;
  }
}

.pdf-page-break {
  break-before: page;
  page-break-before: always;
}

.avoid-break,
.card,
figure,
blockquote,
tr {
  break-inside: avoid;
  page-break-inside: avoid;
}

thead {
  display: table-header-group;
}
```

## 常用命令

```bash
pnpm dev         # 启动 Vite 开发服务
pnpm typecheck   # 执行 TypeScript 检查
pnpm build       # 类型检查并构建生产产物
pnpm preview     # 本地预览生产构建
```

## 生产构建

生产构建配置位于 `vite.config.ts`：

- 构建前执行 `tsc --noEmit`。
- Vite 负责压缩静态资源。
- 关闭 sourcemap，避免发布源码映射。
- 使用 `javascript-obfuscator` 对 JavaScript chunk 做混淆。
- `dist/` 不提交到 git，由 Vercel 或本地构建生成。

Vercel 发布示例：

```bash
vercel pull --yes --environment=production
vercel build --prod --yes
vercel deploy --prebuilt --prod
```

## 目录结构

```text
html-to-pdf-pro-typescript/
├── docs/
│   └── INTEGRATION.md
├── public/
│   └── vendor/
│       ├── paged.polyfill.js
│       └── PAGEDJS_LICENSE.md
├── src/
│   ├── components/
│   │   ├── HtmlToPdfPro.ts
│   │   └── index.ts
│   ├── demo.css
│   └── demo.ts
├── index.html
├── package.json
├── pnpm-lock.yaml
├── THIRD_PARTY_NOTICES.md
├── tsconfig.json
└── vite.config.ts
```

## 浏览器与资源注意事项

- 图片建议同源，或正确配置 CORS 响应头。
- 字体建议自托管，避免导出前后字体切换。
- 超长报告建议拆成多个逻辑区块，降低浏览器内存压力。
- 直接下载模式优先保证视觉一致性，本质是把页面渲染结果封装到 PDF 中。
- 如果更重视可复制、可搜索文本，可使用 `nativePrint()` 交给浏览器打印保存。

## 文档

完整对接说明见 [docs/INTEGRATION.md](./docs/INTEGRATION.md)。

第三方依赖说明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

## License

当前仓库尚未添加项目 License。若计划作为开源包接受外部贡献或二次分发，请先补充明确的许可证文件。
