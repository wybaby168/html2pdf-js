# HtmlToPdfPro

HtmlToPdfPro 是一个可发布 npm 的 TypeScript 前端组件包，用于把业务 HTML 页面导出为版式稳定、视觉还原度高的 PDF。仓库采用“组件包 + demo 应用”解耦结构：核心能力位于 `packages/html2pdf-js`，demo 只通过 npm 包名导入组件，便于用户按同样方式迁移到任意业务项目。

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
html-to-pdf-pro-typescript/
├── packages/
│   └── html2pdf-js/
│       ├── src/
│       │   ├── HtmlToPdfPro.ts
│       │   └── index.ts
│       ├── vendor/
│       │   ├── paged.polyfill.js
│       │   └── PAGEDJS_LICENSE.md
│       ├── package.json
│       ├── README.md
│       └── tsconfig.json
├── src/
│   ├── demo.css
│   └── demo.ts
├── docs/
│   └── INTEGRATION.md
├── public/
│   └── vendor/
│       ├── paged.polyfill.js
│       └── PAGEDJS_LICENSE.md
├── index.html
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── THIRD_PARTY_NOTICES.md
├── tsconfig.json
└── vite.config.ts
```

## 核心能力

- 基于浏览器实际渲染结果生成高保真 PDF。
- 支持 `@page`、页眉页脚、页码、强制分页、避免断页、长表格表头重复。
- TypeScript 组件化 API，支持进度回调。
- 导出目标可以是 CSS 选择器，也可以是现有 `HTMLElement`。
- 支持直接下载、返回 `Blob`、返回 `jsPDF` 实例，以及打开浏览器打印。
- 包内携带固定版本 Paged.js polyfill，demo 也自托管该文件。
- demo 通过 `@flyfish-dev/html2pdf-js` 依赖包导入组件，不耦合组件源码路径。

## 本地运行 Demo

```bash
pnpm install
pnpm dev
```

打开 Vite 输出的本地地址，点击“下载 PDF”即可体验导出。

## 在业务项目中使用

```bash
pnpm add @flyfish-dev/html2pdf-js
```

或：

```bash
npm install @flyfish-dev/html2pdf-js
```

最小示例：

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
pnpm dev              # 启动 demo
pnpm typecheck        # 构建组件包并执行 demo 类型检查
pnpm build            # 构建组件包和 demo 生产产物
pnpm preview          # 本地预览 demo 生产构建
pnpm pack:package     # 生成 npm tarball，校验包内容
pnpm publish:package  # 发布 @flyfish-dev/html2pdf-js
```

## 生产构建

生产构建配置位于 `vite.config.ts`：

- 先构建 `packages/html2pdf-js`。
- demo 再通过依赖包名 `@flyfish-dev/html2pdf-js` 引入组件。
- Vite 负责压缩 demo 静态资源。
- 关闭 sourcemap，避免发布源码映射。
- 使用 `javascript-obfuscator` 对 demo JavaScript chunk 做混淆。
- `dist/` 和包内 `dist/` 不提交到 git，由构建流程生成。

## npm 发布流程

```bash
npm login
pnpm --filter @flyfish-dev/html2pdf-js build
cd packages/html2pdf-js
npm publish --access public --registry=https://registry.npmjs.org/
```

发布会显式使用官方 npm registry：`https://registry.npmjs.org/`。发布前请确认已通过 `npm login --registry=https://registry.npmjs.org/` 登录。

## 浏览器与资源注意事项

- 图片建议同源，或正确配置 CORS 响应头。
- 字体建议自托管，避免导出前后字体切换。
- 超长报告建议拆成多个逻辑区块，降低浏览器内存压力。
- 直接下载模式优先保证视觉一致性，本质是把页面渲染结果封装到 PDF 中。
- 如果更重视可复制、可搜索文本，可使用 `nativePrint()` 交给浏览器打印保存。

## 文档

完整对接说明见 [docs/INTEGRATION.md](./docs/INTEGRATION.md)。

组件包 README 见 [packages/html2pdf-js/README.md](./packages/html2pdf-js/README.md)。

第三方依赖说明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

## License

AGPL-3.0-only。该协议是强 copyleft 开源协议，包含网络服务场景下的源码开放要求。详见 [LICENSE](./LICENSE)。
