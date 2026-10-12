'use strict';
/* core.js — ortak yardımcılar. Yüklenirken DOM'a dokunmaz (testlerde node içinde de çalışır). */

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sameDay = t => new Date(t).toDateString() === new Date().toDateString();
const sleep = ms => new Promise(r => setTimeout(r, ms));
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast'); if (!el) return;
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 4200);
}

/* ---------- Türkçe metin ---------- */
const trLower = s => String(s).toLocaleLowerCase('tr');
const trUpper = s => String(s).toLocaleUpperCase('tr');
const NUMW = { 0: 'sıfır', 1: 'bir', 2: 'iki', 3: 'üç', 4: 'dört', 5: 'beş', 6: 'altı', 7: 'yedi', 8: 'sekiz', 9: 'dokuz', 10: 'on' };
const normTR = s => trLower(String(s || '').replace(/\([^)]*\)/g, ' ').replace(/\b\d+\b/g, m => NUMW[m] || m)).replace(/[^a-zçğıöşü]/g, '');
function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
function sim(a, b) { a = normTR(a); b = normTR(b); if (!a && !b) return 1; if (!a || !b) return 0; return 1 - lev(a, b) / Math.max(a.length, b.length); }

/* Heceleme + zorluk: tools/build_data.py ile birebir aynı kural (test edilir). */
const VOW = 'aeıioöuü';
const isV = c => VOW.includes(c);
const ONSETS = ['tr', 'pr', 'pl', 'kr', 'kl', 'bl', 'br', 'dr', 'gr', 'gl', 'fr', 'fl'];
function syllabify(word) {
  const w = trLower(word), idx = [];
  for (let i = 0; i < w.length; i++) if (isV(w[i])) idx.push(i);
  if (!idx.length) return [w];
  const cuts = [0];
  for (let k = 0; k + 1 < idx.length; k++) {
    const a = idx[k], b = idx[k + 1], n = b - a - 1;
    if (n === 0) cuts.push(b);
    else if (n === 3 && ONSETS.includes(w.slice(b - 2, b))) cuts.push(b - 2);
    else cuts.push(b - 1);
  }
  cuts.push(w.length);
  const out = []; for (let k = 0; k < cuts.length - 1; k++) out.push(w.slice(cuts[k], cuts[k + 1]));
  return out;
}
function complexity(syl) {
  const s = syl.length; let closed = 0, cluster = false;
  for (const x of syl) {
    if (!isV(x[x.length - 1])) closed++;
    for (let i = 0; i + 1 < x.length; i++) if (!isV(x[i]) && !isV(x[i + 1])) cluster = true;
  }
  return s + 0.5 * closed + (cluster ? 1 : 0);
}
const HARD = { r: 0.3, ş: 0.2, ç: 0.2, c: 0.2, j: 0.2, ğ: 0.2, s: 0.1, z: 0.1, f: 0.1, v: 0.1, h: 0.1, l: 0.1, y: 0.1 };
function scoreOf(word, syl) { let sc = complexity(syl) + 0.08 * word.length; for (const ch of word) sc += HARD[ch] || 0; return sc; }
function levelOf(sc) { let l = 1; for (const c of LEVEL_CUTS) if (sc > c) l++; return l; }
const patternOf = s => Array.from(s).map(c => isV(c) ? 'V' : 'C').join('');

/* büyük/küçük harf gösterimi (ayarlardan) */
let CASE_MODE = 'lower';
const fmt = (t, first = true) => CASE_MODE === 'upper' ? trUpper(t) : (CASE_MODE === 'title' && first ? trUpper(t.charAt(0)) + t.slice(1) : t);

/* ---------- konuşma metinleri (yönergeler ve geri bildirim) ---------- */
const PHRASES = [
  { k: 'ui:hos', t: 'Hoş geldin', g: 'Yönergeler' },
  { k: 'ui:oku', t: 'Oku', g: 'Yönergeler' },
  { k: 'ui:konus', t: 'Konuş', g: 'Yönergeler' },
  { k: 'ui:yaz', t: 'Yaz', g: 'Yönergeler' },
  { k: 'ui:bul', t: 'Bul', g: 'Yönergeler' },
  { k: 'ui:hece', t: 'Heceler', g: 'Yönergeler' },
  { k: 'ui:hangisi', t: 'Hangisi?', g: 'Yönergeler' },
  { k: 'ui:harf', t: 'Harfin üzerinden parmağınla geç', g: 'Yönergeler' },
  { k: 'ui:dinle', t: 'Dinle', g: 'Yönergeler' },
  { k: 'ui:soyle', t: 'Şimdi sen söyle', g: 'Yönergeler' },
  { k: 'ui:tekrar', t: 'Tekrar edelim', g: 'Yönergeler' },
  { k: 'ui:bitti', t: 'Bugünlük bu kadar', g: 'Yönergeler' },
  { k: 'ui:yarin', t: 'Yarın görüşürüz', g: 'Yönergeler' },
  { k: 'fb:harika', t: 'Harika!', g: 'Geri bildirim' },
  { k: 'fb:guzel', t: 'Güzel!', g: 'Geri bildirim' },
  { k: 'fb:super', t: 'Süpersin!', g: 'Geri bildirim' },
  { k: 'fb:bravo', t: 'Bravo!', g: 'Geri bildirim' },
  { k: 'fb:cokguzel', t: 'Çok güzel!', g: 'Geri bildirim' },
  { k: 'fb:dogru', t: 'Doğru!', g: 'Geri bildirim' },
  { k: 'fb:aferin', t: 'Aferin sana', g: 'Geri bildirim' },
  { k: 'fb:bir-daha', t: 'Bir daha deneyelim', g: 'Geri bildirim' },
  { k: 'fb:yaklastin', t: 'Çok yaklaştın', g: 'Geri bildirim' }
];
const PRAISE = ['fb:harika', 'fb:guzel', 'fb:super', 'fb:bravo', 'fb:cokguzel', 'fb:dogru'];
const RETRY = ['fb:bir-daha', 'fb:yaklastin'];

/* ---------- depolama ---------- */
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { toast('Depolama alanı dolu veya kapalı.'); } },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};
const DB = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('benimle-ogren', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('blobs');
      r.onsuccess = () => { DB.db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  },
  st(mode) { return DB.db.transaction('blobs', mode).objectStore('blobs'); },
  req(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  get(k) { return DB.req(DB.st('readonly').get(k)).then(v => v || null); },
  put(k, v) { return DB.req(DB.st('readwrite').put(v, k)); },
  del(k) { return DB.req(DB.st('readwrite').delete(k)); },
  keys() { return DB.req(DB.st('readonly').getAllKeys()); },
  clear() { return DB.req(DB.st('readwrite').clear()); }
};
const vkey = (k, p) => 'v|' + p + '|' + k;

/* ---------- ses kaydı ---------- */
let REC = null, autoStop = null;
async function recStart() {
  if (!navigator.mediaDevices || !window.MediaRecorder) throw new Error('Bu tarayıcı ses kaydını desteklemiyor.');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  const mr = new MediaRecorder(stream); const chunks = [];
  mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  mr.start(); REC = { mr, stream, chunks };
}
function recStop() {
  return new Promise((res, rej) => {
    if (!REC) return rej(new Error('Kayıt yok'));
    const r = REC; REC = null;
    r.mr.onstop = () => { r.stream.getTracks().forEach(t => t.stop()); res(new Blob(r.chunks, { type: r.mr.mimeType || 'audio/webm' })); };
    try { r.mr.stop(); } catch (e) { rej(e); }
  });
}
function abortRecord() {
  clearTimeout(autoStop);
  if (REC) { const r = REC; REC = null; try { r.mr.onstop = null; r.mr.stop(); } catch (e) {} r.stream.getTracks().forEach(t => t.stop()); }
}
const micErr = e => (e && e.name === 'NotAllowedError') ? 'Mikrofon izni gerekiyor. Tarayıcı ayarlarından izin verin.' : (e && e.message) || 'Kayıt başlatılamadı.';

/* ---------- ses işleme ---------- */
async function decodeBlob(blob) {
  const ab = await blob.arrayBuffer();
  const Ctx = window.AudioContext || window.webkitAudioContext; const ctx = new Ctx();
  const buf = await new Promise((res, rej) => { const p = ctx.decodeAudioData(ab, res, rej); if (p && p.catch) p.catch(rej); });
  if (ctx.close) ctx.close();
  const n = buf.length, ch = buf.numberOfChannels, mono = new Float32Array(n);
  for (let c = 0; c < ch; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) mono[i] += d[i] / ch; }
  return { mono, sr: buf.sampleRate };
}
function encodeWav(mono, sr) {
  const len = mono.length, dv = new DataView(new ArrayBuffer(44 + len * 2));
  const w = (o, t) => { for (let i = 0; i < t.length; i++) dv.setUint8(o + i, t.charCodeAt(i)); };
  w(0, 'RIFF'); dv.setUint32(4, 36 + len * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  w(36, 'data'); dv.setUint32(40, len * 2, true);
  for (let i = 0; i < len; i++) { const v = Math.max(-1, Math.min(1, mono[i])); dv.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true); }
  return dv.buffer;
}
async function resampleTo(mono, sr, to) {
  if (sr === to) return mono;
  const len = Math.round(mono.length * to / sr);
  const oc = new OfflineAudioContext(1, len, to);
  const b = oc.createBuffer(1, mono.length, sr); b.copyToChannel(mono, 0);
  const src = oc.createBufferSource(); src.buffer = b; src.connect(oc.destination); src.start();
  const r = await oc.startRendering(); return r.getChannelData(0).slice();
}
function analyzeAudio(mono, sr) {
  const w = Math.round(sr * 0.05), f = [];
  for (let i = 0; i + w <= mono.length; i += w) { let s = 0; for (let j = i; j < i + w; j++) s += mono[j] * mono[j]; f.push(10 * Math.log10(s / w + 1e-12)); }
  f.sort((a, b) => a - b);
  const pct = p => f.length ? f[Math.min(f.length - 1, Math.floor(p * f.length))] : -100;
  let peak = 0, clip = 0;
  for (let i = 0; i < mono.length; i++) { const a = Math.abs(mono[i]); if (a > peak) peak = a; if (a > 0.99) clip++; }
  return { dur: mono.length / sr, peakDb: 20 * Math.log10(peak + 1e-9), speechDb: pct(0.8), noiseDb: pct(0.1), clip: mono.length ? clip / mono.length : 0, peak };
}
function sampleWarnings(st) {
  const w = [];
  if (st.clip > 0.002 || st.peakDb > -0.5) w.push('Ses taşmış (patlama var). Mikrofondan biraz uzaklaşın.');
  if (st.speechDb < -42) w.push('Ses çok kısık. Mikrofona biraz yaklaşın.');
  if (st.speechDb - st.noiseDb < 22) w.push('Arka planda gürültü var. Daha sessiz bir yerde tekrar kaydedin.');
  return w;
}
/* Kısa klip (kelime/hece/çocuğun sesi): baş ve sondaki sessizliği kırp, seviyeyi eşitle. */
async function clipFromBlob(blob) {
  const { mono, sr } = await decodeBlob(blob), n = mono.length;
  let peak = 0; for (let i = 0; i < n; i++) { const a = Math.abs(mono[i]); if (a > peak) peak = a; }
  if (peak < 0.02) throw new Error('Ses çok sessiz geldi. Mikrofona biraz yaklaşıp tekrar deneyin.');
  const th = Math.max(0.015, peak * 0.06);
  let s = 0; while (s < n && Math.abs(mono[s]) < th) s++;
  let e = n - 1; while (e > s && Math.abs(mono[e]) < th) e--;
  s = Math.max(0, s - Math.round(sr * 0.12)); e = Math.min(n - 1, e + Math.round(sr * 0.25));
  const out = new Float32Array(e - s + 1), g = 0.9 / peak;
  for (let i = 0; i < out.length; i++) out[i] = mono[s + i] * g;
  return encodeWav(out, sr);
}
/* Klonlama örneği: kırpma YOK; 24 kHz mono; konuşma seviyesi yaklaşık -20 dBFS, tepe en çok -3 dBFS. */
async function sampleFromBlob(blob) {
  const d = await decodeBlob(blob), mono = await resampleTo(d.mono, d.sr, 24000);
  const st = analyzeAudio(mono, 24000);
  let gain = Math.pow(10, (-20 - st.speechDb) / 20);
  gain = Math.min(gain, 0.708 / (st.peak || 1), 8);
  const out = new Float32Array(mono.length); for (let i = 0; i < out.length; i++) out[i] = mono[i] * gain;
  return { buf: encodeWav(out, 24000), st };
}
