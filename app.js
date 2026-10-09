'use strict';
/* Benimle Öğren — kendi sesinle öğrenme.
   Sunucu yok. Ses kayıtları, fotoğraflar ve ilerleme bu cihazda saklanır. */

/* ---------- yardımcılar ---------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sameDay = t => new Date(t).toDateString() === new Date().toDateString();
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3800);
}

/* ---------- depolama ---------- */
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { toast('Depolama alanı dolu veya kapalı.'); } }
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

/* ---------- veri ---------- */
const DEFAULT_WORDS = [
  { id: 'su', word: 'Su', syl: ['su'], emoji: '💧' },
  { id: 'ekmek', word: 'Ekmek', syl: ['ek', 'mek'], emoji: '🍞' },
  { id: 'cay', word: 'Çay', syl: ['çay'], emoji: '☕' },
  { id: 'elma', word: 'Elma', syl: ['el', 'ma'], emoji: '🍎' },
  { id: 'anne', word: 'Anne', syl: ['an', 'ne'], emoji: '👩' },
  { id: 'baba', word: 'Baba', syl: ['ba', 'ba'], emoji: '👨' },
  { id: 'kapi', word: 'Kapı', syl: ['ka', 'pı'], emoji: '🚪' },
  { id: 'otobus', word: 'Otobüs', syl: ['o', 'to', 'büs'], emoji: '🚌' },
  { id: 'telefon', word: 'Telefon', syl: ['te', 'le', 'fon'], emoji: '📱' },
  { id: 'kedi', word: 'Kedi', syl: ['ke', 'di'], emoji: '🐱' }
];
const PHRASES = [
  { k: 'ui:hos', t: 'Hoş geldin', g: 'Yönergeler' },
  { k: 'ui:oku', t: 'Oku', g: 'Yönergeler' },
  { k: 'ui:konus', t: 'Konuş', g: 'Yönergeler' },
  { k: 'ui:yaz', t: 'Yaz', g: 'Yönergeler' },
  { k: 'ui:bul', t: 'Bul', g: 'Yönergeler' },
  { k: 'ui:hangisi', t: 'Hangisi?', g: 'Yönergeler' },
  { k: 'ui:harf', t: 'Harfin üzerinden parmağınla geç', g: 'Yönergeler' },
  { k: 'ui:bitti', t: 'Bugünlük bu kadar', g: 'Yönergeler' },
  { k: 'fb:harika', t: 'Harika!', g: 'Geri bildirim' },
  { k: 'fb:guzel', t: 'Güzel!', g: 'Geri bildirim' },
  { k: 'fb:bir-daha', t: 'Bir daha deneyelim', g: 'Geri bildirim' },
  { k: 'fb:aferin', t: 'Aferin sana', g: 'Geri bildirim' }
];
const S = {
  words: LS.get('words', DEFAULT_WORDS),
  cfg: Object.assign({ pin: null, name: '', profiles: [{ id: 'anne', name: 'Anne' }], active: 'anne', accent: '#1f6f68', min: 15 }, LS.get('cfg', {}))
};
let LOG = LS.get('log', []);
const saveCfg = () => LS.set('cfg', S.cfg);
const saveWords = () => LS.set('words', S.words);
function log(m, w, r) { LOG.push({ t: Date.now(), m, w, r }); if (LOG.length > 3000) LOG = LOG.slice(-3000); LS.set('log', LOG); }

let recSet = new Set();      // etkin profilde kaydı olan anahtarlar
const photoUrls = {};        // kelime id -> fotoğraf URL
const vkey = (k, p) => 'v|' + (p || S.cfg.active) + '|' + k;
const profName = () => (S.cfg.profiles.find(p => p.id === S.cfg.active) || { name: 'Ses' }).name;
async function refreshRec() {
  const keys = await DB.keys(); const pre = 'v|' + S.cfg.active + '|';
  recSet = new Set(keys.filter(k => k.startsWith(pre)));
}
async function loadPhotos() {
  for (const w of S.words) await loadPhoto(w.id);
}
async function loadPhoto(id) {
  const r = await DB.get('img|' + id);
  if (photoUrls[id]) { URL.revokeObjectURL(photoUrls[id]); delete photoUrls[id]; }
  if (r) photoUrls[id] = URL.createObjectURL(new Blob([r.buf], { type: r.type }));
}
const learnerWords = () => S.words.filter(w => recSet.has(vkey('w:' + w.id)));
function allItems() {
  const a = [];
  PHRASES.forEach(p => a.push({ key: p.k, text: p.t, group: p.g }));
  S.words.forEach(w => a.push({ key: 'w:' + w.id, text: w.word, group: 'Kelimeler' }));
  S.words.forEach(w => { if (w.syl.length > 1) w.syl.forEach((s, i) => a.push({ key: 's:' + w.id + ':' + i, text: s, group: 'Heceler', hint: w.word })); });
  return a;
}
function pickWords(m, n) {
  const sc = {};
  LOG.forEach(x => { if (x.m === m && x.w) sc[x.w] = (sc[x.w] || 0) + (x.r === 'miss' ? -2 : 1); });
  return shuffle(learnerWords()).sort((a, b) => (sc[a.id] || 0) - (sc[b.id] || 0)).slice(0, n);
}

/* ---------- ses çalma ---------- */
const urlCache = new Map();
let cur = { a: null, res: null };
async function getUrl(full) {
  if (urlCache.has(full)) return urlCache.get(full);
  const r = await DB.get(full); if (!r) return null;
  const u = URL.createObjectURL(new Blob([r.buf], { type: r.type })); urlCache.set(full, u); return u;
}
function invalidate(full) { const u = urlCache.get(full); if (u) { URL.revokeObjectURL(u); urlCache.delete(full); } }
function stopAudio() { if (cur.a) { try { cur.a.pause(); } catch (e) {} } if (cur.res) cur.res(false); cur = { a: null, res: null }; }
function playUrl(url) {
  return new Promise(res => {
    stopAudio();
    const a = new Audio(url); cur = { a, res };
    a.onended = () => { cur = { a: null, res: null }; res(true); };
    a.onerror = () => { cur = { a: null, res: null }; res(false); };
    a.play().catch(() => { cur = { a: null, res: null }; res(false); });
  });
}
/* Kaydı olmayan öğe için robot sesi KULLANILMAZ; sessiz kalır. */
async function say(k) { if (!recSet.has(vkey(k))) return false; const u = await getUrl(vkey(k)); return u ? playUrl(u) : false; }

/* ---------- ses kaydı + temizleme ---------- */
let REC = null, autoStop;
async function recStart() {
  if (!navigator.mediaDevices || !window.MediaRecorder) throw new Error('Bu tarayıcı ses kaydını desteklemiyor.');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
/* Her tarayıcıda çalsın diye WAV'a çevirir; baş/son sessizliği kırpar, ses seviyesini eşitler. */
async function toWav(blob) {
  const ab = await blob.arrayBuffer();
  const Ctx = window.AudioContext || window.webkitAudioContext; const ctx = new Ctx();
  const buf = await new Promise((res, rej) => { const p = ctx.decodeAudioData(ab, res, rej); if (p && p.catch) p.catch(rej); });
  if (ctx.close) ctx.close();
  const n = buf.length, ch = buf.numberOfChannels, sr = buf.sampleRate;
  const mono = new Float32Array(n);
  for (let c = 0; c < ch; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) mono[i] += d[i] / ch; }
  let peak = 0; for (let i = 0; i < n; i++) { const a = Math.abs(mono[i]); if (a > peak) peak = a; }
  if (peak < 0.02) throw new Error('Ses çok sessiz geldi. Mikrofona biraz yaklaşıp tekrar deneyin.');
  const th = Math.max(0.015, peak * 0.06);
  let s = 0; while (s < n && Math.abs(mono[s]) < th) s++;
  let e = n - 1; while (e > s && Math.abs(mono[e]) < th) e--;
  s = Math.max(0, s - Math.round(sr * 0.12)); e = Math.min(n - 1, e + Math.round(sr * 0.25));
  const len = e - s + 1, gain = 0.9 / peak;
  const dv = new DataView(new ArrayBuffer(44 + len * 2));
  const w = (o, t) => { for (let i = 0; i < t.length; i++) dv.setUint8(o + i, t.charCodeAt(i)); };
  w(0, 'RIFF'); dv.setUint32(4, 36 + len * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  w(36, 'data'); dv.setUint32(40, len * 2, true);
  for (let i = 0; i < len; i++) { const v = Math.max(-1, Math.min(1, mono[s + i] * gain)); dv.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true); }
  return dv.buffer;
}

/* ---------- oturum ---------- */
let sessionStart = null;
const overTime = () => sessionStart && (Date.now() - sessionStart) >= S.cfg.min * 60000;
function endSession() { if (sessionStart) { const sec = Math.round((Date.now() - sessionStart) / 1000); if (sec > 5) log('session', null, sec); sessionStart = null; } }
const starsToday = () => LOG.filter(x => x.m === 'mod' && sameDay(x.t)).length;

/* ---------- yönlendirme ---------- */
const $app = document.getElementById('app');
let V = { name: 'home' }, tok = 0;
const PREP = {}, AFTER = {}, VIEWS = {}, ACT = {}, CHG = {};
function go(name, extra) {
  stopAudio(); abortRecord(); tok++;
  V = Object.assign({ name, fresh: true }, extra || {});
  if (PREP[name]) PREP[name]();
  render(); window.scrollTo(0, 0);
}
function render() {
  $app.innerHTML = VIEWS[V.name]();
  document.documentElement.style.setProperty('--accent', S.cfg.accent);
  const h = AFTER[V.name]; if (h) h();
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
  const f = ACT[el.dataset.act]; if (f) f(el.dataset, el);
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-change]'); if (el && CHG[el.dataset.change]) CHG[el.dataset.change](el);
});

const pic = w => photoUrls[w.id] ? `<img src="${photoUrls[w.id]}" alt="">` : `<span class="emoji" aria-hidden="true">${esc(w.emoji || '🖼️')}</span>`;
const dots = () => `<div class="dots" aria-hidden="true">${V.items.map((_, i) => `<i class="d ${i < V.i ? 'done' : i === V.i ? 'cur' : ''}"></i>`).join('')}</div>`;
const bar = () => `<header class="bar"><button class="btn back" data-act="back" aria-label="Geri">←</button>${dots()}</header>`;

/* ---------- ekranlar: öğrenci ---------- */
VIEWS.home = () => `<main class="center">
  <h1 class="title">Benimle Öğren</h1>
  ${S.cfg.name ? `<p class="sub">Merhaba, ${esc(S.cfg.name)}</p>` : ''}
  <button class="btn xl primary" data-act="start">Başla</button>
</main><button class="adult" data-act="adult">Yetişkin girişi</button>`;
ACT.start = () => { sessionStart = Date.now(); go('menu', { hello: true }); };

VIEWS.menu = () => {
  const n = learnerWords().length, none = n === 0;
  const tile = (m, ic, t, ok) => `<button class="tile" data-act="mod" data-m="${m}" ${ok ? '' : 'disabled'}><span class="ic" aria-hidden="true">${ic}</span>${t}</button>`;
  const st = Math.min(starsToday(), 5);
  return `<header class="bar"><button class="btn back" data-act="exit" aria-label="Çıkış">✕</button><div class="stars" aria-label="Bugünkü yıldızlar">${'★'.repeat(st)}${'☆'.repeat(Math.max(0, 3 - st))}</div></header>
  ${none ? `<div class="note">Henüz ses kaydı yok. Yetişkin girişinden kayıt yapıldığında etkinlikler açılacak.</div>` : ''}
  <main class="menu">${tile('oku', '📖', 'Oku', n >= 1)}${tile('konus', '🎤', 'Konuş', n >= 1)}${tile('yaz', '✏️', 'Yaz', n >= 1)}${tile('bul', '🔍', 'Bul', n >= 2)}</main>`;
};
AFTER.menu = () => { if (V.hello) { V.hello = false; say('ui:hos'); } };
ACT.exit = () => { endSession(); go('home'); };
ACT.back = () => go('menu');
ACT.mod = async d => { const t = tok; await say('ui:' + d.m); if (t === tok) startModule(d.m); };

function startModule(m) {
  let items;
  if (m === 'yaz') {
    const seen = new Set(); items = [];
    pickWords('yaz', 12).forEach(w => { const L = w.word.charAt(0).toLocaleUpperCase('tr'); if (!seen.has(L)) { seen.add(L); items.push({ w, letter: L }); } });
    items = items.slice(0, 5);
  } else items = pickWords(m, m === 'konus' ? 4 : 5);
  if (!items.length || (m === 'bul' && learnerWords().length < 2)) { toast('Bu etkinlik için yeterli kayıtlı kelime yok.'); return; }
  go(m, { items, i: 0 });
}
function advance() {
  V.i++;
  if (V.i >= V.items.length) { log('mod', null, 'done'); finishModule(); return; }
  if (overTime()) { go('end'); return; }
  V.fresh = true; if (PREP[V.name]) PREP[V.name](); render();
}
async function finishModule() { const t = tok; await say('fb:aferin'); if (t !== tok) return; go(overTime() ? 'end' : 'menu'); }
ACT.next = () => {
  const it = V.items[V.i], w = it.w || it;
  if (V.name === 'oku') log('oku', w.id, 'done');
  advance();
};
const curWord = () => { const it = V.items[V.i]; return it.w || it; };
const playWord = () => say('w:' + curWord().id);
ACT.sayWord = () => { playWord(); };

/* Oku */
VIEWS.oku = () => {
  const w = V.items[V.i];
  const hasSyl = w.syl.length > 1 && w.syl.every((_, i) => recSet.has(vkey('s:' + w.id + ':' + i)));
  return `${bar()}<main class="stage">
    <button class="pic" data-act="sayWord" aria-label="${esc(w.word)} dinle">${pic(w)}</button>
    <h2 class="word">${esc(w.word)}</h2>
    ${hasSyl ? `<div class="sylrow" id="syl">${w.syl.map((s, i) => `<button class="chip" data-act="saySyl" data-i="${i}">${esc(s)}</button>`).join('')}</div>` : ''}
    <div class="row"><button class="btn lg" data-act="sayWord">▶ Dinle</button>${hasSyl ? `<button class="btn lg" data-act="sayAllSyl">Heceler</button>` : ''}<button class="btn lg primary" data-act="next">İleri →</button></div>
  </main>`;
};
AFTER.oku = () => { if (V.fresh) { V.fresh = false; playWord(); } };
ACT.saySyl = async d => { const w = curWord(); say('s:' + w.id + ':' + d.i); };
ACT.sayAllSyl = async () => {
  const w = curWord(), t = tok, chips = document.querySelectorAll('#syl .chip');
  for (let i = 0; i < w.syl.length; i++) {
    if (t !== tok) return;
    chips.forEach((c, j) => c.classList.toggle('on', j === i));
    await say('s:' + w.id + ':' + i);
  }
  chips.forEach(c => c.classList.remove('on'));
};

/* Konuş */
PREP.konus = () => { if (V.child) URL.revokeObjectURL(V.child); V.child = null; V.rec = false; };
VIEWS.konus = () => {
  const w = V.items[V.i];
  let ctl;
  if (V.child) ctl = `<div class="row"><button class="btn lg" data-act="sayWord">▶ ${esc(profName())}</button><button class="btn lg" data-act="playChild">▶ Ben</button></div>
    <div class="row"><button class="btn lg" data-act="retry">↻ Tekrar</button><button class="btn lg primary" data-act="next">İleri →</button></div>`;
  else ctl = `<div class="row"><button class="btn lg" data-act="sayWord">▶ ${esc(profName())}</button>
    <button class="btn lg mic ${V.rec ? 'rec' : 'primary'}" data-act="micToggle">${V.rec ? '■ Bitir' : '🎤 Söyle'}</button></div>${V.rec ? '<p class="sub">Dinliyorum…</p>' : ''}`;
  return `${bar()}<main class="stage"><div class="pic">${pic(w)}</div><h2 class="word">${esc(w.word)}</h2>${ctl}</main>`;
};
AFTER.konus = () => { if (V.fresh) { V.fresh = false; playWord(); } };
ACT.micToggle = async () => {
  if (V.rec) return finishChild();
  try { await recStart(); } catch (e) { toast(micErr(e)); return; }
  V.rec = true; render();
  autoStop = setTimeout(() => { if (V.rec) finishChild(); }, 6000);
};
async function finishChild() {
  clearTimeout(autoStop); const t = tok, w = curWord(); V.rec = false;
  let wav;
  try { wav = await toWav(await recStop()); } catch (e) { if (t === tok) { toast(e.message || 'Kayıt alınamadı.'); render(); } return; }
  if (t !== tok) return;
  await DB.put('c|' + w.id, { buf: wav, type: 'audio/wav' }); invalidate('c|' + w.id);
  V.child = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
  log('konus', w.id, 'done'); render(); say('fb:guzel');
}
ACT.playChild = () => { if (V.child) playUrl(V.child); };
ACT.retry = () => { PREP.konus(); render(); };

/* Bul */
PREP.bul = () => {
  const t = V.items[V.i];
  const others = shuffle(learnerWords().filter(w => w.id !== t.id)).slice(0, 2);
  V.opts = shuffle([t, ...others]); V.wrong = []; V.right = null; V.missed = false;
};
VIEWS.bul = () => `${bar()}<main class="stage">
  <h2 class="word" style="font-size:2rem">Hangisi?</h2>
  <button class="btn lg" data-act="sayWord">▶ Dinle</button>
  <div class="choices">${V.opts.map(o => `<button class="choice ${V.wrong.includes(o.id) ? 'dim' : ''} ${V.right === o.id ? 'ok' : ''}" data-act="pick" data-id="${esc(o.id)}" aria-label="seçenek">${pic(o)}</button>`).join('')}</div>
</main>`;
AFTER.bul = async () => { if (V.fresh) { V.fresh = false; const t = tok; await say('ui:hangisi'); if (t === tok) playWord(); } };
ACT.pick = async d => {
  if (V.right) return;
  const t = V.items[V.i], tk = tok;
  if (d.id === t.id) {
    V.right = d.id; log('bul', t.id, V.missed ? 'miss' : 'ok'); render();
    await say('fb:harika'); if (tk === tok) advance();
  } else {
    V.missed = true; V.wrong.push(d.id); render(); say('fb:bir-daha');
  }
};

/* Yaz */
PREP.yaz = () => { V.ok = false; };
VIEWS.yaz = () => {
  const it = V.items[V.i];
  return `${bar()}<main class="stage">
    <div class="row" style="align-items:center"><div class="pic" style="width:96px;border-radius:18px">${pic(it.w)}</div><h2 class="word">${esc(it.w.word)}</h2></div>
    <div class="canvaswrap"><canvas id="cvg" width="360" height="360"></canvas><canvas id="cvd" width="360" height="360" aria-label="Çizim alanı"></canvas></div>
    <div class="okmsg" id="okmsg"></div>
    <div class="row" id="yazbtns"><button class="btn lg" data-act="yazClear">↻ Sil</button><button class="btn lg quiet" data-act="next">Atla</button></div>
  </main>`;
};
AFTER.yaz = () => {
  const it = V.items[V.i], g = document.getElementById('cvg'), gc = g.getContext('2d'), d = document.getElementById('cvd'), dc = d.getContext('2d');
  gc.font = 'bold 300px Lexend,"Segoe UI",Arial,sans-serif'; gc.fillStyle = '#d6dbe1'; gc.textAlign = 'center'; gc.textBaseline = 'middle';
  gc.fillText(it.letter, 180, 195);
  dc.lineCap = 'round'; dc.lineJoin = 'round'; dc.lineWidth = 30;
  dc.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#1f6f68'; dc.fillStyle = dc.strokeStyle;
  let drawing = false, last = null;
  const pos = e => { const r = d.getBoundingClientRect(); return { x: (e.clientX - r.left) * d.width / r.width, y: (e.clientY - r.top) * d.height / r.height }; };
  d.onpointerdown = e => { e.preventDefault(); d.setPointerCapture(e.pointerId); drawing = true; last = pos(e); dc.beginPath(); dc.arc(last.x, last.y, 15, 0, 7); dc.fill(); };
  d.onpointermove = e => { if (!drawing) return; const p = pos(e); dc.beginPath(); dc.moveTo(last.x, last.y); dc.lineTo(p.x, p.y); dc.stroke(); last = p; };
  const end = () => { if (!drawing) return; drawing = false; checkCoverage(gc, dc); };
  d.onpointerup = end; d.onpointercancel = end;
  if (V.fresh) { V.fresh = false; say('ui:harf'); }
};
function checkCoverage(gc, dc) {
  if (V.ok) return;
  const a = gc.getImageData(0, 0, 360, 360).data, b = dc.getImageData(0, 0, 360, 360).data;
  let tot = 0, hit = 0;
  for (let y = 0; y < 360; y += 3) for (let x = 0; x < 360; x += 3) { const i = (y * 360 + x) * 4 + 3; if (a[i] > 40) { tot++; if (b[i] > 40) hit++; } }
  if (tot && hit / tot >= 0.6) {
    V.ok = true; log('yaz', curWord().id, 'ok');
    document.getElementById('okmsg').textContent = '✔';
    document.getElementById('yazbtns').innerHTML = '<button class="btn lg primary" data-act="next">İleri →</button>';
    say('fb:harika');
  }
}
ACT.yazClear = () => { const d = document.getElementById('cvd'); d.getContext('2d').clearRect(0, 0, 360, 360); };

/* Bitiş */
VIEWS.end = () => `<main class="center"><h1 class="title">Bugünlük bu kadar</h1><div class="stars" style="font-size:3rem">${'★'.repeat(Math.min(starsToday(), 5))}</div><button class="btn xl primary" data-act="endOk">Tamam</button></main>`;
AFTER.end = () => { say('ui:bitti'); };
ACT.endOk = () => { endSession(); go('home'); };

/* ---------- PIN ---------- */
async function hashPin(p) {
  try { if (window.crypto && crypto.subtle) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('bo:' + p)); return Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, '0')).join(''); } } catch (e) {}
  return 'p:' + p;
}
ACT.adult = () => go('pin', { mode: S.cfg.pin ? 'login' : 'set1', buf: '', err: '' });
VIEWS.pin = () => {
  const t = V.mode === 'login' ? 'Yetişkin girişi' : V.mode === 'set1' ? 'Yeni PIN belirleyin (4 hane)' : 'PIN\'i tekrar girin';
  return `<main class="center"><h2>${t}</h2><div class="pin" aria-label="PIN">${[0, 1, 2, 3].map(i => `<i class="${V.buf.length > i ? 'f' : ''}"></i>`).join('')}</div>
  <div class="err">${esc(V.err)}</div>
  <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 'del', 0].map(k => k === 'del' ? `<button class="btn" data-act="pinKey" data-k="del" aria-label="Sil">⌫</button>` : `<button class="btn" data-act="pinKey" data-k="${k}">${k}</button>`).join('')}<button class="btn" data-act="exit">Geri</button></div></main>`;
};
ACT.pinKey = async d => {
  if (d.k === 'del') V.buf = V.buf.slice(0, -1); else if (V.buf.length < 4) V.buf += d.k;
  V.err = '';
  if (V.buf.length === 4) {
    if (V.mode === 'login') {
      if ((await hashPin(V.buf)) === S.cfg.pin) return go('panel', { tab: 'ses', recKey: null, guide: null });
      V.err = 'Hatalı PIN'; V.buf = '';
    } else if (V.mode === 'set1') { V.first = V.buf; V.mode = 'set2'; V.buf = ''; }
    else {
      if (V.buf === V.first) { S.cfg.pin = await hashPin(V.buf); saveCfg(); return go('panel', { tab: 'ses', recKey: null, guide: null }); }
      V.err = 'PIN\'ler aynı değil. Baştan başlayın.'; V.mode = 'set1'; V.buf = '';
    }
  }
  render();
};

/* ---------- panel ---------- */
const TABS = [['ses', '🎙️ Ses kaydı'], ['kelime', '📚 Kelimeler'], ['ilerleme', '📈 İlerleme'], ['ayar', '⚙️ Ayarlar']];
VIEWS.panel = () => `<div class="panel">
  <div class="phead"><h2>Yetişkin paneli</h2><button class="btn" data-act="exit">Kapat</button></div>
  <nav class="tabs">${TABS.map(([k, t]) => `<button class="tab ${V.tab === k ? 'on' : ''}" data-act="tab" data-t="${k}">${t}</button>`).join('')}</nav>
  ${PANEL[V.tab]()}</div>`;
ACT.tab = d => { if (REC) return toast('Önce kaydı bitirin.'); V.tab = d.t; render(); };
const PANEL = {};

PANEL.ses = () => {
  const items = allItems(), have = items.filter(i => recSet.has(vkey(i.key))).length;
  const profs = `<select data-change="profile" aria-label="Ses profili">${S.cfg.profiles.map(p => `<option value="${esc(p.id)}" ${p.id === S.cfg.active ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>`;
  let guide = '';
  if (V.guide) {
    const k = V.guide.list[V.guide.i], it = items.find(x => x.key === k);
    guide = it ? `<div class="guide"><div>Kayıt ${V.guide.i + 1} / ${V.guide.list.length}</div><div class="gtext">${esc(it.text)}</div>${it.hint ? `<div>(${esc(it.hint)} kelimesinin hecesi)</div>` : ''}
      <div class="row" style="margin-top:12px"><button class="btn lg ${V.recKey === k ? 'mic rec' : 'primary'}" data-act="recToggle" data-key="${esc(k)}">${V.recKey === k ? '■ Bitir' : '● Kaydet'}</button>
      <button class="btn" data-act="guideSkip">Atla</button><button class="btn" data-act="guideStop">Kapat</button></div></div>` : '';
  }
  const groups = ['Yönergeler', 'Geri bildirim', 'Kelimeler', 'Heceler'].map(g => `<div class="box"><h3>${g}</h3>${items.filter(i => i.group === g).map(i => {
    const has = recSet.has(vkey(i.key)), recing = V.recKey === i.key;
    return `<div class="rrow"><div class="rt">${esc(i.text)}${i.hint ? ` <small>(${esc(i.hint)})</small>` : ''}</div><span class="st ${has ? 'ok' : ''}">${has ? 'Kayıt var' : 'Yok'}</span>
      <button class="icon ${recing ? 'recording' : ''}" data-act="recToggle" data-key="${esc(i.key)}" aria-label="${recing ? 'Bitir' : 'Kaydet'}">${recing ? '■' : '●'}</button>
      <button class="icon" data-act="recPlay" data-key="${esc(i.key)}" ${has ? '' : 'disabled'} aria-label="Dinle">▶</button></div>`;
  }).join('')}</div>`).join('');
  return `<div class="box"><h3>Ses profili</h3><div class="inline">${profs}<button class="btn" data-act="addProfile">+ Yeni ses</button><button class="btn" data-act="delProfile" ${S.cfg.profiles.length < 2 ? 'disabled' : ''}>Bu sesi sil</button></div>
    <p>Hazır: <b>${have} / ${items.length}</b> kayıt. Öğrenci bu profilin sesini duyar. Kaydı olmayan öğeler öğrenciye gösterilmez, robot sesi kullanılmaz.</p>
    <div class="row" style="justify-content:flex-start"><button class="btn primary" data-act="guideStart" ${have === items.length ? 'disabled' : ''}>Eksikleri sırayla kaydet</button></div></div>
    <div class="box"><h3>Kayıt ipuçları</h3><ul><li>Sessiz bir odada, mikrofonu hep aynı mesafede tutun.</li><li>Kelimeyi tek başına, sakin ve net okuyun; soru tonuyla bitirmeyin.</li><li>Baştaki ve sondaki sessizlik otomatik kırpılır, ses seviyesi eşitlenir.</li></ul></div>
    ${guide}${groups}`;
};
ACT.guideStart = () => { const l = allItems().filter(i => !recSet.has(vkey(i.key))).map(i => i.key); if (l.length) { V.guide = { list: l, i: 0 }; render(); } };
ACT.guideSkip = () => { if (REC) return; V.guide.i++; if (V.guide.i >= V.guide.list.length) V.guide = null; render(); };
ACT.guideStop = () => { abortRecord(); V.recKey = null; V.guide = null; render(); };
ACT.recPlay = d => say(d.key);
ACT.recToggle = async d => {
  const key = d.key;
  if (V.recKey && V.recKey !== key) return toast('Önce devam eden kaydı bitirin.');
  if (V.recKey === key) {
    V.recKey = null; render();
    try {
      const wav = await toWav(await recStop());
      await DB.put(vkey(key), { buf: wav, type: 'audio/wav' }); invalidate(vkey(key)); recSet.add(vkey(key));
      toast('Kaydedildi');
      if (V.guide) { V.guide.i++; if (V.guide.i >= V.guide.list.length) { V.guide = null; toast('Tüm kayıtlar tamam'); } render(); }
      else { render(); say(key); }
    } catch (e) { toast(e.message || 'Kayıt başarısız.'); render(); }
  } else {
    try { await recStart(); V.recKey = key; render(); } catch (e) { toast(micErr(e)); }
  }
};
CHG.profile = async el => { S.cfg.active = el.value; saveCfg(); await refreshRec(); render(); };
ACT.addProfile = () => {
  const n = (prompt('Ses adı (örn. Baba, Terapist):') || '').trim(); if (!n) return;
  S.cfg.profiles.push({ id: 'p' + Date.now().toString(36), name: n }); S.cfg.active = S.cfg.profiles[S.cfg.profiles.length - 1].id;
  saveCfg(); refreshRec().then(render);
};
ACT.delProfile = async () => {
  if (!confirm(profName() + ' sesinin tüm kayıtları silinsin mi?')) return;
  const id = S.cfg.active, keys = await DB.keys();
  for (const k of keys) if (k.startsWith('v|' + id + '|')) { invalidate(k); await DB.del(k); }
  S.cfg.profiles = S.cfg.profiles.filter(p => p.id !== id); S.cfg.active = S.cfg.profiles[0].id; saveCfg(); await refreshRec(); render();
};

PANEL.kelime = () => `<div class="box"><h3>Kelime listesi</h3>
  <p>Gerçek fotoğraf eklemek tanıma açısından emojiden daha etkilidir. Yeni kelime eklediğinizde Ses kaydı sekmesinden sesini kaydedin.</p>
  ${S.words.map(w => `<div class="rrow"><div class="thumb">${pic(w)}</div><div class="rt">${esc(w.word)} <small>${esc(w.syl.join('-'))}</small></div>
    <label class="btn" style="min-height:48px;padding:6px 14px;font-size:.9rem">📷 Fotoğraf<input type="file" accept="image/*" data-change="photo" data-id="${esc(w.id)}" hidden></label>
    <button class="icon" data-act="wordDel" data-id="${esc(w.id)}" aria-label="Sil">🗑</button></div>`).join('')}</div>
  <div class="box"><h3>Yeni kelime</h3><div class="inline">
    <input type="text" id="nw" placeholder="Kelime (örn. Market)" aria-label="Kelime">
    <input type="text" id="ns" placeholder="Heceler (mar-ket)" aria-label="Heceler">
    <input type="text" id="ne" placeholder="Emoji (🛒)" style="width:110px" aria-label="Emoji">
    <button class="btn primary" data-act="wordAdd">Ekle</button></div></div>`;
ACT.wordAdd = () => {
  const word = document.getElementById('nw').value.trim(); if (!word) return toast('Kelimeyi yazın.');
  let syl = document.getElementById('ns').value.trim().toLocaleLowerCase('tr').split('-').map(s => s.trim()).filter(Boolean);
  if (!syl.length) syl = [word.toLocaleLowerCase('tr')];
  if (syl.join('') !== word.toLocaleLowerCase('tr').replace(/\s/g, '')) toast('Dikkat: heceler kelimeyle birebir uyuşmuyor.');
  S.words.push({ id: 'k' + Date.now().toString(36), word, syl, emoji: document.getElementById('ne').value.trim() || '🖼️' });
  saveWords(); render();
};
ACT.wordDel = async d => {
  const w = S.words.find(x => x.id === d.id); if (!w || !confirm(w.word + ' ve kayıtları silinsin mi?')) return;
  const keys = await DB.keys();
  for (const k of keys) if (k === 'img|' + w.id || k === 'c|' + w.id || k.includes('|w:' + w.id) && k.startsWith('v|') || k.includes('|s:' + w.id + ':') && k.startsWith('v|')) { invalidate(k); await DB.del(k); }
  if (photoUrls[w.id]) { URL.revokeObjectURL(photoUrls[w.id]); delete photoUrls[w.id]; }
  S.words = S.words.filter(x => x.id !== w.id); saveWords(); await refreshRec(); render();
};
CHG.photo = async el => {
  const f = el.files[0]; if (!f) return;
  try {
    const bmp = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(f); });
    const sc = Math.min(1, 600 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
    c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    URL.revokeObjectURL(bmp.src);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
    await DB.put('img|' + el.dataset.id, { buf: await blob.arrayBuffer(), type: 'image/jpeg' });
    await loadPhoto(el.dataset.id); render();
  } catch (e) { toast('Fotoğraf eklenemedi.'); }
};

PANEL.ilerleme = () => {
  const day = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toDateString(); };
  const mins = n => Math.round(LOG.filter(x => x.m === 'session' && new Date(x.t).toDateString() === day(n)).reduce((a, x) => a + x.r, 0) / 60);
  const cnt = (m, id, r) => LOG.filter(x => x.m === m && x.w === id && (!r || x.r === r)).length;
  const rows = S.words.map(w => {
    const ok = cnt('bul', w.id, 'ok'), miss = cnt('bul', w.id, 'miss');
    return `<tr><td>${esc(w.word)}</td><td>${cnt('oku', w.id)}</td><td>${cnt('konus', w.id)}</td><td>${ok + miss ? ok + '/' + (ok + miss) : '-'}</td><td>${cnt('yaz', w.id)}</td>
      <td><button class="icon" data-act="playChildRec" data-id="${esc(w.id)}" aria-label="Öğrencinin kaydı">▶</button></td></tr>`;
  }).join('');
  return `<div class="box"><h3>Çalışma süresi (dk)</h3><p>Bugün: <b>${mins(0)}</b> · Dün: <b>${mins(1)}</b> · Son 7 gün: <b>${[0, 1, 2, 3, 4, 5, 6].reduce((a, n) => a + mins(n), 0)}</b></p></div>
  <div class="box"><h3>Kelime bazında</h3><table><tr><th>Kelime</th><th>Oku</th><th>Konuş</th><th>Bul (ilk doğru)</th><th>Yaz</th><th>Kayıt</th></tr>${rows}</table>
  <p>▶ düğmesi öğrencinin o kelimeyi söylediği son kaydı çalar. Konuşma anlaşılırlığının değerlendirmesini uzman kayıtları dinleyerek yapar; uygulama puanlama yapmaz.</p></div>`;
};
ACT.playChildRec = async d => { const u = await getUrl('c|' + d.id); if (u) playUrl(u); else toast('Bu kelime için kayıt yok.'); };

PANEL.ayar = () => `<div class="box"><h3>Öğrenci</h3><div class="inline"><input type="text" id="nm" value="${esc(S.cfg.name)}" placeholder="Öğrencinin adı" data-change="name" aria-label="Ad">
  <label>Oturum süresi <select data-change="min">${[10, 15, 20, 30].map(m => `<option ${m === S.cfg.min ? 'selected' : ''}>${m}</option>`).join('')}</select> dk</label></div>
  <p>Renk:</p><div class="inline">${['#1f6f68', '#2b5fa8', '#7a4a8c', '#b0641a'].map(c => `<button class="swatch ${S.cfg.accent === c ? 'on' : ''}" style="background:${c}" data-act="accent" data-c="${c}" aria-label="Renk"></button>`).join('')}</div></div>
  <div class="box"><h3>Güvenlik</h3><button class="btn" data-act="pinChange">PIN'i değiştir</button></div>
  <div class="box"><h3>Yedek</h3><p>Kayıtlar yalnızca bu cihazda durur. Başka cihaza taşımak veya yedek almak için dışa aktarın.</p>
  <div class="inline"><button class="btn" data-act="export">Dışa aktar</button><label class="btn">İçe aktar<input type="file" accept=".json" data-change="import" hidden></label></div></div>
  <div class="box"><h3>Tüm verileri sil</h3><button class="btn" data-act="wipe">Sil</button></div>`;
CHG.name = el => { S.cfg.name = el.value.trim(); saveCfg(); };
CHG.min = el => { S.cfg.min = +el.value; saveCfg(); };
ACT.accent = d => { S.cfg.accent = d.c; saveCfg(); render(); };
ACT.pinChange = () => go('pin', { mode: 'set1', buf: '', err: '' });
const toB64 = buf => { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = s => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer; };
ACT.export = async () => {
  const blobs = {}; for (const k of await DB.keys()) { const r = await DB.get(k); blobs[k] = { type: r.type, b64: toB64(r.buf) }; }
  const f = new Blob([JSON.stringify({ v: 1, cfg: S.cfg, words: S.words, log: LOG, blobs })], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = 'benimle-ogren-yedek-' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
};
CHG.import = async el => {
  const f = el.files[0]; if (!f || !confirm('Mevcut veriler yedekteki verilerle değiştirilsin mi?')) return;
  try {
    const j = JSON.parse(await f.text()); if (!j.v) throw 0;
    await DB.clear(); urlCache.forEach(u => URL.revokeObjectURL(u)); urlCache.clear();
    for (const k in j.blobs) await DB.put(k, { type: j.blobs[k].type, buf: fromB64(j.blobs[k].b64) });
    S.cfg = Object.assign(S.cfg, j.cfg); S.words = j.words; LOG = j.log || [];
    saveCfg(); saveWords(); LS.set('log', LOG); await refreshRec(); await loadPhotos(); toast('Yedek yüklendi'); render();
  } catch (e) { toast('Yedek dosyası okunamadı.'); }
};
ACT.wipe = async () => {
  if (!confirm('Tüm kayıtlar, fotoğraflar ve ilerleme silinecek. Emin misiniz?')) return;
  await DB.clear(); ['cfg', 'words', 'log'].forEach(k => localStorage.removeItem(k)); location.reload();
};

/* ---------- başlat ---------- */
(async function init() {
  try { await DB.open(); await refreshRec(); await loadPhotos(); }
  catch (e) { toast('Bu tarayıcıda depolama kullanılamıyor (gizli sekme olabilir).'); }
  document.documentElement.style.setProperty('--accent', S.cfg.accent);
  render();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
