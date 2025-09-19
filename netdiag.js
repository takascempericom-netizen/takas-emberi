// path: ./netdiag.js
// NEDEN: İlan kaydı sırasında hangi sunucuya ne POST ediliyor ve ne dönüyor -> dosyaya yaz.
const fs = require('fs');
const readline = require('readline');
const { URL } = require('url');
const path = require('path');
const puppeteer = require('puppeteer');

const LOG = path.resolve(process.cwd(), 'network-log.ndjson');
const REPORT = path.resolve(process.cwd(), 'network-report.txt');

function rlQuestion(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(q, ans => (rl.close(), res(ans))));
}
function snippet(s, max = 2000) { if (!s) return ''; return s.length > max ? s.slice(0, max) + '…[kısaltıldı]' : s; }
function redact(str) {
  if (!str) return str;
  return String(str)
    .replace(/([?&])(key|apiKey|token|access_token|id_token)=([^&]+)/gi, '$1$2=***')
    .replace(/"(apiKey|key|token|idToken|access_token|id_token)"\s*:\s*"[^"]+"/gi, '"$1":"***"')
    .replace(/Authorization"\s*:\s*"Bearer [^"]+"/gi, 'Authorization":"Bearer ***"');
}
function redactHeaders(h) {
  const safe = {};
  for (const [k, v] of Object.entries(h || {})) {
    const key = k.toLowerCase();
    if (['cookie', 'authorization', 'x-api-key'].includes(key)) safe[k] = '***';
    else safe[k] = v;
  }
  return safe;
}

(async () => {
  const argUrl = process.argv[2];
  let target = argUrl;
  if (!target) {
    target = await rlQuestion('Site URL (örn. https://siten.com): ');
  }
  if (!/^https?:\/\//i.test(target || '')) {
    console.error('Geçerli bir URL gir (http/https).'); process.exit(1);
  }

  const browser = await puppeteer.launch({
    headless: false, // NEDEN: Sen elle ilan verip tetikleyeceksin
    defaultViewport: null,
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();

  const out = fs.createWriteStream(LOG, { flags: 'a' });
  const t0 = Date.now();
  const recs = [];
  let id = 0;
  const idByReq = new WeakMap();

  function write(obj) {
    const line = JSON.stringify(obj);
    out.write(line + '\n');
    recs.push(obj);
  }

  page.on('pageerror', (err) => {
    write({ t: Date.now() - t0, type: 'pageerror', msg: String(err) });
  });
  page.on('console', (msg) => {
    try {
      write({ t: Date.now() - t0, type: 'console', level: msg.type(), text: msg.text() });
    } catch {}
  });

  page.on('request', (req) => {
    const rid = ++id;
    idByReq.set(req, rid);
    const url = req.url();
    const method = req.method();
    const rtype = req.resourceType();
    const headers = redactHeaders(req.headers());
    const pd = req.postData();
    write({
      t: Date.now() - t0,
      kind: 'request',
      id: rid,
      method,
      url,
      host: safeHost(url),
      rtype,
      headers,
      postData: pd ? snippet(redact(pd), 1500) : ''
    });
  });

  page.on('requestfailed', (req) => {
    const rid = idByReq.get(req) || ++id;
    write({
      t: Date.now() - t0,
      kind: 'requestfailed',
      id: rid,
      method: req.method(),
      url: req.url(),
      host: safeHost(req.url()),
      rtype: req.resourceType(),
      failure: req.failure() ? req.failure().errorText : 'unknown'
    });
  });

  page.on('response', async (res) => {
    try {
      const req = res.request();
      const rid = idByReq.get(req) || ++id;
      const url = req.url();
      const method = req.method();
      const status = res.status();
      const ok = res.ok();
      let body = '';
      if (['xhr', 'fetch'].includes((req.resourceType() || '').toLowerCase())) {
        try {
          const buf = await res.buffer();
          if (buf && buf.length) {
            const text = buf.toString('utf8');
            body = snippet(redact(text), 2000);
          }
        } catch (e) {
          body = '[okunamadı]';
        }
      }
      write({
        t: Date.now() - t0,
        kind: 'response',
        id: rid,
        method,
        url,
        host: safeHost(url),
        status,
        ok,
        body
      });
    } catch (e) {
      write({ t: Date.now() - t0, kind: 'response-error', error: String(e) });
    }
  });

  function safeHost(u) { try { return new URL(u).host; } catch { return ''; } }

  console.log('\nTarayıcı açılıyor…');
  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log('▶ SİTE AÇIK. Normal şekilde ilan ver / kaydet.\nBittiğinde BU terminale gel ve Enter’a bas.\n');

  await rlQuestion('');

  // KAPAT ve RAPORLA
  try { await browser.close(); } catch {}
  try { out.end(); } catch {}

  // Rapor
  const posts = {};
  const hosts = {};
  const statuses = {};

  for (const r of recs) {
    if (r.url) hosts[r.host] = (hosts[r.host] || 0) + 1;
    if (r.kind === 'response') {
      statuses[r.status] = (statuses[r.status] || 0) + 1;
      if (['POST', 'PUT', 'PATCH'].includes(r.method)) {
        const key = `${r.method} ${r.url}`;
        posts[key] = posts[key] ? { ...posts[key], count: posts[key].count + 1, lastStatus: r.status } : { count: 1, lastStatus: r.status };
      }
    }
  }

  const lines = [];
  lines.push('=== İLAN KAYDI AĞ RAPORU ===');
  lines.push(`Toplam kayıt: ${recs.length}`);
  lines.push('\n[Hedef Sunucular]');
  Object.entries(hosts).sort((a,b)=>b[1]-a[1]).forEach(([h,c]) => lines.push(`  - ${h}: ${c} istek`));

  lines.push('\n[POST/PUT/PATCH Uç Noktaları]');
  const postEntries = Object.entries(posts).sort((a,b)=>b[1].count - a[1].count);
  if (postEntries.length === 0) {
    lines.push('  (Bulunamadı) — Form verisi gönderilmemiş olabilir.');
  } else {
    for (const [k, v] of postEntries) lines.push(`  - ${k}  (x${v.count}, son durum: ${v.lastStatus})`);
  }

  lines.push('\n[Durum Kodları]');
  Object.entries(statuses).sort((a,b)=>Number(a[0])-Number(b[0])).forEach(([s,c]) => lines.push(`  - ${s}: ${c}`));

  // Özel ipuçları (NEDEN: yaygın backendler)
  lines.push('\n[Otomatik Tespit]');
  const hostsList = Object.keys(hosts);
  const maybeFirebase = hostsList.some(h => /firebaseio\.com|googleapis\.com|firestore|storage\.googleapis\.com/i.test(h));
  const maybeSupabase = hostsList.some(h => /supabase\.co|supabase\.in/.test(h));
  if (maybeFirebase) lines.push('  • Firebase/Firestore/Storage istekleri görüldü. İlanın Firestore koleksiyonu ya da Storage yazımı bu hostlara gidiyor olabilir.');
  if (maybeSupabase) lines.push('  • Supabase istekleri görüldü. Tablo/Storage uç noktalarını kontrol et.');
  if (!maybeFirebase && !maybeSupabase) lines.push('  • Belirgin bir BaaS izine rastlanmadı; özel backend veya farklı servis olabilir.');

  fs.writeFileSync(REPORT, lines.join('\n'), 'utf8');
  console.log(`\n✅ Bitti.\nRapor: ${REPORT}\nDetay log: ${LOG}\nBu iki dosyayı bana gönder.`);

  process.exit(0);
})();
