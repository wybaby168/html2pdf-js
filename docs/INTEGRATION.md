# HtmlToPdfPro 对接文档

## 1. 定位

HtmlToPdfPro 是一个纯前端 TypeScript HTML 转 PDF 组件。当前版本的目标是：

- 尽量原样输出已有业务 HTML 页面；
- 不引用 IronPress；
- 不使用 `html2canvas`；
- 不依赖 `jsPDF`；
- 不打开浏览器打印框；
- 自动下载 PDF；
- PDF 内文字可复制、可搜索；
- 尽量保留链接、目录、复杂样式和优雅分页。

## 2. 架构

```text
HTMLElement / HTML string / Markdown
  -> DOM 克隆与状态同步
  -> 安全清理 script / iframe / event handler
  -> 收集 style、CSSOM、外部 CSS、font-face、extraCss
  -> 内联图片、SVG image、Canvas
  -> 可选物化 ::before / ::after 文本
  -> 浏览器真实布局测量
  -> 自研分页算法
  -> SVG foreignObject + Canvas 生成视觉层
  -> Range.getClientRects 计算文字坐标
  -> 自研 PDF Writer 写入 image XObject、透明文字层、链接、书签
  -> Blob 自动下载
```

组件没有重新造一个完整浏览器。复杂 CSS 布局仍交给浏览器，这样才能最大化还原现有页面；组件自研的是导出管线、分页、文字坐标、PDF 结构和下载流程。

## 3. 安装

```bash
pnpm add @flyfish-dev/html2pdf-js
```

或：

```bash
npm install @flyfish-dev/html2pdf-js
```

当前包没有运行时渲染依赖，不会安装 IronPress、html2canvas、jsPDF、Paged.js。

## 4. 最小接入

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

document.querySelector('#download')?.addEventListener('click', async () => {
  await exporter.download('#report');
});
```

## 5. 输入源

### CSS 选择器

```ts
await exporter.download('#report');
```

### HTMLElement

```ts
const el = document.querySelector('#report') as HTMLElement;
await exporter.download(el);
```

### HTML 字符串

```ts
await exporter.downloadHtml('<article><h1>Hello</h1><p>PDF text is copyable.</p></article>');
```

### Markdown 字符串

```ts
await exporter.downloadMarkdown(`
# 周报

- 目标达成 92%
- 风险等级低
`);
```

## 6. API

### `new HtmlToPdfPro(options?)`

创建导出实例。建议在页面初始化时创建一次。

### `download(source, options?)`

生成并自动下载 PDF。

```ts
await exporter.download('#report', {
  filename: 'customer-report.pdf'
});
```

### `toPdf(source, options?)`

返回 PDF bytes。

```ts
const bytes = await exporter.toPdf('#report');
```

### `outputBlob(source, options?)`

返回 PDF Blob。

```ts
const blob = await exporter.outputBlob('#report');
const form = new FormData();
form.append('file', blob, 'report.pdf');
await fetch('/api/upload', { method: 'POST', body: form });
```

### `serialize(source, options?)`

返回引擎内部的独立 HTML 快照，适合排查样式、资源、伪元素和状态同步问题。

```ts
const html = await exporter.serialize('#report');
```

### `nativePrint(source, options?)`

保留兼容方法，只作为 fallback。主链路不使用打印框。

## 7. Options

| 参数 | 类型 | 默认值 | 说明 |
|---|---|---:|---|
| `filename` | `string` | `document.pdf` | 下载文件名 |
| `page.format` | `a4` / `letter` / `legal` / `string` | `a4` | 内置纸张尺寸 |
| `page.widthMm` | `number` | `210` | 自定义页面宽度 |
| `page.heightMm` | `number` | `297` | 自定义页面高度 |
| `page.orientation` | `portrait` / `landscape` | `portrait` | 页面方向 |
| `margin` | `string` | `18mm 14mm 18mm 14mm` | 页面边距，支持 `px` / `pt` / `mm` / `cm` / `in` |
| `dpi` | `number` | `180` | 视觉层分辨率 |
| `imageQuality` | `number` | `0.94` | JPEG 质量 |
| `backgroundColor` | `string \| null` | `#ffffff` | 页面背景 |
| `fitToPage` | `boolean` | `true` | 保留原布局并等比缩放到内容区域 |
| `bleedPx` | `number` | `24` | 页面切片安全边距 |
| `pageBreakMode` | `slice` / `avoid` | `avoid` | 分页策略 |
| `avoidBreakSelectors` | `string` | 内置 | 避免断页选择器 |
| `forceBreakBeforeSelectors` | `string` | `.pdf-page-break,[data-pdf-page-break="before"]` | 强制分页选择器 |
| `collectStyles` | `boolean` | `true` | 收集当前页面 CSS |
| `includeExternalStylesheets` | `boolean` | `true` | 尝试读取外链 CSS |
| `inlineImages` | `boolean` | `true` | 尝试把图片内联为 data URL |
| `inlineCanvas` | `boolean` | `true` | 把 Canvas 转为图片 |
| `inlineCssResources` | `boolean` | `false` | 尝试内联 style 中的 `url(...)` |
| `materializePseudoElements` | `boolean` | `true` | 物化伪元素文本 |
| `sanitize` | `boolean` | `true` | 移除脚本和事件属性 |
| `textLayer` | `boolean` | `true` | 生成透明文字层 |
| `linkAnnotations` | `boolean` | `true` | 生成链接标注 |
| `bookmarks` | `boolean` | `true` | 由标题生成 PDF 书签 |
| `header` | `string \| object` | - | 页眉文本，支持 `{page}` / `{pages}` |
| `footer` | `string \| object` | - | 页脚文本，支持 `{page}` / `{pages}` |
| `extraCss` | `string` | `''` | 导出时额外 CSS |
| `fontFaces` | `HtmlToPdfFontFace[]` | `[]` | 注入 `@font-face` |
| `resourceErrorMode` | `ignore` / `warn` / `throw` | `warn` | 资源内联失败策略 |
| `onProgress` | `function` | 空函数 | 进度回调 |

## 8. 分页控制

强制新页：

```html
<section class="pdf-page-break">费用明细</section>
```

避免模块被切开：

```html
<div class="avoid-break">签章区</div>
<div class="pdf-avoid-break">费用卡片</div>
```

自定义选择器：

```ts
const exporter = new HtmlToPdfPro({
  forceBreakBeforeSelectors: '.chapter,[data-break-before]',
  avoidBreakSelectors: '.card,.invoice-row,.signature-block,table,tr'
});
```

## 9. 页眉页脚

```ts
const exporter = new HtmlToPdfPro({
  header: {
    text: 'Customer Report',
    position: 'left',
    fontSizePx: 10,
    color: '#667085'
  },
  footer: {
    text: 'Page {page} of {pages}',
    position: 'center'
  }
});
```

页眉页脚会同时进入视觉层和透明文字层。

## 10. 对 IronPress README 能力的前端映射

本项目没有引用 IronPress，但参考了“内置布局、HTML/CSS/Markdown 到 PDF、字体、图片、链接、目录、安全清洗”的产品思路，映射如下：

| 能力方向 | HtmlToPdfPro 当前实现 |
|---|---|
| HTML 常用元素 | 使用浏览器 DOM 渲染，支持浏览器可渲染的语义元素、表格、列表、表单、图片、SVG、Canvas |
| CSS 选择器与布局 | 复用浏览器真实 CSS 结果，覆盖 Flex、Grid、定位、变换、渐变、阴影、圆角、自定义属性等浏览器能力 |
| Markdown | 内置轻量 Markdown 到 HTML 转换，再走 HTML 导出管线 |
| 字体 | 视觉层保留浏览器字体效果；文字层通过 ToUnicode 保证复制/搜索；可通过 `fontFaces` 注入字体声明 |
| 图片 | 支持 img、SVG image、Canvas 内联；视觉层写入 PDF image XObject |
| 链接 | 根据 `<a href>` 的 DOM 矩形生成 PDF Link Annotation |
| 书签目录 | 根据 `h1`~`h6` 或 `data-pdf-bookmark` 生成 PDF Outlines |
| 安全清洗 | 默认移除 `script`、`iframe`、`object`、`embed`、事件属性和 `javascript:` URL |
| 浏览器/WASM/服务端 | 当前交付为纯浏览器 TypeScript 组件，无 WASM 运行时依赖 |
| 流式输出 | 浏览器端返回 `Uint8Array` / `Blob`，可自行上传或持久化 |

## 11. 进度回调

```ts
const exporter = new HtmlToPdfPro({
  onProgress(event) {
    switch (event.phase) {
      case 'clone':
        console.log('克隆 DOM');
        break;
      case 'assets':
        console.log('内联资源');
        break;
      case 'paginate':
        console.log('分页');
        break;
      case 'render-page':
        console.log(`生成第 ${event.page}/${event.totalPages} 页`);
        break;
      case 'pdf':
        console.log('组装 PDF');
        break;
    }
  }
});
```

## 12. Vue 接入示例

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { HtmlToPdfPro } from '@flyfish-dev/html2pdf-js';

const reportRef = ref<HTMLElement | null>(null);

const exporter = new HtmlToPdfPro({
  filename: 'vue-report.pdf',
  footer: 'Page {page} of {pages}'
});

async function exportPdf() {
  if (!reportRef.value) return;
  await exporter.download(reportRef.value);
}
</script>

<template>
  <button @click="exportPdf">导出 PDF</button>
  <article ref="reportRef">
    <h1>Vue Report</h1>
  </article>
</template>
```

## 13. React 接入示例

```tsx
import { useRef } from 'react';
import { HtmlToPdfPro } from '@flyfish-dev/html2pdf-js';

const exporter = new HtmlToPdfPro({
  filename: 'react-report.pdf',
  footer: 'Page {page} of {pages}'
});

export function Report() {
  const ref = useRef<HTMLElement>(null);

  return (
    <>
      <button onClick={() => ref.current && exporter.download(ref.current)}>
        导出 PDF
      </button>
      <article ref={ref}>
        <h1>React Report</h1>
      </article>
    </>
  );
}
```

## 14. 生产注意事项

1. **跨域资源**：图片、CSS、字体最好使用同域或开启 CORS，否则资源无法内联时可能影响视觉层。
2. **中文字体**：视觉层会按浏览器显示结果输出；文字层使用 Unicode 映射保证复制/搜索，不依赖系统中文字体嵌入。
3. **超大文档**：`dpi` 越高越清晰，也越占内存。长合同、长报表建议先用 180~192 DPI。
4. **图表库**：ECharts、Chart.js、SVG 图表、Canvas 图表建议在动画完成后再调用导出。
5. **伪元素**：普通文本型 `::before` / `::after` 会物化；复杂背景图/计数器建议直接写入 DOM 或用额外 CSS 控制。
6. **文本复制顺序**：透明文字层按 DOM 文本和坐标提取。极复杂多栏布局建议单独做回归样例。
7. **PDF 可编辑性**：该方案目标是高保真归档与复制搜索，不是把每个 CSS box 转成可编辑 PDF 矢量对象。
