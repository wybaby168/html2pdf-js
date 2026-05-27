import './demo.css';
import { HtmlToPdfPro } from '@flyfish-dev/html2pdf-js';
const rows = [
    ['业务目标梳理', '咨询', '16h', '￥4,800', '已完成'],
    ['视觉方案设计', '设计', '24h', '￥7,200', '已完成'],
    ['页面内容制作', '交付', '42h', '￥16,800', '进行中'],
    ['报告模板整理', '交付', '18h', '￥7,200', '进行中'],
    ['客户验收检查', '质检', '12h', '￥3,600', '计划中'],
    ['上线准备优化', '运营', '20h', '￥8,000', '计划中'],
    ['交接与复盘会议', '服务', '10h', '￥3,000', '计划中']
];
const tbody = document.querySelector('#line-items');
const status = document.querySelector('#status');
const progress = document.querySelector('#progress');
const exportButton = document.querySelector('#export-pdf');
const inspectButton = document.querySelector('#inspect-html');
if (!tbody || !status || !progress || !exportButton || !inspectButton) {
    throw new Error('Demo DOM is incomplete. Please check index.html.');
}
const tbodyEl = tbody;
const statusEl = status;
const progressEl = progress;
const exportButtonEl = exportButton;
const inspectButtonEl = inspectButton;
for (let i = 0; i < 35; i += 1) {
    const item = rows[i % rows.length];
    const tr = document.createElement('tr');
    tr.innerHTML = [
        `<td>${String(i + 1).padStart(2, '0')}</td>`,
        `<td><strong>${item[0]}</strong><span>阶段 ${Math.floor(i / 7) + 1} / 交付批次</span></td>`,
        `<td>${item[1]}</td>`,
        `<td>${item[2]}</td>`,
        `<td>${item[3]}</td>`,
        `<td><em class="badge">${item[4]}</em></td>`
    ].join('');
    tbodyEl.appendChild(tr);
}
function setStatus(text, ratio = 0) {
    statusEl.textContent = text;
    progressEl.style.width = `${Math.round(ratio * 100)}%`;
}
function lockButtons(locked) {
    exportButtonEl.disabled = locked;
    inspectButtonEl.disabled = locked;
}
function handleProgress(event) {
    if (event.phase === 'clone')
        setStatus('正在克隆页面 DOM，并保留表单与 Canvas 状态…', 0.06);
    if (event.phase === 'styles')
        setStatus('正在收集当前页面 CSS 与字体声明…', 0.14);
    if (event.phase === 'assets')
        setStatus('正在内联图片、SVG 与 Canvas 资源…', 0.24);
    if (event.phase === 'layout')
        setStatus('正在基于浏览器真实布局计算排版尺寸…', 0.34);
    if (event.phase === 'paginate')
        setStatus('正在执行自研分页算法，避开关键内容断裂…', 0.43);
    if (event.phase === 'render-page') {
        setStatus(`正在生成第 ${event.page} / ${event.totalPages} 页：视觉层 + 文字层…`, 0.43 + (event.ratio ?? 0) * 0.48);
    }
    if (event.phase === 'pdf')
        setStatus('正在组装 PDF 对象、链接标注与可复制文字层…', 0.95);
    if (event.phase === 'save')
        setStatus(`已完成：${event.filename}`, 1);
}
const pdfExporter = new HtmlToPdfPro({
    filename: 'HtmlToPdfPro-dom-canvas-text-report.pdf',
    page: { format: 'a4' },
    margin: '18mm 14mm 19mm 14mm',
    dpi: 192,
    imageType: 'jpeg',
    imageQuality: 0.96,
    backgroundColor: '#ffffff',
    fitToPage: true,
    bleedPx: 28,
    pageBreakMode: 'avoid',
    collectStyles: true,
    includeExternalStylesheets: true,
    inlineImages: true,
    inlineCanvas: true,
    materializePseudoElements: true,
    textLayer: true,
    linkAnnotations: true,
    bookmarks: true,
    header: {
        text: 'HtmlToPdfPro / Self-hosted DOM Canvas Text Engine',
        position: 'left'
    },
    footer: {
        text: 'Page {page} of {pages}',
        position: 'center'
    },
    extraCss: [
        '.toolbar, .screen-hint { display: none !important; }',
        '.report { margin: 0 !important; box-shadow: none !important; }',
        'a { color: #1d4ed8; text-decoration: underline; }'
    ].join('\n'),
    onProgress: handleProgress
});
exportButtonEl.addEventListener('click', async () => {
    lockButtons(true);
    setStatus('开始生成高保真、可复制文字 PDF…', 0.02);
    try {
        await pdfExporter.download('#report');
    }
    catch (error) {
        console.error(error);
        const message = error instanceof Error ? error.message : String(error);
        setStatus(`生成失败：${message}`, 0);
    }
    finally {
        lockButtons(false);
    }
});
inspectButtonEl.addEventListener('click', async () => {
    lockButtons(true);
    setStatus('正在导出独立 HTML 快照…', 0.18);
    try {
        const html = await pdfExporter.serialize('#report');
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'html-to-pdf-pro-snapshot.html';
        a.click();
        URL.revokeObjectURL(url);
        setStatus('已导出独立 HTML 快照，可用于排版问题复现。', 1);
    }
    catch (error) {
        console.error(error);
        const message = error instanceof Error ? error.message : String(error);
        setStatus(`快照导出失败：${message}`, 0);
    }
    finally {
        lockButtons(false);
    }
});
