/* Real functional verification: loads each built page in jsdom (node-canvas backed),
   drives the actual UI with fixture files, asserts real outputs. Run: node tests/verify.mjs */
import { JSDOM } from 'jsdom';
import { createCanvas, loadImage as canvasLoadImage } from 'canvas';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} ${extra}`); }
};
const waitFor = async (fn, ms = 8000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch {} await new Promise(r => setTimeout(r, 200)); }
  return false;
};

// ---------- fixtures ----------
function fixturePng(w = 800, h = 600) {
  const c = createCanvas(w, h), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#ff5a5a'); g.addColorStop(0.5, '#4f8cff'); g.addColorStop(1, '#22c55e');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = '#fff';
  for (let i = 0; i < 40; i++) x.fillRect(Math.random() * w, Math.random() * h, 30, 30);
  x.fillStyle = '#000'; x.font = '48px sans-serif'; x.fillText('VisionQuantech test image', 40, h / 2);
  return c.toBuffer('image/png');
}
async function fixturePdf(pages, label) {
  const d = await PDFDocument.create();
  const font = await d.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) {
    const p = d.addPage([595, 842]);
    p.drawText(`${label} — page ${i + 1}`, { x: 60, y: 780, size: 24, font, color: rgb(0.1, 0.2, 0.5) });
    p.drawText('Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(20), { x: 60, y: 700, size: 11, font, maxWidth: 475 });
  }
  return Buffer.from(await d.save({ useObjectStreams: false }));
}

// ---------- page loader ----------
async function loadPage(rel) {
  const file = path.join(ROOT, rel);
  const html = fs.readFileSync(file, 'utf8');
  const dom = new JSDOM(html, {
    url: pathToFileURL(file).href,
    resources: 'usable', runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(w) {
      w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
      w.URL.createObjectURL = () => 'blob:mock';
      w.URL.revokeObjectURL = () => {};
    }
  });
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('load timeout ' + rel)), 20000);
    dom.window.addEventListener('load', () => { clearTimeout(t); res(); });
  });
  const { window } = dom, { document } = window;
  // Decode images with node-canvas instead of fake blob URLs
  window.VQT.loadImage = async (file) => {
    const buf = Buffer.from(await file.arrayBuffer());
    return canvasLoadImage(buf);
  };
  const setFiles = (id, files) => {
    const input = document.getElementById(id);
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
  };
  const click = (id) => document.getElementById(id).dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  return { window, document, setFiles, click, F: (buf, name, type) => new window.File([buf], name, { type }) };
}

// ---------- logic-level image pipeline (same canvas ops the pages use) ----------
console.log('■ Logic-level image pipeline (node-canvas, mirrors page code)');
{
  const png = fixturePng();
  const img = await canvasLoadImage(png);
  const c = createCanvas(img.width, img.height);
  c.getContext('2d').drawImage(img, 0, 0);
  const jpg60 = c.toBuffer('image/jpeg', { quality: 0.6 });
  ok('compress: JPEG q60 smaller than PNG source', jpg60.length < png.length, `${png.length} → ${jpg60.length}`);
  const c2 = createCanvas(400, 300); c2.getContext('2d').drawImage(img, 0, 0, 400, 300);
  const r = c2.toBuffer('image/jpeg', { quality: 0.9 });
  ok('resize: 400x300 output produced', r.length > 1000, `${r.length} bytes`);
  const webp = c.toBuffer('image/webp', { quality: 0.9 });
  if (webp) ok('convert: PNG → WebP output produced', webp.length > 1000, `${webp.length} bytes`);
  else console.log('  ⚠️ node-canvas lacks WebP encode — skipped (browsers support WebP natively)');
}

// ---------- page-level tests ----------
console.log('■ image-compressor.html');
{
  const { document, setFiles, click, F } = await loadPage('tools/image-compressor.html');
  setFiles('fi', [F(fixturePng(), 'photo.png', 'image/png')]);
  document.getElementById('fmt').value = 'image/jpeg';
  document.getElementById('q').value = '60';
  click('go');
  const done = await waitFor(() => document.getElementById('list').textContent.includes('−'));
  ok('compress UI: shows before→after with savings %', done);
  const m = document.getElementById('list').textContent.match(/−(\d+)%/);
  ok('compress UI: positive savings', !!m && +m[1] > 0, m && m[0]);
}

console.log('■ image-resizer.html');
{
  const { document, setFiles, click, F } = await loadPage('tools/image-resizer.html');
  setFiles('fi', [F(fixturePng(), 'photo.png', 'image/png')]);
  await waitFor(() => !document.getElementById('go').disabled);
  document.getElementById('w').value = '400';
  document.getElementById('w').dispatchEvent(new document.defaultView.Event('input', { bubbles: true }));
  click('go');
  const pv = document.getElementById('pv');
  ok('resize UI: preview shown after resize', await waitFor(() => pv.style.display !== 'none'));
}

console.log('■ image-converter.html');
{
  const { document, setFiles, click, F } = await loadPage('tools/image-converter.html');
  setFiles('fi', [F(fixturePng(), 'photo.png', 'image/png')]);
  document.getElementById('fmt').value = 'image/jpeg'; // webp asserted at logic level; node-canvas lacks webp encode
  click('go');
  ok('convert UI: PNG → JPG row appears', await waitFor(() => document.getElementById('list').textContent.includes('JPG')));
}

console.log('■ pdf-merger.html');
{
  const { document, setFiles, click, F } = await loadPage('tools/pdf-merger.html');
  const a = await fixturePdf(3, 'DocA'), b = await fixturePdf(2, 'DocB');
  setFiles('fi', [F(a, 'a.pdf', 'application/pdf'), F(b, 'b.pdf', 'application/pdf')]);
  click('go');
  const res = document.getElementById('res');
  ok('merge UI: reports merged file', await waitFor(() => res.textContent.includes('Merged 2 PDFs')));
  ok('merge UI: page count = 5', res.textContent.includes('Pages: 5'), res.textContent.slice(0, 120));
}

console.log('■ pdf-splitter.html');
{
  const { document, setFiles, click, F, window } = await loadPage('tools/pdf-splitter.html');
  setFiles('fi', [F(await fixturePdf(4, 'Doc'), 'doc.pdf', 'application/pdf')]);
  await waitFor(() => !document.getElementById('go').disabled);
  const res = document.getElementById('res');
  document.getElementById('ranges').value = '1-2';
  click('go');
  ok('split UI: extracts range 1-2', await waitFor(() => res.textContent.includes('Extracted 2 page(s)')));
  // verify the extracted PDF actually has 2 pages by intercepting download
  let saved = null;
  window.VQT.download = (blob) => { saved = blob; };
  res.querySelector('button').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await waitFor(() => !!saved);
  const d = await PDFDocument.load(Buffer.from(await saved.arrayBuffer()));
  ok('split file: extracted PDF has 2 pages', d.getPageCount() === 2);
  // each-page mode → ZIP: jsdom can't run JSZip.generateAsync (env limitation, works in real
  // browsers), so verify the identical logic in node with the real jszip + pdf-lib:
  {
    const { default: JSZipN } = await import('jszip');
    const srcN = await PDFDocument.load(await fixturePdf(4, 'Doc'));
    const zip = new JSZipN();
    for (let i = 0; i < 4; i++) {
      const out = await PDFDocument.create();
      (await out.copyPages(srcN, [i])).forEach(p => out.addPage(p));
      zip.file(`doc-page-${i + 1}.pdf`, await out.save({ useObjectStreams: true }));
    }
    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    const re = await JSZipN.loadAsync(buf);
    const names = Object.keys(re.files);
    let allOnePage = names.length === 4;
    for (const n of names) {
      const dd = await PDFDocument.load(await re.files[n].async('uint8array'));
      if (dd.getPageCount() !== 1) allOnePage = false;
    }
    ok('split each-page: ZIP has 4 valid 1-page PDFs (node-level, real jszip)', allOnePage, `${buf.length} bytes`);
  }
  // DOM wiring for each-mode: mode switch hides ranges, go starts processing
  document.getElementById('mode').value = 'each';
  document.getElementById('mode').dispatchEvent(new window.Event('change', { bubbles: true }));
  ok('split UI: ranges field hidden in each-mode', document.getElementById('rf').style.display === 'none');
}

console.log('■ pdf-compressor.html');
{
  const { document, setFiles, click, F } = await loadPage('tools/pdf-compressor.html');
  setFiles('fi', [F(await fixturePdf(5, 'Big'), 'big.pdf', 'application/pdf')]);
  await waitFor(() => !document.getElementById('go').disabled);
  click('go');
  const res = document.getElementById('res');
  ok('compress UI: reports result', await waitFor(() => res.textContent.includes('Compressed 5 page(s)')));
  ok('compress UI: output not larger than input', /Saved: \d+%/.test(res.textContent), res.textContent.slice(0, 160));
}

console.log('■ qr-generator.html');
{
  const { document, click, window } = await loadPage('tools/qr-generator.html');
  document.getElementById('f_url').value = 'https://visionquantech.com';
  click('go');
  await new Promise(r => setTimeout(r, 500));
  const cv = document.getElementById('qr');
  const px = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  let dark = 0;
  for (let i = 0; i < px.length; i += 4) if (px[i] < 128) dark++;
  ok('QR UI: canvas has dark modules', dark > 100, `${dark} dark px`);
  ok('QR UI: download button offered', document.getElementById('dl').textContent.includes('Download PNG'));
}

console.log('■ word-counter.html');
{
  const { document, window } = await loadPage('tools/word-counter.html');
  const t = document.getElementById('t');
  t.value = 'Hello world. This is a test!';
  t.dispatchEvent(new window.Event('input', { bubbles: true }));
  ok('word count = 6', document.getElementById('w').textContent === '6', document.getElementById('w').textContent);
  ok('sentence count = 2', document.getElementById('s').textContent === '2');
}

console.log('■ password-generator.html');
{
  const { document, click } = await loadPage('tools/password-generator.html');
  click('gen');
  const pw = document.getElementById('out').textContent;
  ok('password length = 20', pw.length === 20, pw);
  ok('strength meter shows entropy', /bits of entropy/.test(document.getElementById('mlabel').textContent));
}

console.log('■ json-formatter.html');
{
  const { document, click } = await loadPage('tools/json-formatter.html');
  document.getElementById('inp').value = '{"a":1,"b":[2,3]}';
  click('pretty');
  ok('beautify works', document.getElementById('outp').value.includes('"a": 1'));
  document.getElementById('inp').value = '{"a":}';
  click('valid');
  ok('invalid JSON flagged', document.getElementById('msg').textContent.includes('Invalid'));
}

// ---------- SEO / static checks ----------
console.log('■ SEO + link checks');
{
  const pages = ['index.html', 'pricing.html', 'api.html',
    'tools/image-compressor.html', 'tools/image-resizer.html', 'tools/image-converter.html',
    'tools/pdf-compressor.html', 'tools/pdf-merger.html', 'tools/pdf-splitter.html',
    'tools/qr-generator.html', 'tools/word-counter.html', 'tools/password-generator.html', 'tools/json-formatter.html'];
  let seoOk = true, linkOk = true;
  const missing = [];
  for (const p of pages) {
    const html = fs.readFileSync(path.join(ROOT, p), 'utf8');
    if (!/<title>[^<]{10,}<\/title>/.test(html)) { seoOk = false; missing.push(p + ':title'); }
    if (!/meta name="description" content="[^"]{40,}"/.test(html)) { seoOk = false; missing.push(p + ':desc'); }
    if (!/canonical/.test(html)) { seoOk = false; missing.push(p + ':canonical'); }
    if (p.startsWith('tools/') && !/application\/ld\+json/.test(html)) { seoOk = false; missing.push(p + ':jsonld'); }
    if (!/ADSENSE/.test(html)) { seoOk = false; missing.push(p + ':adslot'); }
    for (const m of html.matchAll(/(?:href|src)="(?!https?:|#|mailto:)([^"]+)"/g)) {
      const target = path.normalize(path.join(path.dirname(p), m[1]));
      if (!fs.existsSync(path.join(ROOT, target))) { linkOk = false; missing.push(`${p} → ${m[1]}`); }
    }
  }
  ok('all pages: title + meta description + canonical + JSON-LD (tools) + AdSense placeholders', seoOk, missing.join('; '));
  ok('all relative links resolve to real files', linkOk, missing.join('; '));
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
