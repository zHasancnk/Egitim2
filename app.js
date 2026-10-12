'use strict';
/* app.js — ekranlar ve akış.
   Ortak yardımcılar: core.js · veri: data.js · okuma parçası: passage.js · ses fabrikası: voice.js */

const el = id => document.getElementById(id);

/* ---------- veri ---------- */
const BASE = WORDS.map(r => ({ id: r[0], word: r[0], syl: r[1].split('-'), theme: r[2], level: r[3], emoji: r[4] || '', base: true }));
const DEF = {
  pin: null, name: '', profiles: [{ id: 'anne', name: 'Anne', voiceId: '' }], active: 'anne', accent: '#1f6f68', min: 15,
  levels: [1, 2], themes: [], hidden: [], casemode: 'lower', asr: false,
  model: 'eleven_multilingual_v2', speed: 0.85, stability: 0.7, similarity: 0.85
};
const S = { cfg: Object.assign({}, DEF, LS.get('cfg', {})), custom: LS.get('custom', []) };
let LOG = LS.get('log', []);
let MAN = new Set(LS.get('manual', []));            // elle kaydedilmiş öğeler: "profil|anahtar"
const saveCfg = () => LS.set('cfg', S.cfg);
const saveCustom = () => LS.set('custom', S.custom);
const saveMan = () => LS.set('manual', [...MAN]);
function log(m, w, r, h) { LOG.push(h ? { t: Date.now(), m, w, r, h } : { t: Date.now(), m, w, r }); if (LOG.length > 4000) LOG = LOG.slice(-4000); LS.set('log', LOG); }

let ALL = [], ITEMS = null, ITEMMAP = null;
function rebuild() {
  const seen = new Set(); ALL = [];
  BASE.concat(S.custom).forEach(w => { if (!seen.has(w.id)) { seen.add(w.id); ALL.push(w); } });
  ITEMS = null; ITEMMAP = null;
}
function allSyl() {
  const m = new Map();
  SYLLABLES.forEach(s => m.set(s[0], { syl: s[0], pat: s[1] }));
  S.custom.forEach(w => w.syl.forEach(s => { if (!m.has(s)) m.set(s, { syl: s, pat: patternOf(s) }); }));
  return [...m.values()];
}
function allItems() {
  if (!ITEMS) {
    ITEMS = []; ITEMMAP = new Map();
    PHRASES.forEach(p => ITEMS.push({ key: p.k, text: p.t, kind: 'p', group: p.g }));
    ALL.forEach(w => ITEMS.push({ key: 'w:' + w.id, text: w.word, kind: 'w', group: 'Kelimeler' }));
    allSyl().forEach(s => ITEMS.push({ key: 'y:' + s.syl, text: s.syl, kind: 'y', group: 'Heceler' }));
    ITEMS.forEach(i => ITEMMAP.set(i.key, i));
  }
  return ITEMS;
}
const itemOf = k => { allItems(); return ITEMMAP.get(k) || null; };
function genItems(scope) {
  const out = PHRASES.map(p => ({ key: p.k, text: p.t, kind: 'p' }));
  const ws = scope === 'all' ? ALL : currWords(), syl = new Set();
  ws.forEach(w => { out.push({ key: 'w:' + w.id, text: w.word, kind: 'w' }); w.syl.forEach(s => syl.add(s)); });
  if (scope === 'all') allSyl().forEach(s => syl.add(s.syl));
  syl.forEach(s => out.push({ key: 'y:' + s, text: s, kind: 'y' }));
  return out;
}

/* ---------- kayıt durumu ve fotoğraflar ---------- */
let recSet = new Set();
const activeProf = () => S.cfg.profiles.find(p => p.id === S.cfg.active) || S.cfg.profiles[0];
const profName = () => activeProf().name;
const hasKey = k => recSet.has(vkey(k, S.cfg.active));
async function refreshRec() {
  const keys = await DB.keys(), pre = 'v|' + S.cfg.active + '|';
  recSet = new Set(keys.filter(k => typeof k === 'string' && k.startsWith(pre)));
}
const photoUrls = {};
async function loadPhoto(id) {
  const r = await DB.get('img|' + id);
  if (photoUrls[id]) { URL.revokeObjectURL(photoUrls[id]); delete photoUrls[id]; }
  if (r) photoUrls[id] = URL.createObjectURL(new Blob([r.buf], { type: r.type }));
}
async function loadPhotos() { for (const k of await DB.keys()) if (typeof k === 'string' && k.startsWith('img|')) await loadPhoto(k.slice(4)); }
const hasPic = w => !!(photoUrls[w.id] || w.emoji);
const picHtml = w => photoUrls[w.id] ? `<img src="${photoUrls[w.id]}" alt="">` : (w.emoji ? `<span class="emoji" aria-hidden="true">${esc(w.emoji)}</span>` : '');

/* ---------- müfredat ---------- */
const inCurr = w => !S.cfg.hidden.includes(w.id) && S.cfg.levels.includes(w.level) && (!S.cfg.themes.length || S.cfg.themes.includes(w.theme));
const currWords = () => ALL.filter(inCurr);
const usableWords = () => currWords().filter(w => hasKey('w:' + w.id));
function currSyl() { const s = new Set(); currWords().forEach(w => w.syl.forEach(x => s.add(x))); return [...s].filter(x => hasKey('y:' + x)); }
function scoreMap(m) { const sc = {}; LOG.forEach(x => { if (x.m === m && x.w) sc[x.w] = (sc[x.w] || 0) + ((x.r === 'miss' || x.r === 'far') ? -2 : 1); }); return sc; }
function pickBy(list, m, n, idf) { const sc = scoreMap(m); return shuffle(list).sort((a, b) => (sc[idf(a)] || 0) - (sc[idf(b)] || 0)).slice(0, n); }
const praise = () => PRAISE[Math.floor(Math.random() * PRAISE.length)];
const LEVEL_TXT = { 1: 'Çok kolay: kısa, açık heceli', 2: 'Kolay', 3: 'Orta', 4: 'Zor: uzun veya kapalı hece', 5: 'En zor: çok heceli, ünsüz yığılmalı' };

/* ---------- ses çalma (tek ses öğesi: iOS/Safari uyumu) ---------- */
const AUD = new Audio();
let unlocked = false;
document.addEventListener('pointerdown', () => {
  if (unlocked) return; unlocked = true;
  try { AUD.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='; const p = AUD.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
}, { once: true, capture: true });
const urlCache = new Map();
let cur = { res: null };
async function getUrl(full) {
  if (urlCache.has(full)) return urlCache.get(full);
  const r = await DB.get(full); if (!r) return null;
  const u = URL.createObjectURL(new Blob([r.buf], { type: r.type })); urlCache.set(full, u); return u;
}
function invalidate(full) { const u = urlCache.get(full); if (u) { URL.revokeObjectURL(u); urlCache.delete(full); } }
function stopAudio() { try { AUD.pause(); } catch (e) {} if (cur.res) cur.res(false); cur = { res: null }; }
function playUrl(url) {
  return new Promise(res => {
    stopAudio(); cur = { res };
    AUD.onended = () => { cur = { res: null }; res(true); };
    AUD.onerror = () => { cur = { res: null }; res(false); };
    AUD.src = url;
    const p = AUD.play(); if (p && p.catch) p.catch(() => { cur = { res: null }; res(false); });
  });
}
/* Kaydı olmayan öğe için robot sesi KULLANILMAZ; sessiz kalır. */
async function say(k) { if (!hasKey(k)) return false; const u = await getUrl(vkey(k, S.cfg.active)); return u ? playUrl(u) : false; }

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
  const t = e.target.closest('[data-act]'); if (!t || t.disabled) return;
  const f = ACT[t.dataset.act]; if (f) f(t.dataset, t);
});
document.addEventListener('change', e => {
  const t = e.target.closest('[data-change]'); if (t && CHG[t.dataset.change]) CHG[t.dataset.change](t);
});

const dots = () => `<div class="dots" aria-hidden="true">${V.items.map((_, i) => `<i class="d ${i < V.i ? 'done' : i === V.i ? 'cur' : ''}"></i>`).join('')}</div>`;
const bar = () => `<header class="bar"><button class="btn back" data-act="back" aria-label="Geri">←</button>${dots()}</header>`;

/* ---------- öğrenci: ana ekran ve menü ---------- */
VIEWS.home = () => `<main class="center">
  <h1 class="title">Benimle Öğren</h1>
  ${S.cfg.name ? `<p class="sub">Merhaba, ${esc(S.cfg.name)}</p>` : ''}
  <button class="btn xl primary" data-act="start">Başla</button>
</main><button class="adult" data-act="adult">Yetişkin girişi</button>`;
ACT.start = () => { sessionStart = Date.now(); go('menu', { hello: true }); };

VIEWS.menu = () => {
  const uw = usableWords(), n = uw.length, np = uw.filter(hasPic).length, ns = currSyl().length;
  const tile = (m, ic, t, ok) => `<button class="tile" data-act="mod" data-m="${m}" ${ok ? '' : 'disabled'}><span class="ic" aria-hidden="true">${ic}</span>${t}</button>`;
  const st = Math.min(starsToday(), 5);
  return `<header class="bar"><button class="btn back" data-act="exit" aria-label="Çıkış">✕</button><div class="stars" aria-label="Bugünkü yıldızlar">${'★'.repeat(st)}${'☆'.repeat(Math.max(0, 3 - st))}</div></header>
  ${n === 0 ? `<div class="note">Henüz sesli kelime yok. Yetişkin girişinden ses oluşturulup üretildiğinde etkinlikler açılacak.</div>` : ''}
  <main class="menu">${tile('oku', '📖', 'Oku', n >= 1)}${tile('hece', '🔤', 'Hece', ns >= 3)}${tile('konus', '🎤', 'Konuş', n >= 1)}${tile('yaz', '✏️', 'Yaz', n >= 1)}${tile('bul', '🔍', 'Bul', np >= 3)}</main>`;
};
AFTER.menu = () => { if (V.hello) { V.hello = false; say('ui:hos'); } };
ACT.exit = () => { endSession(); go('home'); };
ACT.back = () => go('menu');
ACT.mod = async d => { const t = tok; await say('ui:' + d.m); if (t === tok) startModule(d.m); };

function startModule(m) {
  let items;
  const uw = usableWords();
  if (m === 'yaz') {
    const seen = new Set(); items = [];
    pickBy(uw, 'yaz', 14, w => w.id).forEach(w => {
      const L = trUpper(w.word.charAt(0)); if (seen.has(L)) return; seen.add(L);
      items.push({ w, letter: CASE_MODE === 'lower' ? trLower(L) : L });
    });
    items = items.slice(0, 5);
  } else if (m === 'hece') items = pickBy(currSyl(), 'hece', 6, s => s).map(s => ({ syl: s }));
  else if (m === 'bul') items = pickBy(uw.filter(hasPic), 'bul', 5, w => w.id);
  else items = pickBy(uw, m, m === 'konus' ? 4 : 5, w => w.id);
  if (!items.length || (m === 'bul' && items.length < 3) || (m === 'hece' && currSyl().length < 3)) { toast('Bu etkinlik için yeterli sesli içerik yok.'); return; }
  go(m, { items, i: 0 });
}
function advance() {
  V.i++;
  if (V.i >= V.items.length) { log('mod', null, 'done'); finishModule(); return; }
  if (overTime()) { go('end'); return; }
  V.fresh = true; if (PREP[V.name]) PREP[V.name](); render();
}
async function finishModule() { const t = tok; await say('fb:aferin'); if (t !== tok) return; go(overTime() ? 'end' : 'menu'); }
const curWord = () => { const it = V.items[V.i]; return it.w || it; };
const playWord = () => say('w:' + curWord().id);
ACT.sayWord = () => { playWord(); };
ACT.next = () => { if (V.name === 'oku') log('oku', curWord().id, 'done'); advance(); };

/* Oku */
VIEWS.oku = () => {
  const w = V.items[V.i], hasSyl = w.syl.length > 1 && w.syl.every(s => hasKey('y:' + s));
  return `${bar()}<main class="stage">
    ${hasPic(w) ? `<button class="pic" data-act="sayWord" aria-label="${esc(w.word)} dinle">${picHtml(w)}</button>` : ''}
    <h2 class="word">${esc(fmt(w.word))}</h2>
    ${hasSyl ? `<div class="sylrow" id="syl">${w.syl.map(s => `<button class="chip" data-act="saySyl" data-s="${esc(s)}">${esc(fmt(s, false))}</button>`).join('')}</div>` : ''}
    <div class="row"><button class="btn lg" data-act="sayWord">▶ Dinle</button>${hasSyl ? `<button class="btn lg" data-act="sayAllSyl">Heceler</button>` : ''}<button class="btn lg primary" data-act="next">İleri →</button></div>
  </main>`;
};
AFTER.oku = () => { if (V.fresh) { V.fresh = false; playWord(); } };
ACT.saySyl = d => { say('y:' + d.s); };
ACT.sayAllSyl = async () => {
  const w = curWord(), t = tok, chips = document.querySelectorAll('#syl .chip');
  for (let i = 0; i < w.syl.length; i++) {
    if (t !== tok) return;
    chips.forEach((c, j) => c.classList.toggle('on', j === i));
    await say('y:' + w.syl[i]);
  }
  chips.forEach(c => c.classList.remove('on'));
};

/* Hece: dinle, doğru heceyi seç */
PREP.hece = () => {
  const t = V.items[V.i].syl, pool = currSyl().filter(s => s !== t);
  V.opts = shuffle([t, ...shuffle(pool).slice(0, 2)]); V.wrong = []; V.right = null; V.missed = false;
};
VIEWS.hece = () => `${bar()}<main class="stage">
  <div class="bigsyl" aria-hidden="true">🔊</div>
  <button class="btn lg" data-act="sayHece">▶ Dinle</button>
  <div class="choices">${V.opts.map(o => `<button class="choice txt ${V.wrong.includes(o) ? 'dim' : ''} ${V.right === o ? 'ok' : ''}" data-act="pickHece" data-s="${esc(o)}">${esc(fmt(o, false))}</button>`).join('')}</div>
</main>`;
AFTER.hece = () => { if (V.fresh) { V.fresh = false; say('y:' + V.items[V.i].syl); } };
ACT.sayHece = () => { say('y:' + V.items[V.i].syl); };
ACT.pickHece = async d => {
  if (V.right) return;
  const t = V.items[V.i].syl, tk = tok;
  if (d.s === t) { V.right = d.s; log('hece', t, V.missed ? 'miss' : 'ok'); render(); await say(praise()); if (tk === tok) advance(); }
  else { V.missed = true; V.wrong.push(d.s); render(); await say('fb:bir-daha'); if (tk === tok) say('y:' + t); }
};

/* Konuş */
PREP.konus = () => { if (V.child) URL.revokeObjectURL(V.child); V.child = null; V.rec = false; V.busy = false; };
VIEWS.konus = () => {
  const w = V.items[V.i];
  let ctl;
  if (V.busy) ctl = `<p class="sub">Bir saniye…</p>`;
  else if (V.child) ctl = `<div class="row"><button class="btn lg" data-act="sayWord">▶ ${esc(profName())}</button><button class="btn lg" data-act="playChild">▶ Ben</button></div>
    <div class="row"><button class="btn lg" data-act="retry">↻ Tekrar</button><button class="btn lg primary" data-act="next">İleri →</button></div>`;
  else ctl = `<div class="row"><button class="btn lg" data-act="sayWord">▶ ${esc(profName())}</button>
    <button class="btn lg mic ${V.rec ? 'rec' : 'primary'}" data-act="micToggle">${V.rec ? '■ Bitir' : '🎤 Söyle'}</button></div>${V.rec ? '<p class="sub">Dinliyorum…</p>' : ''}`;
  return `${bar()}<main class="stage">${hasPic(w) ? `<div class="pic">${picHtml(w)}</div>` : ''}<h2 class="word">${esc(fmt(w.word))}</h2>${ctl}</main>`;
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
  try { wav = await clipFromBlob(await recStop()); } catch (e) { if (t === tok) { toast(e.message || 'Kayıt alınamadı.'); render(); } return; }
  if (t !== tok) return;
  await DB.put('c|' + w.id, { buf: wav, type: 'audio/wav' }); invalidate('c|' + w.id);
  V.child = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
  let cls = null, heard = '';
  if (S.cfg.asr && Bridge.ready()) {
    V.busy = true; render();
    try { const r = await asrCheck(new Blob([wav], { type: 'audio/wav' }), { text: w.word, kind: 'w' }); cls = r.cls; heard = r.text; } catch (e) { /* tanıma yoksa sessizce devam */ }
    if (t !== tok) return;
    V.busy = false;
  }
  log('konus', w.id, cls || 'done', heard);
  render();
  /* Çocuğa puan veya hata gösterilmez; yalnızca yumuşak sesli geri bildirim. */
  if (cls === 'near') await say('fb:yaklastin');
  else if (cls === 'far') { await say('fb:bir-daha'); }
  else await say(praise());
}
ACT.playChild = () => { if (V.child) playUrl(V.child); };
ACT.retry = () => { PREP.konus(); render(); };

/* Bul */
PREP.bul = () => {
  const t = V.items[V.i], others = shuffle(usableWords().filter(w => hasPic(w) && w.id !== t.id)).slice(0, 2);
  V.opts = shuffle([t, ...others]); V.wrong = []; V.right = null; V.missed = false;
};
VIEWS.bul = () => `${bar()}<main class="stage">
  <h2 class="word" style="font-size:2rem">Hangisi?</h2>
  <button class="btn lg" data-act="sayWord">▶ Dinle</button>
  <div class="choices">${V.opts.map(o => `<button class="choice ${V.wrong.includes(o.id) ? 'dim' : ''} ${V.right === o.id ? 'ok' : ''}" data-act="pick" data-id="${esc(o.id)}" aria-label="seçenek">${picHtml(o)}</button>`).join('')}</div>
</main>`;
AFTER.bul = async () => { if (V.fresh) { V.fresh = false; const t = tok; await say('ui:hangisi'); if (t === tok) playWord(); } };
ACT.pick = async d => {
  if (V.right) return;
  const t = V.items[V.i], tk = tok;
  if (d.id === t.id) { V.right = d.id; log('bul', t.id, V.missed ? 'miss' : 'ok'); render(); await say(praise()); if (tk === tok) advance(); }
  else { V.missed = true; V.wrong.push(d.id); render(); await say('fb:bir-daha'); if (tk === tok) playWord(); }
};

/* Yaz */
PREP.yaz = () => { V.ok = false; };
VIEWS.yaz = () => {
  const it = V.items[V.i];
  return `${bar()}<main class="stage">
    <div class="row" style="align-items:center">${hasPic(it.w) ? `<div class="pic" style="width:96px;border-radius:18px">${picHtml(it.w)}</div>` : ''}<h2 class="word">${esc(fmt(it.w.word))}</h2></div>
    <div class="canvaswrap"><canvas id="cvg" width="360" height="360"></canvas><canvas id="cvd" width="360" height="360" aria-label="Çizim alanı"></canvas></div>
    <div class="okmsg" id="okmsg"></div>
    <div class="row" id="yazbtns"><button class="btn lg" data-act="yazClear">↻ Sil</button><button class="btn lg quiet" data-act="next">Atla</button></div>
  </main>`;
};
AFTER.yaz = () => {
  const it = V.items[V.i], g = el('cvg'), gc = g.getContext('2d'), d = el('cvd'), dc = d.getContext('2d');
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
    el('okmsg').textContent = '✔';
    el('yazbtns').innerHTML = '<button class="btn lg primary" data-act="next">İleri →</button>';
    say(praise());
  }
}
ACT.yazClear = () => { el('cvd').getContext('2d').clearRect(0, 0, 360, 360); };

/* Bitiş */
VIEWS.end = () => `<main class="center"><h1 class="title">Bugünlük bu kadar</h1><div class="stars" style="font-size:3rem">${'★'.repeat(Math.min(starsToday(), 5))}</div><button class="btn xl primary" data-act="endOk">Tamam</button></main>`;
AFTER.end = () => { say('ui:bitti'); };
ACT.endOk = () => { endSession(); go('home'); };

/* ---------- PIN ---------- */
async function hashPin(p) {
  try { if (window.crypto && crypto.subtle) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('bo:' + p)); return Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, '0')).join(''); } } catch (e) {}
  return 'p:' + p;
}
const toPanel = () => go('panel', { tab: 'ses', recKey: null, q: '', consent: false });
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
      if ((await hashPin(V.buf)) === S.cfg.pin) return toPanel();
      V.err = 'Hatalı PIN'; V.buf = '';
    } else if (V.mode === 'set1') { V.first = V.buf; V.mode = 'set2'; V.buf = ''; }
    else {
      if (V.buf === V.first) { S.cfg.pin = await hashPin(V.buf); saveCfg(); return toPanel(); }
      V.err = 'PIN\'ler aynı değil. Baştan başlayın.'; V.mode = 'set1'; V.buf = '';
    }
  }
  render();
};

/* ---------- panel ---------- */
const TABS = [['ses', '🎙️ Ses'], ['mufredat', '📚 Müfredat'], ['ilerleme', '📈 İlerleme'], ['ayar', '⚙️ Ayarlar']];
const PANEL = {};
VIEWS.panel = () => `<div class="panel">
  <div class="phead"><h2>Yetişkin paneli</h2><button class="btn" data-act="exit">Kapat</button></div>
  <nav class="tabs">${TABS.map(([k, t]) => `<button class="tab ${V.tab === k ? 'on' : ''}" data-act="tab" data-t="${k}">${t}</button>`).join('')}</nav>
  ${PANEL[V.tab]()}</div>`;
AFTER.panel = () => { updGen(); updQc(); };
ACT.tab = d => { if (REC) return toast('Önce kaydı bitirin.'); V.tab = d.t; render(); };
const voiceCfg = () => ({ model: S.cfg.model, speed: S.cfg.speed, stability: S.cfg.stability, similarity: S.cfg.similarity });
const SAMPLES = [];

/* --- Ses sekmesi --- */
function itemRow(i) {
  const has = hasKey(i.key), prof = activeProf(), flag = QC.map[prof.id + '|' + i.key] === 'flag', man = MAN.has(prof.id + '|' + i.key);
  const recing = V.recKey === i.key, busy = V.busyKey === i.key, canGen = !!(prof.voiceId && Bridge.ready());
  return `<div class="rrow"><div class="rt">${esc(i.text)} <small>${i.kind === 'y' ? 'hece' : i.kind === 'w' ? 'kelime' : ''}</small></div>
    <span class="st ${has ? (man ? 'ok' : 'ai') : ''}">${has ? (man ? 'Elle kayıt' : 'YZ sesi') : 'Yok'}</span>${flag ? '<span class="st flag">Kontrol et</span>' : ''}
    <button class="icon" data-act="recPlay" data-key="${esc(i.key)}" ${has ? '' : 'disabled'} aria-label="Dinle">▶</button>
    <button class="icon" data-act="regen" data-key="${esc(i.key)}" ${canGen && !busy ? '' : 'disabled'} aria-label="Yeniden üret">${busy ? '…' : '↻'}</button>
    <button class="icon ${recing ? 'recording' : ''}" data-act="recToggle" data-key="${esc(i.key)}" aria-label="${recing ? 'Bitir' : 'Kendim kaydedeyim'}">${recing ? '■' : '●'}</button></div>`;
}
function sampleBox(i) {
  const s = SAMPLES[i], recing = V.recKey === 'sample' + i;
  const warns = s ? s.w.map(x => `<div class="warn">${esc(x)}</div>`).join('') : '';
  return `<div class="box"><h3>Parça ${i + 1} / ${PASSAGE.length}</h3><p class="passage">${esc(PASSAGE[i])}</p>
    <div class="inline" style="margin-top:10px"><button class="btn ${recing ? 'primary mic rec' : ''}" data-act="recToggle" data-key="sample${i}">${recing ? '■ Bitir' : (s ? '↻ Yeniden kaydet' : '● Okumaya başla')}</button>
    <button class="btn" data-act="samplePlay" data-i="${i}" ${s ? '' : 'disabled'}>▶ Dinle</button>
    ${s ? `<span class="st ok">${Math.round(s.st.dur)} sn kaydedildi</span>` : '<span class="st">Henüz yok</span>'}</div>${warns}</div>`;
}
PANEL.ses = () => {
  const prof = activeProf(), vid = prof.voiceId, items = allItems(), br = Bridge.cfg(), ready = Bridge.ready();
  const cnt = (k) => items.filter(i => i.kind === k && hasKey(i.key)).length, tot = k => items.filter(i => i.kind === k).length;
  const missingChars = genItems('all').filter(i => !hasKey(i.key)).reduce((a, i) => a + i.text.length, 0);
  const flagged = Object.keys(QC.map).filter(k => QC.map[k] === 'flag' && k.startsWith(prof.id + '|')).map(k => itemOf(k.slice(prof.id.length + 1))).filter(Boolean);
  const matches = V.q ? items.filter(i => normTR(i.text).includes(normTR(V.q))).slice(0, 30) : [];
  const allSamples = PASSAGE.every((_, i) => SAMPLES[i]);
  const canClone = ready && allSamples && V.consent && !V.busyClone;
  const profs = `<select data-change="profile" aria-label="Ses profili">${S.cfg.profiles.map(p => `<option value="${esc(p.id)}" ${p.id === S.cfg.active ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>`;

  const bridgeBox = `<div class="box"><h3>1) Ses servisi bağlantısı</h3>
    <p>Sesi yapay zeka üretir; API anahtarınız tarayıcıya girmez, sizin kurduğunuz küçük bir köprüde (Cloudflare Worker) durur. Kurulum için README.md dosyasına bakın.</p>
    <div class="inline"><input class="wide" type="url" id="b-url" placeholder="Köprü adresi (https://....workers.dev)" value="${esc(br.url)}" aria-label="Köprü adresi">
    <input class="wide" type="password" id="b-tok" placeholder="Köprü parolası" value="${esc(br.token)}" aria-label="Köprü parolası" autocomplete="off">
    <button class="btn primary" data-act="bridgeSave">Kaydet ve dene</button></div>
    ${V.bstat ? `<div class="${V.bok ? 'good' : 'warn'}">${esc(V.bstat)}</div>` : ''}</div>`;

  const cloneBox = (vid && !V.reclone) ? `<div class="box"><h3>2) ${esc(prof.name)} sesi</h3><div class="good">✔ Ses oluşturuldu. Artık tüm kelime ve heceler bu sesle üretilebilir.</div>
      <div class="inline"><button class="btn" data-act="recloneOpen">Sesi yeniden oluştur</button><button class="btn" data-act="voiceDel" ${ready ? '' : 'disabled'}>Sesi servisten sil</button></div>
      <p>Servisten silmek, yapay zeka ses modelini siler. Cihazdaki üretilmiş kayıtlar kalır.</p></div>`
    : `<div class="box"><h3>2) Okuma parçasını okuyun (${esc(prof.name)})</h3>
      <p>Aşağıdaki iki parçayı sakin, net ve normal hızınızla, sessiz bir odada okuyun. Mikrofonu hep aynı mesafede tutun. Yaklaşık 1,5-2 dakika yeterlidir. Bu kayıttan sesinizin yapay zeka modeli oluşturulur; ayrıca hiçbir kelime veya hece kaydetmeniz gerekmez.</p></div>
      ${PASSAGE.map((_, i) => sampleBox(i)).join('')}
      <div class="box"><h3>3) Onay ve oluşturma</h3>
      <label class="consent"><input type="checkbox" data-change="consent" ${V.consent ? 'checked' : ''}><span>Bu ses kaydı bana (veya yasal velisi olduğum kişiye) aittir. Sesimin yapay zeka ile çoğaltılması için kaydın yurt dışındaki ses üretim servisine (ElevenLabs, ABD) gönderilmesine açıkça onay veriyorum. Sesi dilediğim zaman silebileceğimi biliyorum.</span></label>
      <div class="inline" style="margin-top:12px"><button class="btn primary lg" data-act="cloneGo" ${canClone ? '' : 'disabled'}>${V.busyClone ? 'Oluşturuluyor…' : 'Sesimi oluştur'}</button>${vid ? `<button class="btn" data-act="recloneClose">Vazgeç</button>` : ''}</div>
      ${!ready ? '<div class="warn">Önce 1. adımdaki bağlantıyı kurun.</div>' : ''}</div>`;

  const g = GEN.running;
  const genBox = `<div class="box"><h3>4) Tüm kelime ve heceleri üret</h3>
    <div class="kv"><div>Kelime<b>${cnt('w')} / ${tot('w')}</b></div><div>Hece<b>${cnt('y')} / ${tot('y')}</b></div><div>Cümle<b>${cnt('p')} / ${tot('p')}</b></div><div>Eksik metin<b>${missingChars.toLocaleString('tr')} karakter</b></div></div>
    <p>Üretim durdurulabilir, kaldığı yerden devam eder. Yarım kalan veya hata alan öğeler bir sonraki çalıştırmada yeniden denenir. Her şey cihaza kaydedilir; sonrasında internet gerekmez.</p>
    <div class="inline"><button class="btn primary" data-act="genStart" data-scope="curr" ${vid && ready && !g ? '' : 'disabled'}>Seçili müfredatı üret</button>
    <button class="btn" data-act="genStart" data-scope="all" ${vid && ready && !g ? '' : 'disabled'}>Hepsini üret (${ALL.length} kelime + ${allSyl().length} hece)</button>
    ${g ? '<button class="btn" data-act="genStop">Durdur</button>' : ''}</div>
    ${(g || GEN.total) ? `<div class="progress"><i id="gen-bar"></i></div><p id="gen-txt"></p>` : ''}
    ${GEN.err ? `<div class="warn">${esc(GEN.err)}</div>` : ''}${(!g && GEN.fail) ? `<div class="warn">${GEN.fail} öğe üretilemedi. Tekrar çalıştırınca yeniden denenir.</div>` : ''}
    ${!vid ? '<div class="warn">Önce 2. ve 3. adımla sesi oluşturun.</div>' : ''}</div>`;

  const q = QCS.running;
  const qcBox = `<div class="box"><h3>5) Yapay zeka ile kalite kontrol</h3>
    <p>Üretilen her klibi bir konuşma tanıma servisi dinler. Söylenen, yazılanla uyuşmuyorsa farklı ayarlarla yeniden üretilir; yine olmazsa "Kontrol et" işaretlenir. Özellikle tek başına hecelerde bu önemlidir. İşaretli olanları dinleyip yeniden üretebilir ya da kendi sesinizle kaydedebilirsiniz.</p>
    <div class="inline"><button class="btn primary" data-act="qcStart" ${vid && ready && !q && !g ? '' : 'disabled'}>Kontrolü başlat</button>${q ? '<button class="btn" data-act="qcStop">Durdur</button>' : ''}</div>
    ${(q || QCS.total) ? `<div class="progress"><i id="qc-bar"></i></div><p id="qc-txt"></p>` : ''}${QCS.err ? `<div class="warn">${esc(QCS.err)}</div>` : ''}
    ${flagged.length ? `<h3 style="margin-top:12px">Kontrol edilmesi gerekenler (${flagged.length})</h3>${flagged.slice(0, 60).map(itemRow).join('')}` : ''}</div>`;

  const findBox = `<div class="box"><h3>6) Tek tek dinle, düzelt</h3>
    <div class="inline"><input class="wide" type="text" id="q" placeholder="Kelime veya hece ara (örn. ekmek, ba)" value="${esc(V.q || '')}" data-change="q" aria-label="Ara"></div>
    ${V.q ? (matches.length ? matches.map(itemRow).join('') : '<p>Eşleşme yok.</p>') : '<p>Aramak için yazıp Enter\'a basın. ↻ yapay zekayla yeniden üretir, ● kendi sesinizle kaydettirir.</p>'}</div>`;

  return `<div class="box"><h3>Ses profili</h3><div class="inline">${profs}<button class="btn" data-act="addProfile">+ Yeni ses</button><button class="btn" data-act="delProfile" ${S.cfg.profiles.length < 2 ? 'disabled' : ''}>Bu profili sil</button></div>
    <p>Öğrenci, seçili profilin sesini duyar (Anne, Baba, Terapist…). Kaydı olmayan öğe öğrenciye gösterilmez; robot sesi kullanılmaz.</p></div>
    ${bridgeBox}${cloneBox}${genBox}${qcBox}${findBox}`;
};
function updGen() {
  const b = el('gen-bar'); if (!b) return;
  const pct = GEN.total ? Math.round(100 * (GEN.done + GEN.fail) / GEN.total) : 0;
  b.style.width = pct + '%';
  el('gen-txt').textContent = `${GEN.done + GEN.fail} / ${GEN.total}` + (GEN.running ? ` · üretiliyor: ${GEN.cur}` : ' · bitti') + (GEN.fail ? ` · ${GEN.fail} başarısız` : '');
}
function updQc() {
  const b = el('qc-bar'); if (!b) return;
  const pct = QCS.total ? Math.round(100 * QCS.done / QCS.total) : 0;
  b.style.width = pct + '%';
  el('qc-txt').textContent = `${QCS.done} / ${QCS.total}` + (QCS.running ? ` · dinleniyor: ${QCS.cur}` : ' · bitti') + ` · ${QCS.fixed} düzeltildi · ${QCS.flag} işaretlendi`;
}
const onStored = prof => k => { recSet.add(vkey(k, prof)); invalidate(vkey(k, prof)); };

ACT.bridgeSave = async () => {
  LS.set('bridge', { url: el('b-url').value, token: el('b-tok').value });
  try {
    const r = await Bridge.ping(); V.bok = true;
    V.bstat = '✔ Bağlandı' + (r.sub ? ` · plan: ${r.sub.tier || '-'} · kalan karakter: ${Math.max(0, (r.sub.limit || 0) - (r.sub.used || 0)).toLocaleString('tr')}` : '');
  } catch (e) { V.bok = false; V.bstat = e.message; }
  render();
};
ACT.recloneOpen = () => { V.reclone = true; render(); };
ACT.recloneClose = () => { V.reclone = false; render(); };
CHG.consent = t => { V.consent = t.checked; render(); };
ACT.samplePlay = d => { const s = SAMPLES[+d.i]; if (s) playUrl(URL.createObjectURL(new Blob([s.buf], { type: 'audio/wav' }))); };
ACT.cloneGo = async () => {
  if (!PASSAGE.every((_, i) => SAMPLES[i]) || !V.consent) return;
  V.busyClone = true; render();
  try {
    const id = await Bridge.clone(profName(), PASSAGE.map((_, i) => SAMPLES[i].buf));
    activeProf().voiceId = id; saveCfg(); SAMPLES.length = 0; V.reclone = false; V.consent = false; toast('Ses oluşturuldu. Şimdi 4. adımdan üretebilirsiniz.');
  } catch (e) { toast(e.message || 'Ses oluşturulamadı.'); }
  V.busyClone = false; render();
};
ACT.voiceDel = async () => {
  if (!confirm('Yapay zeka ses modeli servisten silinsin mi? Üretilmiş kayıtlar cihazda kalır.')) return;
  try { await Bridge.del(activeProf().voiceId); activeProf().voiceId = ''; saveCfg(); toast('Ses servisten silindi.'); } catch (e) { toast(e.message || 'Silinemedi.'); }
  render();
};
ACT.genStart = d => {
  const prof = activeProf(); if (GEN.running) return;
  if (!prof.voiceId || !Bridge.ready()) return toast('Önce ses servisini bağlayıp sesi oluşturun.');
  const items = genItems(d.scope), todo = items.filter(i => !hasKey(i.key));
  if (!todo.length) return toast('Bu kapsamdaki her şey zaten üretilmiş.');
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  genRun({ profId: prof.id, voiceId: prof.voiceId, items, cfg: voiceCfg(), onStored: onStored(prof.id),
    onProgress: fin => { if (fin === true) { if (V.name === 'panel') render(); if (!GEN.err) toast(GEN.fail ? 'Üretim bitti; bazıları başarısız.' : 'Üretim tamamlandı.'); } else updGen(); } });
  render();
};
ACT.genStop = () => { GEN.stop = true; toast('Durduruluyor…'); };
ACT.qcStart = () => {
  const prof = activeProf(); if (QCS.running || GEN.running) return;
  qcRun({ profId: prof.id, voiceId: prof.voiceId, items: genItems('all'), cfg: voiceCfg(), onStored: onStored(prof.id),
    onProgress: fin => { if (fin === true) { if (V.name === 'panel') render(); toast(QCS.err ? QCS.err : 'Kalite kontrol bitti.'); } else updQc(); } });
  render();
};
ACT.qcStop = () => { QCS.stop = true; };
ACT.recPlay = d => say(d.key);
ACT.regen = async d => {
  const prof = activeProf(), it = itemOf(d.key); if (!it) return;
  V.busyKey = d.key; render();
  try {
    const ok = await fixOne({ profId: prof.id, voiceId: prof.voiceId, it, cfg: voiceCfg(), onStored: onStored(prof.id) });
    MAN.delete(prof.id + '|' + d.key); saveMan();
    toast(ok ? 'Yeniden üretildi.' : 'Üretildi, ama tanıma tutmadı. Dinleyin; gerekirse kendiniz kaydedin.');
  } catch (e) { toast(e.message || 'Üretilemedi.'); }
  V.busyKey = null; render(); say(d.key);
};
CHG.q = t => { V.q = t.value.trim(); render(); };
ACT.recToggle = async d => {
  const key = d.key;
  if (V.recKey && V.recKey !== key) return toast('Önce devam eden kaydı bitirin.');
  if (V.recKey === key) {
    V.recKey = null; render();
    try {
      const blob = await recStop(), prof = activeProf();
      if (key.startsWith('sample')) {
        const i = +key.slice(6), r = await sampleFromBlob(blob), w = sampleWarnings(r.st);
        if (r.st.dur < 25) w.push(`Kayıt kısa görünüyor (${Math.round(r.st.dur)} sn). Parçanın tamamını okuduğunuzdan emin olun.`);
        SAMPLES[i] = { buf: r.buf, st: r.st, w }; render();
      } else {
        const wav = await clipFromBlob(blob);
        await DB.put(vkey(key, prof.id), { buf: wav, type: 'audio/wav', src: 'manual' }); invalidate(vkey(key, prof.id)); recSet.add(vkey(key, prof.id));
        MAN.add(prof.id + '|' + key); saveMan(); delete QC.map[prof.id + '|' + key]; QC.save();
        toast('Kaydedildi'); render(); say(key);
      }
    } catch (e) { toast(e.message || 'Kayıt başarısız.'); render(); }
  } else {
    try { await recStart(); V.recKey = key; render(); } catch (e) { toast(micErr(e)); }
  }
};
CHG.profile = async t => { S.cfg.active = t.value; saveCfg(); await refreshRec(); render(); };
ACT.addProfile = () => {
  const n = (prompt('Ses adı (örn. Baba, Terapist):') || '').trim(); if (!n) return;
  S.cfg.profiles.push({ id: 'p' + Date.now().toString(36), name: n, voiceId: '' }); S.cfg.active = S.cfg.profiles[S.cfg.profiles.length - 1].id;
  saveCfg(); SAMPLES.length = 0; refreshRec().then(render);
};
ACT.delProfile = async () => {
  if (!confirm(profName() + ' profilinin tüm kayıtları silinsin mi?')) return;
  const p = activeProf(), keys = await DB.keys();
  if (p.voiceId && Bridge.ready()) { try { await Bridge.del(p.voiceId); } catch (e) { toast('Servisteki ses silinemedi; elle silmeniz gerekebilir.'); } }
  for (const k of keys) if (typeof k === 'string' && k.startsWith('v|' + p.id + '|')) { invalidate(k); await DB.del(k); }
  S.cfg.profiles = S.cfg.profiles.filter(x => x.id !== p.id); S.cfg.active = S.cfg.profiles[0].id; saveCfg(); await refreshRec(); render();
};

/* --- Müfredat sekmesi --- */
PANEL.mufredat = () => {
  const cw = currWords(), uw = usableWords(), cs = currSyl();
  const sylTot = new Set(); cw.forEach(w => w.syl.forEach(s => sylTot.add(s)));
  const wq = V.wq ? ALL.filter(w => normTR(w.word).includes(normTR(V.wq))).slice(0, 25) : [];
  return `<div class="box"><h3>Çalışılacak içerik</h3>
    <div class="kv"><div>Seçili kelime<b>${cw.length}</b></div><div>Sesi hazır<b>${uw.length}</b></div><div>Seçili hece<b>${sylTot.size}</b></div><div>Sesi hazır hece<b>${cs.length}</b></div></div>
    <p><b>Seviye</b> (kelimenin hece sayısı, kapalı hece ve ünsüz yığılmasına göre otomatik):</p>
    <div class="chips">${[1, 2, 3, 4, 5].map(l => `<button class="pill ${S.cfg.levels.includes(l) ? 'on' : ''}" data-act="lvl" data-l="${l}" title="${esc(LEVEL_TXT[l])}">${l} · ${ALL.filter(w => w.level === l).length}</button>`).join('')}</div>
    <p>${S.cfg.levels.map(l => l + ': ' + LEVEL_TXT[l]).join(' · ')}</p>
    <p><b>Tema</b> (hiçbiri seçili değilse hepsi):</p>
    <div class="chips">${THEMES.map((t, i) => `<button class="pill ${S.cfg.themes.includes(i) ? 'on' : ''}" data-act="theme" data-t="${i}">${esc(t)}</button>`).join('')}</div>
    ${S.cfg.themes.length ? `<div style="margin-top:10px"><button class="btn sm" data-act="themeClear">Tema seçimini temizle</button></div>` : ''}</div>
  <div class="box"><h3>Kelime ara, fotoğraf ekle, çalışma dışı bırak</h3>
    <p>Gerçek fotoğraf, emojiden daha iyi tanınır. Fotoğraflı kelimeler "Bul" etkinliğinde kullanılır.</p>
    <div class="inline"><input class="wide" type="text" id="wq" placeholder="Kelime ara" value="${esc(V.wq || '')}" data-change="wq" aria-label="Kelime ara"></div>
    ${wq.map(w => `<div class="rrow"><div class="thumb">${picHtml(w) || '—'}</div><div class="rt">${esc(w.word)} <small>${esc(w.syl.join('-'))} · seviye ${w.level} · ${esc(THEMES[w.theme] || '')}</small></div>
      <label class="btn sm">📷<input type="file" accept="image/*" data-change="photo" data-id="${esc(w.id)}" hidden></label>
      <button class="btn sm" data-act="hide" data-id="${esc(w.id)}">${S.cfg.hidden.includes(w.id) ? 'Geri al' : 'Çıkar'}</button>
      ${w.base ? '' : `<button class="icon" data-act="wordDel" data-id="${esc(w.id)}" aria-label="Sil">🗑</button>`}</div>`).join('')}</div>
  <div class="box"><h3>Yeni kelime ekle</h3>
    <p>Heceleri boş bırakırsanız otomatik hecelenir. Ekledikten sonra Ses sekmesinden üretin.</p>
    <div class="inline"><input type="text" id="nw" placeholder="Kelime" aria-label="Kelime"><input type="text" id="ns" placeholder="Heceler (ör. mar-ket)" aria-label="Heceler"><input type="text" id="ne" placeholder="Emoji" style="width:100px" aria-label="Emoji">
    <select id="nt" aria-label="Tema">${THEMES.map((t, i) => `<option value="${i}">${esc(t)}</option>`).join('')}</select><button class="btn primary" data-act="wordAdd">Ekle</button></div></div>`;
};
ACT.lvl = d => { const l = +d.l, a = S.cfg.levels; if (a.includes(l)) { if (a.length > 1) S.cfg.levels = a.filter(x => x !== l); } else S.cfg.levels = a.concat(l).sort(); saveCfg(); render(); };
ACT.theme = d => { const t = +d.t, a = S.cfg.themes; S.cfg.themes = a.includes(t) ? a.filter(x => x !== t) : a.concat(t); saveCfg(); render(); };
ACT.themeClear = () => { S.cfg.themes = []; saveCfg(); render(); };
ACT.hide = d => { const a = S.cfg.hidden; S.cfg.hidden = a.includes(d.id) ? a.filter(x => x !== d.id) : a.concat(d.id); saveCfg(); render(); };
CHG.wq = t => { V.wq = t.value.trim(); render(); };
ACT.wordAdd = () => {
  const word = trLower(el('nw').value.trim()); if (!word || /[^a-zçğıöşü]/.test(word)) return toast('Kelime yalnızca Türkçe harf içermeli.');
  if (ALL.some(w => w.id === word)) return toast('Bu kelime zaten var.');
  const raw = trLower(el('ns').value.trim()), syl = raw ? raw.split('-').map(s => s.trim()).filter(Boolean) : syllabify(word);
  if (syl.join('') !== word) return toast('Heceler kelimeyle birebir uyuşmuyor.');
  S.custom.push({ id: word, word, syl, theme: +el('nt').value, level: levelOf(scoreOf(word, syl)), emoji: el('ne').value.trim(), base: false });
  saveCustom(); rebuild(); toast('Eklendi. Sesini Ses sekmesinden üretin.'); render();
};
ACT.wordDel = async d => {
  if (!confirm(d.id + ' silinsin mi?')) return;
  const keys = await DB.keys();
  for (const k of keys) if (typeof k === 'string' && (k === 'img|' + d.id || k === 'c|' + d.id || (k.startsWith('v|') && k.endsWith('|w:' + d.id)))) { invalidate(k); await DB.del(k); }
  if (photoUrls[d.id]) { URL.revokeObjectURL(photoUrls[d.id]); delete photoUrls[d.id]; }
  S.custom = S.custom.filter(w => w.id !== d.id); saveCustom(); rebuild(); await refreshRec(); render();
};
CHG.photo = async t => {
  const f = t.files[0]; if (!f) return;
  try {
    const bmp = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(f); });
    const sc = Math.min(1, 600 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
    c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    URL.revokeObjectURL(bmp.src);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
    await DB.put('img|' + t.dataset.id, { buf: await blob.arrayBuffer(), type: 'image/jpeg' });
    await loadPhoto(t.dataset.id); render();
  } catch (e) { toast('Fotoğraf eklenemedi.'); }
};

/* --- İlerleme sekmesi --- */
PANEL.ilerleme = () => {
  const day = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toDateString(); };
  const mins = n => Math.round(LOG.filter(x => x.m === 'session' && new Date(x.t).toDateString() === day(n)).reduce((a, x) => a + x.r, 0) / 60);
  const week = LOG.filter(x => Date.now() - x.t < 7 * 864e5);
  const c = m => week.filter(x => x.m === m).length;
  const byW = {};
  LOG.forEach(x => { if (x.w && ['oku', 'konus', 'bul', 'yaz'].includes(x.m)) { const o = byW[x.w] || (byW[x.w] = { t: 0, oku: 0, konus: 0, bulok: 0, bultop: 0, yaz: 0, heard: '', cls: '' }); o.t = x.t;
    if (x.m === 'oku') o.oku++; if (x.m === 'konus') { o.konus++; if (x.h) { o.heard = x.h; o.cls = x.r; } } if (x.m === 'yaz') o.yaz++; if (x.m === 'bul') { o.bultop++; if (x.r === 'ok') o.bulok++; } } });
  const rows = Object.keys(byW).sort((a, b) => byW[b].t - byW[a].t).slice(0, 40).map(id => { const o = byW[id];
    return `<tr><td>${esc(id)}</td><td>${o.oku}</td><td>${o.konus}</td><td>${o.bultop ? o.bulok + '/' + o.bultop : '-'}</td><td>${o.yaz}</td>
    <td>${o.heard ? esc(o.heard) + ' <small>(' + (o.cls === 'match' ? 'uyuştu' : o.cls === 'near' ? 'yakın' : 'uzak') + ')</small>' : '-'}</td>
    <td><button class="icon" data-act="playChildRec" data-id="${esc(id)}" aria-label="Öğrencinin kaydı">▶</button></td></tr>`; }).join('');
  const hm = {}; LOG.forEach(x => { if (x.m === 'hece' && x.w) { const o = hm[x.w] || (hm[x.w] = [0, 0]); o[1]++; if (x.r === 'ok') o[0]++; } });
  const hard = Object.keys(hm).filter(s => hm[s][1] - hm[s][0] > 0).sort((a, b) => (hm[b][1] - hm[b][0]) - (hm[a][1] - hm[a][0])).slice(0, 12);
  return `<div class="box"><h3>Bu hafta</h3><div class="kv"><div>Bugün<b>${mins(0)} dk</b></div><div>Son 7 gün<b>${[0, 1, 2, 3, 4, 5, 6].reduce((a, n) => a + mins(n), 0)} dk</b></div>
    <div>Oku<b>${c('oku')}</b></div><div>Konuş<b>${c('konus')}</b></div><div>Hece<b>${c('hece')}</b></div><div>Bul<b>${c('bul')}</b></div><div>Yaz<b>${c('yaz')}</b></div></div></div>
  <div class="box"><h3>Son çalışılan kelimeler</h3>${rows ? `<table><tr><th>Kelime</th><th>Oku</th><th>Konuş</th><th>Bul</th><th>Yaz</th><th>Yapay zeka ne duydu</th><th>Kayıt</th></tr>${rows}</table>` : '<p>Henüz kayıt yok.</p>'}
  <p>▶ öğrencinin o kelimeyi söylediği son kaydı çalar. "Ne duydu" sütunu yalnızca yumuşak bir ipucudur; Down sendromlu bireylerin konuşmasında tanıma hataları çok olur. Konuşma anlaşılırlığını değerlendirmek dil ve konuşma terapistinin işidir, öğrenciye puan veya hata gösterilmez.</p></div>
  ${hard.length ? `<div class="box"><h3>Hece seçiminde zorlanılanlar</h3><div class="chips">${hard.map(s => `<span class="pill">${esc(s)} · ${hm[s][0]}/${hm[s][1]}</span>`).join('')}</div></div>` : ''}`;
};
ACT.playChildRec = async d => { const u = await getUrl('c|' + d.id); if (u) playUrl(u); else toast('Bu kelime için kayıt yok.'); };

/* --- Ayarlar sekmesi --- */
PANEL.ayar = () => `<div class="box"><h3>Öğrenci</h3><div class="inline"><input type="text" value="${esc(S.cfg.name)}" placeholder="Öğrencinin adı" data-change="name" aria-label="Ad">
  <label>Oturum <select data-change="min">${[10, 15, 20, 30].map(m => `<option ${m === S.cfg.min ? 'selected' : ''}>${m}</option>`).join('')}</select> dk</label>
  <label>Yazı <select data-change="case"><option value="lower" ${S.cfg.casemode === 'lower' ? 'selected' : ''}>küçük harf</option><option value="title" ${S.cfg.casemode === 'title' ? 'selected' : ''}>İlk harf büyük</option><option value="upper" ${S.cfg.casemode === 'upper' ? 'selected' : ''}>BÜYÜK HARF</option></select></label></div>
  <p>Renk:</p><div class="inline">${['#1f6f68', '#2b5fa8', '#7a4a8c', '#b0641a'].map(c => `<button class="swatch ${S.cfg.accent === c ? 'on' : ''}" style="background:${c}" data-act="accent" data-c="${c}" aria-label="Renk"></button>`).join('')}</div></div>
  <div class="box"><h3>Ses üretimi</h3><div class="inline">
  <label>Konuşma hızı <select data-change="speed">${[0.75, 0.85, 0.95, 1].map(v => `<option value="${v}" ${v === S.cfg.speed ? 'selected' : ''}>${v === 1 ? 'normal' : 'x' + v}</option>`).join('')}</select></label>
  <label>Model <select data-change="model"><option value="eleven_multilingual_v2" ${S.cfg.model === 'eleven_multilingual_v2' ? 'selected' : ''}>Çok dilli v2 (kaliteli)</option><option value="eleven_flash_v2_5" ${S.cfg.model === 'eleven_flash_v2_5' ? 'selected' : ''}>Flash v2.5 (hızlı)</option></select></label></div>
  <p>Değişiklik yalnızca bundan sonra üretilen kliplere uygulanır. Hepsini yeniden üretmek için Ses sekmesinde ilgili öğeleri ↻ ile yenileyin.</p></div>
  <div class="box"><h3>Çocuğun konuşmasını yapay zeka dinlesin</h3>
  <label class="consent"><input type="checkbox" data-change="asr" ${S.cfg.asr ? 'checked' : ''}><span>Konuş etkinliğinde öğrencinin söylediği kelime kaydı, ses tanıma için köprü üzerinden yurt dışındaki servise (ElevenLabs, ABD) gönderilsin. Bunun için öğrencinin yasal velisinin onayı gerekir. Sonuç yalnızca yumuşak sesli geri bildirim ve terapist raporu içindir; öğrenciye puan gösterilmez.</span></label></div>
  <div class="box"><h3>Güvenlik</h3><button class="btn" data-act="pinChange">PIN'i değiştir</button></div>
  <div class="box"><h3>Yedek</h3><p>Yedek: ayarlar, özel kelimeler, ilerleme, fotoğraflar, elle kayıtlar ve öğrencinin kayıtları. Yapay zeka ile üretilmiş klipler yedeğe girmez; yeni cihazda köprüyü bağlayıp Ses sekmesinden yeniden üretilir (kısa sürer, sesi yeniden kaydetmeniz gerekmez). Köprü parolası yedeğe girmez.</p>
  <div class="inline"><button class="btn" data-act="export">Dışa aktar</button><label class="btn">İçe aktar<input type="file" accept=".json" data-change="import" hidden></label></div></div>
  <div class="box"><h3>Tüm verileri sil</h3><button class="btn" data-act="wipe">Sil</button></div>`;
CHG.name = t => { S.cfg.name = t.value.trim(); saveCfg(); };
CHG.min = t => { S.cfg.min = +t.value; saveCfg(); };
CHG.case = t => { S.cfg.casemode = t.value; CASE_MODE = t.value; saveCfg(); };
CHG.speed = t => { S.cfg.speed = +t.value; saveCfg(); };
CHG.model = t => { S.cfg.model = t.value; saveCfg(); };
CHG.asr = t => { S.cfg.asr = t.checked; saveCfg(); render(); };
ACT.accent = d => { S.cfg.accent = d.c; saveCfg(); render(); };
ACT.pinChange = () => go('pin', { mode: 'set1', buf: '', err: '' });
const toB64 = buf => { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = s => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer; };
ACT.export = async () => {
  const blobs = {};
  for (const k of await DB.keys()) {
    if (typeof k !== 'string') continue;
    const r = await DB.get(k); if (!r) continue;
    if (k.startsWith('v|') && r.src === 'ai') continue;
    blobs[k] = { type: r.type, src: r.src || '', b64: toB64(r.buf) };
  }
  const f = new Blob([JSON.stringify({ v: 2, cfg: S.cfg, custom: S.custom, log: LOG, manual: [...MAN], qc: QC.map, blobs })], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = 'benimle-ogren-yedek-' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
};
CHG.import = async t => {
  const f = t.files[0]; if (!f || !confirm('Mevcut veriler yedekteki verilerle değiştirilsin mi?')) return;
  try {
    const j = JSON.parse(await f.text()); if (!j.v || !j.blobs) throw 0;
    await DB.clear(); urlCache.forEach(u => URL.revokeObjectURL(u)); urlCache.clear();
    for (const k in j.blobs) { const b = j.blobs[k], rec = { type: b.type, buf: fromB64(b.b64) }; if (b.src) rec.src = b.src; await DB.put(k, rec); }
    S.cfg = Object.assign({}, DEF, j.cfg); S.custom = j.custom || []; LOG = j.log || []; MAN = new Set(j.manual || []); QC.map = j.qc || {};
    saveCfg(); saveCustom(); LS.set('log', LOG); saveMan(); QC.save(); CASE_MODE = S.cfg.casemode;
    rebuild(); await refreshRec(); await loadPhotos(); toast('Yedek yüklendi'); render();
  } catch (e) { toast('Yedek dosyası okunamadı.'); }
};
ACT.wipe = async () => {
  if (!confirm('Tüm kayıtlar, fotoğraflar ve ilerleme silinecek. Emin misiniz?')) return;
  const ids = S.cfg.profiles.filter(p => p.voiceId).map(p => p.voiceId);
  if (ids.length && Bridge.ready() && confirm('Servisteki yapay zeka ses modelleri de silinsin mi?')) { for (const id of ids) { try { await Bridge.del(id); } catch (e) {} } }
  await DB.clear(); try { localStorage.clear(); } catch (e) {} location.reload();
};

/* ---------- başlat ---------- */
(async function init() {
  rebuild(); CASE_MODE = S.cfg.casemode;
  try { await DB.open(); await refreshRec(); await loadPhotos(); }
  catch (e) { toast('Bu tarayıcıda depolama kullanılamıyor (gizli sekme olabilir).'); }
  document.documentElement.style.setProperty('--accent', S.cfg.accent);
  render();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
