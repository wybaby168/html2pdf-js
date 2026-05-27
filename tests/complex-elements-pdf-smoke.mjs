import { spawn, spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const outputDir = path.resolve('tests/output');
const pdfPath = path.join(outputDir, 'complex-elements.pdf');
const txtPath = path.join(outputDir, 'complex-elements.txt');
const port = Number(process.env.HTML2PDF_PRO_COMPLEX_CDP_PORT || 9908);

function findExecutable(candidates) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (candidate.includes(path.sep) && existsSync(candidate)) return candidate;
    const found = spawnSync(process.platform === 'win32' ? 'where' : 'which', [candidate], { encoding: 'utf8' });
    if (found.status === 0) return found.stdout.split(/\r?\n/).find(Boolean)?.trim();
  }
  return undefined;
}

const chromeBin = findExecutable([
  process.env.CHROME_BIN,
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  'chromium',
  'chromium-browser',
  'google-chrome',
  'google-chrome-stable'
]);

if (!chromeBin) throw new Error('Chrome/Chromium executable not found. Set CHROME_BIN to run this test.');

function runRequired(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

function assertSelectablePdfStructure(pdfBytes, label) {
  const text = pdfBytes.toString('latin1');
  if (text.includes('/Subtype /Type3')) throw new Error(`${label}: Type3 fonts are not allowed.`);
  if (/\b3\s+Tr\b/.test(text)) throw new Error(`${label}: invisible 3 Tr text mode is not allowed.`);
  for (const marker of ['/Subtype /Type0', '/Subtype /CIDFontType2', '/FontFile2', '/ToUnicode', '/ActualText', '/ExtGState', '/GSText']) {
    if (!text.includes(marker)) throw new Error(`${label}: missing ${marker}.`);
  }
  const actualTextCount = (text.match(/\/ActualText/g) || []).length;
  if (actualTextCount < 600) throw new Error(`${label}: expected a dense per-grapheme selectable text layer, got ${actualTextCount} ActualText entries.`);
}

function decodePdfFromResult(text) {
  const match = text.match(/PDF_BASE64=([A-Za-z0-9+/=]+)\nEND_PDF_BASE64/);
  if (!match) throw new Error(`No PDF base64 in browser result:\n${text.slice(0, 600)}`);
  return Buffer.from(match[1], 'base64');
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const chrome = spawn(chromeBin, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    `--remote-debugging-port=${port}`,
    'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  chrome.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

  try {
    let targets;
    for (let i = 0; i < 80; i += 1) {
      try {
        targets = await getJson(`http://127.0.0.1:${port}/json`);
        if (Array.isArray(targets) && targets.length) break;
      } catch {}
      await delay(250);
    }
    const target = targets?.find((item) => item.type === 'page' && item.webSocketDebuggerUrl);
    if (!target) throw new Error(`No Chrome page target found.\n${stderr}`);

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    let id = 0;
    const pending = new Map();
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        pending.get(message.id)(message);
        pending.delete(message.id);
      }
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const messageId = ++id;
      pending.set(messageId, (message) => message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result));
      ws.send(JSON.stringify({ id: messageId, method, params }));
    });

    await send('Runtime.enable');
    await send('Page.enable');

    let lib = await readFile('packages/html2pdf-js/dist/HtmlToPdfPro.js', 'utf8');
    lib = lib.replace('export class HtmlToPdfPro', 'class HtmlToPdfPro');
    lib += '\n;globalThis.HtmlToPdfPro = HtmlToPdfPro;';
    await send('Runtime.evaluate', {
      expression: `(0, eval)(${JSON.stringify(lib)}); 'LIB_OK';`,
      returnByValue: true,
      awaitPromise: true,
      timeout: 10000
    });

    const expression = String.raw`
      (async () => {
        const toBase64 = (bytes) => {
          let binary = '';
          for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.slice(i, i + 8192));
          return btoa(binary);
        };
        document.head.innerHTML = '<meta charset="utf-8"><style>body{margin:0;background:#eef2f7;font-family:Arial,"Noto Sans CJK SC","Microsoft YaHei",sans-serif;color:#111827}#report{width:760px;background:white;margin:0;padding:34px;box-sizing:border-box}.hero{padding:26px;border-radius:20px;background:linear-gradient(135deg,#111827,#2563eb);color:white}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.card{border:1px solid #e5e7eb;border-radius:14px;padding:14px;background:#f8fafc}.callout{border-left:8px solid #f97316;background:#fff7ed;border-radius:12px;margin:22px 0;padding:14px 18px;font-size:16px;line-height:1.8}.wrap{font-size:16px;line-height:1.85;letter-spacing:.02em}.inline strong{color:#1d4ed8}.inline code{background:#eef2ff;border:1px solid #c7d2fe;border-radius:6px;padding:2px 5px}table{width:100%;border-collapse:collapse;margin:20px 0;font-size:13px}th,td{border:1px solid #e5e7eb;padding:9px;text-align:left}th{background:#f1f5f9}pre{white-space:pre-wrap;background:#0f172a;color:#e5e7eb;border-radius:12px;padding:16px}input,textarea,select{font:14px Arial,"Microsoft YaHei",sans-serif;padding:8px;border:1px solid #cbd5e1;border-radius:8px;width:100%;box-sizing:border-box}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.pdf-page-break{break-before:page}</style>';
        document.body.innerHTML = '<article id="report"><section class="hero"><h1>复杂 HTML 元素实测报告</h1><p>COMPLEX_CASE_SELECTABLE_TEXT_OK</p></section><h2>连续中文换行完整性</h2><p class="callout">当前实现主链路已经脱离 html2canvas / jsPDF / Paged.js / IronPress：页面视觉由组件读取 DOM 布局和 computed style 后进入自研 Canvas Painter 导出管线，PDF 中写入可选文字层，支持复制、搜索与链接点击。CJK_WRAP完整性标记_A1。</p><p class="wrap">这是一段没有明显英文空格的中文长句，用来验证 Range 逐字坐标提取在自动换行场景下不会丢失行首行尾文字：中华人民共和国数字化交付项目报告高保真可复制可搜索可链接点击完整输出。</p><h2>Inline / Grid / List</h2><p class="inline">Inline text includes <strong>bold marker BOLD_TEXT_OK</strong>, <em>emphasis marker EM_OK</em>, <code>CODE_INLINE_OK</code>, and <a href="https://example.com">LINK_TEXT_OK</a>.</p><div class="grid"><div class="card"><b>卡片一</b><p>GRID_CARD_ONE_OK</p></div><div class="card"><b>卡片二</b><p>GRID_CARD_TWO_OK</p></div><div class="card"><b>卡片三</b><p>GRID_CARD_THREE_OK</p></div></div><ul><li>列表项一 LIST_ITEM_ONE_OK</li><li>列表项二 LIST_ITEM_TWO_OK</li></ul><h2>表格</h2><table><thead><tr><th>编号</th><th>名称</th><th>金额</th><th>状态</th></tr></thead><tbody><tr><td>01</td><td>视觉方案设计 TABLE_CELL_DESIGN_OK</td><td>¥7,200</td><td>已完成</td></tr><tr><td>02</td><td>页面内容制作 TABLE_CELL_CONTENT_OK</td><td>¥16,800</td><td>进行中</td></tr><tr><td>03</td><td>验收交付 TABLE_CELL_ACCEPT_OK</td><td>¥3,600</td><td>计划中</td></tr></tbody></table><section class="pdf-page-break"><h2>表单和值</h2><div class="form-grid"><label>客户<input value="Flyfish Form Value FORM_INPUT_OK"></label><label>状态<select><option selected>已确认 FORM_SELECT_OK</option></select></label></div><p><textarea>多行文本域 FORM_TEXTAREA_OK\n第二行 textarea 内容保持可复制。</textarea></p><h2>Pre / Code</h2><pre>function demo() {\n  return "PRE_CODE_BLOCK_OK";\n}\nconst amount = "¥12,345.67";</pre><p>FINAL_COMPLEX_MARKER_OK</p></section></article>';
        try {
          const exporter = new globalThis.HtmlToPdfPro({
            filename: 'complex-elements.pdf',
            page: { format: 'a4' },
            margin: '16mm 13mm 18mm 13mm',
            dpi: 96,
            imageQuality: 0.9,
            backgroundColor: '#ffffff',
            fitToPage: true,
            textLayer: true,
            linkAnnotations: true,
            bookmarks: true,
            header: { text: 'Complex HTML smoke', position: 'left' },
            footer: { text: 'Page {page} of {pages}', position: 'center' }
          });
          const bytes = await exporter.toPdf('#report');
          return 'OK\nSIZE=' + bytes.length + '\nPDF_BASE64=' + toBase64(bytes) + '\nEND_PDF_BASE64';
        } catch (error) {
          return 'ERROR\n' + (error && error.stack ? error.stack : String(error));
        }
      })()
    `;

    const result = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
      timeout: 120000
    });
    const text = result.result.value || '';
    if (!text.startsWith('OK\n')) throw new Error(`Complex PDF generation failed:\n${text}\nChrome stderr:\n${stderr}`);
    const bytes = decodePdfFromResult(text);
    assertSelectablePdfStructure(bytes, 'complex-elements.pdf');
    await writeFile(pdfPath, bytes);

    await send('Browser.close').catch(() => {});
    ws.close();
  } finally {
    if (!chrome.killed) chrome.kill('SIGKILL');
  }

  const info = runRequired('pdfinfo', [pdfPath]);
  if (!/Pages:\s+2\b/.test(info)) throw new Error(`Expected a 2-page complex PDF. pdfinfo output:\n${info}`);
  const extracted = runRequired('pdftotext', [pdfPath, '-']);
  const normalized = extracted.replace(/\s+/g, ' ').trim();
  for (const marker of [
    '复杂 HTML 元素实测报告',
    '当前实现主链路已经脱离 html2canvas / jsPDF / Paged.js / IronPress',
    '页面视觉由组件读取 DOM 布局和 computed style',
    'CJK_WRAP完整性标记_A1',
    'BOLD_TEXT_OK',
    'CODE_INLINE_OK',
    'LINK_TEXT_OK',
    'GRID_CARD_THREE_OK',
    'TABLE_CELL_CONTENT_OK',
    'FORM_INPUT_OK',
    'FORM_SELECT_OK',
    'FORM_TEXTAREA_OK',
    'PRE_CODE_BLOCK_OK',
    'FINAL_COMPLEX_MARKER_OK'
  ]) {
    if (!normalized.includes(marker)) throw new Error(`Missing complex marker: ${marker}\nExtracted text:\n${extracted}`);
  }

  const bbox = runRequired('pdftotext', ['-bbox', pdfPath, '-']);
  for (const marker of ['当前实现主链路已经脱离', 'CJK_WRAP完整性标记_A1', 'FORM_INPUT_OK']) {
    if (!bbox.includes(marker)) throw new Error(`Missing complex selectable bbox marker: ${marker}\n${bbox.slice(0, 1800)}`);
  }

  const htmlPrefix = path.join(outputDir, 'complex-elements-pdftohtml');
  await rm(`${htmlPrefix}.xml`, { force: true });
  runRequired('pdftohtml', ['-xml', '-f', '1', '-l', '2', pdfPath, htmlPrefix]);
  const xml = await readFile(`${htmlPrefix}.xml`, 'utf8');
  if (!xml.includes('<text') || !xml.includes('当前实现主链路') || !xml.includes('opacity="0.000000"')) {
    throw new Error(`pdftohtml did not expose selectable transparent text nodes. XML:\n${xml.slice(0, 2000)}`);
  }

  await writeFile(txtPath, extracted);
  console.log(`Complex elements PDF smoke test passed: ${pdfPath}`);
  console.log(info.trim());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
