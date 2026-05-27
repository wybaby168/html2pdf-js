# HtmlToPdfPro 对接文档

## 1. 能力说明

HtmlToPdfPro 是纯前端 TypeScript 组件，用于把业务 HTML 页面导出为高保真 PDF。它适合以下场景：

- 合同、协议、报价单、账单、发票预览页；
- 运营报表、项目报告、审批流附件；
- 需要保留复杂样式、渐变、圆角、阴影、Grid/Flex 布局、长表格分页的页面；
- 不希望引入服务端 PDF 渲染服务的轻量化业务。

组件不重新实现 HTML/CSS 排版，而是复用浏览器渲染结果，再结合 Paged.js 的分页能力做高保真导出。

## 2. 安装依赖

```bash
npm install html2canvas@1.4.1 jspdf@4.2.1 pagedjs@0.4.3
```

如果直接使用本 demo：

```bash
npm install
npm run dev
```
本 demo 已把 `pagedjs@0.4.3` 的 `paged.polyfill.min.js` 复制到 `public/vendor/paged.polyfill.js`，demo 初始化时通过 `pagedScriptUrl` 指向该本地文件。迁移到业务项目时，建议保持这种自托管方式。


## 3. 引入组件

把 `src/components/HtmlToPdfPro.ts` 和 `src/components/index.ts` 拷贝到业务项目中，或将当前项目作为内部包发布后引用。

```ts
import { HtmlToPdfPro } from './components';
```

也可以只引入核心文件：

```ts
import { HtmlToPdfPro } from './components/HtmlToPdfPro';
```

## 4. 最小接入示例

HTML：

```html
<button id="download">导出 PDF</button>

<article id="report">
  <h1>项目报告</h1>
  <p>这里是需要导出的业务内容。</p>
</article>
```

TypeScript：

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

document.querySelector('#download')?.addEventListener('click', async () => {
  await exporter.download('#report');
});
```

## 5. 推荐分页 CSS

把分页规则写在业务 CSS 中，组件会自动收集当前页面的 `style` 和 `link[rel="stylesheet"]` 并注入到渲染 iframe。

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

.pdf-avoid-break,
.avoid-break,
.card,
figure,
pre,
blockquote {
  break-inside: avoid;
  page-break-inside: avoid;
}

thead { display: table-header-group; }
tfoot { display: table-footer-group; }
tr {
  break-inside: avoid;
  page-break-inside: avoid;
}
```

## 6. API

### `new HtmlToPdfPro(options?)`

创建导出实例。建议在页面或模块初始化时创建一次。

```ts
const exporter = new HtmlToPdfPro({
  filename: 'report.pdf',
  page: { format: 'a4' },
  scale: 2.5
});
```

### `download(source, options?)`

生成并下载 PDF。`source` 可以是 CSS 选择器或 `HTMLElement`。

```ts
await exporter.download('#report');
await exporter.download(document.querySelector('#report') as HTMLElement, {
  filename: 'custom-name.pdf'
});
```

### `toPdf(source, options?)`

返回 `jsPDF` 实例，适合继续自定义处理。

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
await fetch('/api/upload', { method: 'POST', body: formData });
```

### `nativePrint(source, options?)`

创建分页 DOM 后打开浏览器打印弹窗。该路径由浏览器打印引擎输出，通常更适合需要可复制文字/可搜索文本的 PDF。

```ts
await exporter.nativePrint('#report');
```

### `createPagedFrame(source, options?)`

只创建分页 iframe，不生成 PDF，适合调试分页结果。

```ts
await exporter.createPagedFrame('#report', {
  debug: true,
  removeContainer: false
});
```

## 7. Options 配置

| 参数 | 类型 | 默认值 | 说明 |
|---|---|---:|---|
| `filename` | `string` | `document.pdf` | 下载文件名 |
| `page.format` | `a4` / `letter` / `legal` / `string` | `a4` | 内置纸张尺寸；自定义尺寸可传 `widthMm` / `heightMm` |
| `page.widthMm` | `number` | `210` | 页面宽度，单位 mm |
| `page.heightMm` | `number` | `297` | 页面高度，单位 mm |
| `page.orientation` | `portrait` / `landscape` | `portrait` | 页面方向 |
| `margin` | `string` | `18mm 14mm 18mm 14mm` | 默认 `@page` 边距，业务 CSS 可覆盖 |
| `scale` | `number` / `null` | `2~3` | html2canvas 渲染倍率，越大越清晰，也越耗内存 |
| `imageType` | `jpeg` / `png` | `jpeg` | PDF 内页图像格式 |
| `imageQuality` | `number` | `0.96` | JPEG 质量，`png` 时基本无效 |
| `backgroundColor` | `string` | `#ffffff` | 页面背景色 |
| `useCORS` | `boolean` | `true` | 尝试以 CORS 方式加载图片 |
| `allowTaint` | `boolean` | `false` | 是否允许污染 Canvas，不建议开启 |
| `foreignObjectRendering` | `boolean` | `false` | html2canvas 的 SVG foreignObject 渲染模式 |
| `removeContainer` | `boolean` | `true` | 导出后是否移除隐藏 iframe |
| `debug` | `boolean` | `false` | 是否保留隐藏 iframe 方便调试 |
| `pagedScriptUrl` | `string` | Paged.js CDN 固定版本 | Paged.js polyfill 地址，生产建议自托管 |
| `extraCss` | `string` | `''` | 注入渲染 iframe 的额外 CSS |
| `timeoutMs` | `number` | `15000` | 分页脚本和预览超时时间 |
| `onProgress` | `function` | 空函数 | 导出进度回调 |

## 8. 进度回调

```ts
const exporter = new HtmlToPdfPro({
  onProgress(event) {
    switch (event.phase) {
      case 'clone':
        console.log('复制 DOM 和样式');
        break;
      case 'assets':
        console.log('等待资源加载');
        break;
      case 'pagedjs':
        console.log('正在分页');
        break;
      case 'paginated':
        console.log('分页完成', event.totalPages);
        break;
      case 'render-page':
        console.log(`渲染第 ${event.page}/${event.totalPages} 页`, event.ratio);
        break;
      case 'save':
        console.log('保存完成', event.filename);
        break;
    }
  }
});
```

进度阶段：

```text
clone -> assets -> pagedjs -> paginated -> render-start -> render-page* -> render-complete -> save
```

## 9. Vue / React 对接示例

### Vue 3

```ts
import { ref } from 'vue';
import { HtmlToPdfPro } from './components';

const reportRef = ref<HTMLElement | null>(null);
const exporter = new HtmlToPdfPro({ filename: 'report.pdf' });

async function exportPdf() {
  if (!reportRef.value) return;
  await exporter.download(reportRef.value);
}
```

```vue
<template>
  <button @click="exportPdf">导出 PDF</button>
  <article ref="reportRef">...</article>
</template>
```

### React

```tsx
import { useMemo, useRef } from 'react';
import { HtmlToPdfPro } from './components';

export function ReportPage() {
  const reportRef = useRef<HTMLElement | null>(null);
  const exporter = useMemo(() => new HtmlToPdfPro({ filename: 'report.pdf' }), []);

  return (
    <>
      <button onClick={() => reportRef.current && exporter.download(reportRef.current)}>
        导出 PDF
      </button>
      <article ref={reportRef}>...</article>
    </>
  );
}
```

## 10. 资源规范

### 图片

- 最稳妥：业务图片与页面同源。
- 使用 CDN 图片时，需要响应头允许 CORS。
- 图片标签建议保留自然宽高或 CSS 尺寸，避免导出前后布局抖动。

### 字体

- 建议本地化或同源加载字体。
- 组件会等待 `document.fonts.ready`，但跨域字体依然需要正确 CORS。

### Canvas / 图表

组件会尝试把源页面中的 `canvas` 转成图片后再注入分页 iframe，常见图表和签名板可以保留。若 Canvas 本身已被跨域资源污染，则无法序列化。

## 11. 质量与性能建议

- `scale: 2`：文件更小、速度更快，适合普通报表。
- `scale: 2.5`：推荐平衡值，demo 默认使用。
- `scale: 3`：更清晰，但内存和耗时明显增加。
- 超长页面建议拆分为多个报告或分段导出。
- 大量高清图片建议先压缩到业务可接受尺寸。

## 12. 常见问题

### 为什么自动下载的 PDF 文字不能选择？

自动下载路径使用 html2canvas 逐页渲染为图片，再由 jsPDF 封装成 PDF。它优先保证视觉高保真，但不是文本语义 PDF。需要可复制/搜索文本时，使用 `nativePrint()`。

### 为什么图片没有显示或导出失败？

通常是跨域图片没有 CORS，导致 Canvas 被污染。请改为同源图片、配置 CDN CORS，或将图片转为可访问的 data URL。

### 为什么分页位置不理想？

请给卡片、表格行、图表、签章区域添加：

```css
.avoid-break {
  break-inside: avoid;
  page-break-inside: avoid;
}
```

必要时用：

```css
.pdf-page-break {
  break-before: page;
  page-break-before: always;
}
```

### 生产环境是否建议继续使用 CDN Paged.js？

建议生产环境把 Paged.js polyfill 固定版本并自托管，然后通过 `pagedScriptUrl` 指向你的静态资源地址，避免 CDN 波动影响导出链路。

```ts
const exporter = new HtmlToPdfPro({
  pagedScriptUrl: '/vendor/paged.polyfill.js'
});
```

## 13. 适用边界

HtmlToPdfPro 定位于纯前端高保真视觉导出。如果业务要求 PDF/A、电子签章、表单字段、目录书签、可访问性标签、长期归档合规等 PDF 语义能力，建议使用服务端 Chromium/Puppeteer 或专业 PDF 引擎作为补充。
