import './demo.css';
import { HtmlToPdfPro, type HtmlToPdfProgressEvent } from './components';

const rows = [
  ['业务目标梳理', '咨询', '16h', '￥4,800', '已完成'],
  ['视觉方案设计', '设计', '24h', '￥7,200', '已完成'],
  ['页面内容制作', '交付', '42h', '￥16,800', '进行中'],
  ['报告模板整理', '交付', '18h', '￥7,200', '进行中'],
  ['客户验收检查', '质检', '12h', '￥3,600', '计划中'],
  ['上线准备优化', '运营', '20h', '￥8,000', '计划中'],
  ['交接与复盘会议', '服务', '10h', '￥3,000', '计划中']
] as const;

const tbody = document.querySelector<HTMLTableSectionElement>('#line-items');
const status = document.querySelector<HTMLDivElement>('#status');
const progress = document.querySelector<HTMLDivElement>('#progress');
const exportButton = document.querySelector<HTMLButtonElement>('#export-pdf');
const printButton = document.querySelector<HTMLButtonElement>('#native-print');

if (!tbody || !status || !progress || !exportButton || !printButton) {
  throw new Error('Demo DOM is incomplete. Please check index.html.');
}

const tbodyEl = tbody;
const statusEl = status;
const progressEl = progress;
const exportButtonEl = exportButton;
const printButtonEl = printButton;

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

function setStatus(text: string, ratio = 0): void {
  statusEl.textContent = text;
  progressEl.style.width = `${Math.round(ratio * 100)}%`;
}

function lockButtons(locked: boolean): void {
  exportButtonEl.disabled = locked;
  printButtonEl.disabled = locked;
}

function handleProgress(event: HtmlToPdfProgressEvent): void {
  if (event.phase === 'clone') setStatus('正在准备报告内容…', 0.06);
  if (event.phase === 'assets') setStatus('正在加载报告资源…', 0.16);
  if (event.phase === 'pagedjs') setStatus('正在整理页面版式…', 0.28);
  if (event.phase === 'paginated') setStatus(`版式整理完成，共 ${event.totalPages ?? 0} 页。`, 0.38);
  if (event.phase === 'render-page') {
    setStatus(`正在生成第 ${event.page} / ${event.totalPages} 页…`, 0.38 + (event.ratio ?? 0) * 0.55);
  }
  if (event.phase === 'render-complete') setStatus('PDF 文档已生成，正在保存…', 0.96);
  if (event.phase === 'save') setStatus(`已完成：${event.filename}`, 1);
}

const pdfExporter = new HtmlToPdfPro({
  filename: 'HtmlToPdfPro-project-report.pdf',
  page: { format: 'a4' },
  margin: '18mm 14mm 19mm 14mm',
  scale: 2.5,
  imageType: 'jpeg',
  imageQuality: 0.96,
  useCORS: true,
  pagedScriptUrl: new URL('./vendor/paged.polyfill.js', window.location.href).toString(),
  debug: false,
  onProgress: handleProgress
});

exportButtonEl.addEventListener('click', async () => {
  lockButtons(true);
  setStatus('开始生成项目报告 PDF…', 0.02);

  try {
    await pdfExporter.download('#report');
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : String(error);
    setStatus(`生成失败：${message}`, 0);
  } finally {
    lockButtons(false);
  }
});

printButtonEl.addEventListener('click', async () => {
  lockButtons(true);
  setStatus('正在打开打印窗口…', 0.12);

  try {
    await pdfExporter.nativePrint('#report', { debug: true, removeContainer: false });
    setStatus('已打开打印窗口，可选择保存为 PDF。', 1);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : String(error);
    setStatus(`打印失败：${message}`, 0);
  } finally {
    lockButtons(false);
  }
});
