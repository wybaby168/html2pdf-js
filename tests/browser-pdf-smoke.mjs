import { spawn, spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const outputDir = path.resolve('tests/output');
const pdfPath = path.join(outputDir, 'browser-smoke.pdf');
const txtPath = path.join(outputDir, 'browser-smoke.txt');
const port = Number(process.env.HTML2PDF_PRO_CDP_PORT || 9888);

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

if (!chromeBin) {
  throw new Error('Chrome/Chromium executable not found. Set CHROME_BIN to run the browser PDF smoke test.');
}

function runRequired(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout;
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}


function assertSelectablePdfStructure(pdfBytes, label) {
  const text = pdfBytes.toString('latin1');
  if (text.includes('/Subtype /Type3')) throw new Error(`${label}: Type3 fonts are not allowed for the selectable text layer.`);
  if (/\b3\s+Tr\b/.test(text)) throw new Error(`${label}: text rendering mode 3 Tr is not used because several readers show an I-beam but cannot drag-select it reliably.`);
  if (!text.includes('/ExtGState') || !text.includes('/GSText') || !/\/ca\s+0\b/.test(text)) {
    throw new Error(`${label}: selectable overlay must use the zero-alpha ExtGState /GSText.`);
  }
  for (const marker of ['/Subtype /Type0', '/Subtype /CIDFontType2', '/FontFile2', '/ToUnicode', '/ActualText']) {
    if (!text.includes(marker)) throw new Error(`${label}: missing PDF selectable text marker ${marker}.`);
  }
  const firstText = text.indexOf('/ActualText');
  const firstImage = text.indexOf('/Im1 Do');
  if (firstText < 0 || firstImage < 0 || firstText < firstImage) {
    throw new Error(`${label}: selectable text must be written after the visual image layer so viewer hit-testing reaches the text overlay.`);
  }
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
      } catch {
        // wait for CDP
      }
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

    const testExpression = String.raw`
      (async () => {
        const done = (text) => {
          document.body.innerHTML = '<pre id="result"></pre>';
          document.getElementById('result').textContent = text;
        };
        const toBase64 = (bytes) => {
          let binary = '';
          const chunkSize = 8192;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
          }
          return btoa(binary);
        };
        document.head.innerHTML = '<meta charset="utf-8"><style>body{margin:0;font-family:Arial,sans-serif;background:#eee}#report{width:720px;margin:0;background:white;color:#111827;padding:36px;box-sizing:border-box;border-radius:18px;box-shadow:0 18px 60px rgba(15,23,42,.18)}h1{margin:0 0 12px;font-size:32px;letter-spacing:-.03em}h2{margin-top:28px;font-size:22px}p{font-size:15px;line-height:1.7}.hero{color:white;padding:28px;border-radius:18px;background:linear-gradient(135deg,#172554,#1d4ed8 55%,#38bdf8)}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.card{border:1px solid #e5e7eb;border-radius:14px;padding:16px;background:#f8fafc}table{width:100%;border-collapse:collapse;margin-top:14px;font-size:13px}th,td{border-bottom:1px solid #e5e7eb;padding:10px;text-align:left}th{background:#f1f5f9}.pdf-page-break{break-before:page}</style>';
        document.body.innerHTML = '<article id="report"><section class="hero"><h1>Selectable Text Smoke Test</h1><p>This PDF should keep text searchable and copyable. Invoice Total: USD 123.45.</p></section><h2>Project Summary</h2><p>This paragraph verifies that the exported PDF contains an extractable transparent text layer while the visual layer keeps rounded corners, shadows, gradients, tables and pagination.</p><div class="grid"><div class="card"><strong>Progress</strong><p>92% completed</p></div><div class="card"><strong>Budget</strong><p>64% used</p></div><div class="card"><strong>Risk</strong><p>Low</p></div></div><section class="pdf-page-break"><h2>Cost Table</h2><table><thead><tr><th>#</th><th>Item</th><th>Amount</th></tr></thead><tbody><tr><td>01</td><td>Design</td><td>USD 1200</td></tr><tr><td>02</td><td>Development</td><td>USD 3200</td></tr><tr><td>03</td><td>QA</td><td>USD 800</td></tr></tbody></table><p>Final marker: COPYABLE_TEXT_LAYER_OK</p></section></article>';
        try {
          const exporter = new globalThis.HtmlToPdfPro({
            filename: 'browser-smoke.pdf', page: { format: 'a4' }, margin: '18mm 14mm 19mm 14mm',
            dpi: 96, imageQuality: 0.9, backgroundColor: '#ffffff', fitToPage: true,
            pageBreakMode: 'avoid', textLayer: true, linkAnnotations: true, bookmarks: true,
            header: 'Browser Smoke Header', footer: 'Page {page} of {pages}', collectStyles: true,
            includeExternalStylesheets: false, inlineImages: false, inlineCanvas: false,
            materializePseudoElements: false, timeoutMs: 15000, onProgress: () => {}
          });
          const bytes = await exporter.toPdf('#report');
          done('OK\nSIZE=' + bytes.length + '\nPDF_BASE64=' + toBase64(bytes) + '\nEND_PDF_BASE64');
        } catch (error) {
          done('ERROR\n' + (error && error.stack ? error.stack : String(error)));
        }
      })()
    `;

    await send('Runtime.evaluate', {
      expression: testExpression,
      returnByValue: true,
      awaitPromise: false,
      timeout: 1000
    });

    let text = '';
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      const result = await send('Runtime.evaluate', {
        expression: `document.getElementById('result')?.textContent || ''`,
        returnByValue: true,
        awaitPromise: true,
        timeout: 5000
      });
      text = result.result.value || '';
      if (text.startsWith('OK\n') || text.startsWith('ERROR\n')) break;
      await delay(500);
    }

    if (!text.startsWith('OK\n')) throw new Error(`Browser PDF generation failed or timed out:\n${text}\nChrome stderr:\n${stderr}`);
    const bytes = decodePdfFromResult(text);
    if (bytes.length < 20000) throw new Error(`Generated PDF is unexpectedly small: ${bytes.length} bytes`);
    assertSelectablePdfStructure(bytes, 'browser-smoke.pdf');
    await writeFile(pdfPath, bytes);

    await send('Browser.close').catch(() => {});
    ws.close();
  } finally {
    if (!chrome.killed) chrome.kill('SIGKILL');
  }

  const info = runRequired('pdfinfo', [pdfPath]);
  if (!/Pages:\s+2\b/.test(info)) throw new Error(`Expected a 2-page PDF. pdfinfo output:\n${info}`);
  if (!/PDF version:\s+1\.7\b/.test(info)) throw new Error(`Expected PDF 1.7. pdfinfo output:\n${info}`);

  const extracted = runRequired('pdftotext', [pdfPath, '-']);
  const bbox = runRequired('pdftotext', ['-bbox', pdfPath, '-']);
  if (!bbox.includes('Selectable Text Smoke Test')) {
    throw new Error(`Missing selectable bounding boxes for browser smoke text. BBox output:
${bbox.slice(0, 1000)}`);
  }
  const htmlPrefix = path.join(outputDir, 'browser-smoke-pdftohtml');
  await rm(`${htmlPrefix}.xml`, { force: true });
  runRequired('pdftohtml', ['-xml', '-f', '1', '-l', '1', pdfPath, htmlPrefix]);
  const htmlXml = await readFile(`${htmlPrefix}.xml`, 'utf8');
  if (!htmlXml.includes('<text') || !htmlXml.includes('Selectable Text Smoke Test') || !htmlXml.includes('opacity="0.000000"')) {
    throw new Error(`pdftohtml did not expose a transparent selectable text overlay. XML output:
${htmlXml.slice(0, 1200)}`);
  }
  await writeFile(txtPath, extracted);
  const normalized = extracted.replace(/\s+/g, ' ').trim();
  for (const marker of [
    'Selectable Text Smoke Test',
    'Invoice Total: USD 123.45',
    'COPYABLE_TEXT_LAYER_OK',
    'Page 1 of 2',
    'Page 2 of 2'
  ]) {
    if (!normalized.includes(marker)) {
      throw new Error(`Missing text marker in generated PDF: ${marker}\nExtracted text:\n${extracted}`);
    }
  }

  console.log(`PDF smoke test passed: ${pdfPath}`);
  console.log(info.trim());
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
