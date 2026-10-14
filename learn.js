'use strict';
/* learn.js — öğrenci tarafı (V2): öğrenme yolu, ders motoru, alıştırmalar, ödüller.
   Kurallar: ceza yok (can/kalp yok), hata yumuşak geri bildirimle geçilir, her ders en az 1 yıldızla biter,
   kaydı olmayan öğe için robot sesi yok, öğrenciye ses tanıma puanı gösterilmez. */

/* ---------- ilerleme (cihazda; sunucuya aktarılmaz) ---------- */
const PROG = Object.assign({ xp: 0, days: [], xpDay: {}, done: {}, learned: [], badges: {}, lessons: 0, best: 0, talk: 0, perfect: 0, goalDays: 0 }, LS.get('prog', {}));
const saveProg = () => LS.set('prog', PROG);
const dayKey = d => { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
function streak() {
  const set = new Set(PROG.days); let d = new Date();
  if (!set.has(dayKey(d))) { d.setDate(d.getDate() - 1); if (!set.has(dayKey(d))) return 0; }
  let n = 0; while (set.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); } return n;
}
const xpToday = () => PROG.xpDay[dayKey()] || 0;
const goalXp = () => S.cfg.goal || 100;
const phraseText = k => { const p = PHRASES.find(x => x.k === k); return p ? p.t : ''; };
const LEARNER_VIEWS = new Set(['home', 'path', 'practice', 'rewards', 'ders', 'done', 'end', 'kur']);

/* ---------- öğrenme yolu ---------- */
const UCOL = ['#7c5cff', '#1f9d8a', '#ff8a5c', '#3b8be0', '#e0559c', '#d99a00'];
const DXS = [0, 44, 66, 44, 0, -44, -66, -44];
const UNIT_WORDS = 20, LESSON_WORDS = 4, UNIT_SYL = 16;
let _sylOrder = null;
const sylOrder = s => { if (!_sylOrder) { _sylOrder = new Map(); SYLLABLES.forEach((r, i) => _sylOrder.set(r[0], i)); } return _sylOrder.has(s) ? _sylOrder.get(s) : 9999; };

function chunkLessons(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  if (out.length > 1 && out[out.length - 1].length === 1) { const last = out.pop(); out[out.length - 1].push(last[0]); }
  return out;
}
function buildPath() {
  const uw = usableWords().slice().sort((a, b) => a.level - b.level || a.theme - b.theme || a.word.localeCompare(b.word, 'tr'));
  const byLevel = new Map();
  uw.forEach(w => { if (!byLevel.has(w.level)) byLevel.set(w.level, []); byLevel.get(w.level).push(w); });
  const wu = [];
  for (const [lv, ws] of byLevel) {
    for (let i = 0; i < ws.length; i += UNIT_WORDS) {
      const chunk = ws.slice(i, i + UNIT_WORDS), th = [];
      chunk.forEach(w => { if (!th.includes(w.theme)) th.push(w.theme); });
      const title = th.slice(0, 2).map(t => THEMES[t]).join(' · ') + (th.length > 2 ? ' …' : '');
      wu.push({ kind: 'w', level: lv, title, emoji: (chunk.find(w => w.emoji) || {}).emoji || '📘', items: chunk });
    }
  }
  const su = [], sy = currSyl().sort((a, b) => sylOrder(a) - sylOrder(b));
  for (let i = 0; i < sy.length; i += UNIT_SYL) su.push({ kind: 'y', level: 0, title: 'Heceler', emoji: '🔤', items: sy.slice(i, i + UNIT_SYL) });
  const units = []; let si = 0;
  wu.forEach((u, i) => { units.push(u); const target = Math.floor((i + 1) * su.length / wu.length); while (si < target) units.push(su[si++]); });
  while (si < su.length) units.push(su[si++]);
  const lessons = []; let wn = 0, sn = 0;
  units.forEach((u, ui) => {
    u.idx = ui; u.num = u.kind === 'w' ? ++wn : ++sn; u.lessons = [];
    u.col = UCOL[ui % UCOL.length];
    chunkLessons(u.items, u.kind === 'w' ? LESSON_WORDS : LESSON_WORDS).forEach((items, n) => {
      const first = u.kind === 'w' ? items[0].id : items[0];
      const L = { id: u.kind + ':' + first + ':' + items.length, kind: u.kind, items, unit: ui, n, gi: lessons.length };
      u.lessons.push(L); lessons.push(L);
    });
  });
  return { units, lessons };
}
const lessonOpen = (P, L) => S.cfg.unlockAll || L.gi === 0 || !!PROG.done[L.id] || !!PROG.done[P.lessons[L.gi - 1].id];
const lessonStars = id => PROG.done[id] || 0;

/* ---------- ekranlar: karşılama ---------- */
VIEWS.home = () => `<main class="splash">
  ${mascot('happy')}
  <h1>Benimle Öğren</h1>
  ${S.cfg.name ? `<div class="bubble top">Merhaba, ${esc(S.cfg.name)}!</div>` : ''}
  <button class="cta big" data-act="start">Başla</button>
</main><button class="adultbtn" data-act="adult">🔒 Yetişkin girişi</button>`;
AFTER.home = () => { const m = document.querySelector('.splash .pitir'); if (m) m.style.width = 'min(60vw,240px)'; };
ACT.start = () => { SFX.init(); SFX.play('pop'); sessionStart = Date.now(); say('ui:hos'); go('path'); };
ACT.exit = () => { endSession(); go('home'); };

/* ---------- ekranlar: ortak üst/alt ---------- */
function topbar() {
  const st = streak(), pct = Math.min(1, xpToday() / goalXp()), C = 2 * Math.PI * 19;
  return `<header class="topbar">
    <div class="stat fire ${st ? '' : 'off'}" aria-label="Seri">🔥 ${st}</div>
    <div class="stat xp" aria-label="Puan">⭐ ${PROG.xp}</div><div class="sp"></div>
    <div class="ring" title="Günlük hedef: ${xpToday()} / ${goalXp()}"><svg viewBox="0 0 46 46"><circle cx="23" cy="23" r="19" fill="none" stroke="#e3e0f5" stroke-width="6"/><circle cx="23" cy="23" r="19" fill="none" stroke="${pct >= 1 ? '#2fcf8f' : 'var(--pri)'}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(C * pct).toFixed(1)} ${C.toFixed(1)}"/></svg><b>${pct >= 1 ? '✔' : '🎯'}</b></div>
    <button class="lockbtn" data-act="adult" aria-label="Yetişkin girişi">🔒</button></header>`;
}
function bottomnav(cur) {
  const b = (v, ic, t) => `<button class="navb ${cur === v ? 'on' : ''}" data-act="nav" data-v="${v}"><span class="ni2" aria-hidden="true">${ic}</span>${t}</button>`;
  return `<nav class="bottomnav" aria-label="Menü"><div class="in">${b('path', '🏠', 'Yol')}${b('practice', '🎯', 'Pratik')}${b('rewards', '🏆', 'Ödüller')}</div></nav>`;
}
ACT.nav = d => { SFX.play('tap'); if (d.v !== V.name) go(d.v); };

/* ---------- ekranlar: yol ---------- */
VIEWS.path = () => {
  const P = buildPath(); V.P = P;
  if (!P.lessons.length) {
    return `<div class="wrap">${topbar()}<main class="path"><div class="empty">${mascot('think')}Henüz sesli içerik yok.<br>Yetişkin girişinden sesi oluşturup üretince dersler burada açılacak.<br><br><button class="cta" data-act="adult">🔒 Yetişkin girişi</button></div></main>${bottomnav('path')}</div>`;
  }
  const cur = P.lessons.find(L => !PROG.done[L.id] && lessonOpen(P, L)) || null;
  let k = 0;
  const units = P.units.filter(u => u.lessons.length).map(u => {
    const nodes = u.lessons.map(L => {
      const dx = DXS[k++ % DXS.length], done = !!PROG.done[L.id], open = lessonOpen(P, L), isCur = cur && cur.id === L.id, stars = lessonStars(L.id);
      const ic = done ? '✔' : !open ? '🔒' : (L.kind === 'y' ? 'Aa' : '★');
      return `<div class="nodebox" style="--dx:${dx}px">
        ${isCur ? `<div class="start-tag">BAŞLA</div>` : ''}
        <button class="node ${done ? 'done' : !open ? 'lock' : ''} ${isCur ? 'cur' : ''}" ${isCur ? 'id="curnode"' : ''} data-act="lesson" data-id="${esc(L.id)}" aria-label="Ders ${L.gi + 1}${done ? ', tamamlandı' : !open ? ', kilitli' : ''}"><span style="font-size:${L.kind === 'y' && ic === 'Aa' ? '1.6rem' : '2rem'}">${ic}</span></button>
        <div class="nstars">${done ? [1, 2, 3].map(i => starSvg(i <= stars)).join('') : ''}</div>
        ${isCur ? `<div class="side-mascot ${dx > 0 ? 'l' : 'r'}">${mascot('happy')}</div>` : ''}
      </div>`;
    }).join('');
    return `<section class="unit" style="--uc:${u.col}"><div class="ubanner"><div><small>${u.kind === 'w' ? 'BİRİM ' + u.num + ' · SEVİYE ' + u.level : 'HECE BİRİMİ ' + u.num}</small><b>${esc(u.title)}</b></div><span class="ue" aria-hidden="true">${esc(u.emoji)}</span></div><div class="nodes">${nodes}</div></section>`;
  }).join('');
  const hi = streak() ? `${streak()} gündür çalışıyorsun!` : 'Hadi bugün başlayalım.';
  return `<div class="wrap">${topbar()}<main class="path">
    <div class="hello"><button data-act="hi" style="background:none;padding:0" aria-label="Pıtır">${mascot('happy')}</button><div class="bubble">${S.cfg.name ? esc(S.cfg.name) + ', ' : ''}${hi}</div></div>
    ${units}</main>${bottomnav('path')}</div>`;
};
AFTER.path = () => { const n = el('curnode'); if (n && V.fresh) { V.fresh = false; n.scrollIntoView({ block: 'center' }); } };
ACT.hi = () => { SFX.play('pop'); say('ui:hos'); };
ACT.lesson = d => {
  const P = V.P || buildPath(), L = P.lessons.find(x => x.id === d.id); if (!L) return;
  if (!lessonOpen(P, L)) { SFX.play('soft'); toast('Önce bir önceki dersi bitir.'); return; }
  SFX.init(); SFX.play('pop'); startLesson(L);
};

/* ---------- ekranlar: pratik ---------- */
VIEWS.practice = () => {
  const uw = usableWords(), np = uw.filter(hasPic).length, ns = currSyl().length;
  const t = (m, col, ic, name, sub, ok) => `<button class="ptile" style="--tc:${col}" data-act="prac" data-m="${m}" ${ok ? '' : 'disabled'}><span aria-hidden="true">${ic}</span>${name}<small>${sub}</small></button>`;
  return `<div class="wrap">${topbar()}<main class="page"><h2>Pratik yap</h2><div class="pgrid">
    <button class="ptile wide" style="--tc:#7c5cff" data-act="prac" data-m="mix" ${uw.length >= 3 ? '' : 'disabled'}><span aria-hidden="true">🎲</span><div>Karışık<br><small>Her türden birkaç soru</small></div></button>
    ${t('oku', '#3b8be0', '📖', 'Oku', 'Kelimeyi dinle', uw.length >= 1)}${t('hece', '#e0559c', '🔤', 'Hece', 'Heceyi bul', ns >= 3)}
    ${t('konus', '#ff8a5c', '🎤', 'Konuş', 'Sen söyle', uw.length >= 1)}${t('yaz', '#1f9d8a', '✏️', 'Yaz', 'Harfin üstünden geç', uw.length >= 1)}
    <button class="ptile wide" style="--tc:#d99a00" data-act="prac" data-m="bul" ${np >= 3 ? '' : 'disabled'}><span aria-hidden="true">🔍</span><div>Bul<br><small>Resmi bul</small></div></button></div></main>${bottomnav('practice')}</div>`;
};
ACT.prac = d => { SFX.init(); SFX.play('pop'); startPractice(d.m); };

/* ---------- ekranlar: ödüller ---------- */
const BADGES = [
  ['first', '🌟', 'İlk ders', p => p.lessons >= 1], ['l5', '🎈', '5 ders', p => p.lessons >= 5], ['l20', '🏅', '20 ders', p => p.lessons >= 20],
  ['w25', '📘', '25 kelime', p => p.learned.length >= 25], ['w100', '📚', '100 kelime', p => p.learned.length >= 100], ['w300', '🎓', '300 kelime', p => p.learned.length >= 300],
  ['s3', '🔥', '3 gün seri', p => p.best >= 3], ['s7', '🚀', '7 gün seri', p => p.best >= 7], ['perfect', '💎', 'Hatasız ders', p => p.perfect >= 1],
  ['goal', '🎯', 'Günlük hedef', p => p.goalDays >= 1], ['xp500', '⭐', '500 puan', p => p.xp >= 500], ['talk', '🎤', 'Konuşkan', p => p.talk >= 20]
];
const rankOf = n => n >= 350 ? 'Kelime kahramanı' : n >= 150 ? 'Kelime ustası' : n >= 50 ? 'Kelime kaşifi' : n >= 10 ? 'Kelime avcısı' : 'Yeni başlayan';
VIEWS.rewards = () => {
  const n = PROG.learned.length;
  return `<div class="wrap">${topbar()}<main class="page"><div class="hero">${mascot(n ? 'cheer' : 'happy')}<div><h3>${esc(rankOf(n))}</h3><p>${n} kelime öğrendin</p></div></div>
    <div class="stats4"><div class="stat4"><b>${PROG.lessons}</b><span>Biten ders</span></div><div class="stat4"><b>${PROG.best}</b><span>En uzun seri (gün)</span></div><div class="stat4"><b>${PROG.xp}</b><span>Toplam puan</span></div><div class="stat4"><b>${Object.keys(PROG.badges).length}/${BADGES.length}</b><span>Rozet</span></div></div>
    <h2>Rozetler</h2><div class="badges">${BADGES.map(([id, ic, nm]) => `<div class="badge ${PROG.badges[id] ? '' : 'off'}"><span class="bi" aria-hidden="true">${ic}</span>${nm}</div>`).join('')}</div></main>${bottomnav('rewards')}</div>`;
};

/* ---------- ders kurulumu ---------- */
const picPool = () => usableWords().filter(hasPic);
const sylReady = w => w.syl.length > 1 && w.syl.every(s => hasKey('y:' + s));
function wordSteps(ws, full) {
  const steps = [], pp = picPool().length >= 3;
  ws.forEach(w => { steps.push({ t: 'intro', w }); steps.push(pp && hasPic(w) ? { t: 'pic', w } : { t: 'txt', w }); });
  if (full) {
    shuffle(ws.filter(sylReady)).slice(0, 2).forEach(w => steps.push({ t: 'sirala', w }));
    shuffle(ws).slice(0, 2).forEach(w => steps.push({ t: 'konus', w }));
    for (const w of shuffle(ws)) { const L = trUpper(w.word.charAt(0)); steps.push({ t: 'yaz', w, letter: CASE_MODE === 'lower' ? trLower(L) : L }); break; }
  }
  return steps;
}
function sylSteps(ss) {
  const steps = [];
  ss.forEach(s => { steps.push({ t: 'introy', syl: s }); steps.push({ t: 'hece', syl: s }); });
  shuffle(ss).slice(0, 2).forEach(s => steps.push({ t: 'konus', syl: s }));
  return steps;
}
function startLesson(L) {
  const steps = L.kind === 'w' ? wordSteps(L.items, true) : sylSteps(L.items);
  if (!steps.length) { toast('Bu ders için yeterli sesli içerik yok.'); return; }
  go('ders', { lesson: L, steps, i: 0, total: steps.length, done: 0, mistakes: 0, xp: 0, requeued: 0, practice: false });
}
function startPractice(m) {
  const uw = usableWords(); let steps = [];
  if (m === 'oku') steps = pickBy(uw, 'oku', 5, w => w.id).map(w => ({ t: 'intro', w, prac: true }));
  else if (m === 'hece') steps = pickBy(currSyl(), 'hece', 6, s => s).map(s => ({ t: 'hece', syl: s }));
  else if (m === 'konus') steps = pickBy(uw, 'konus', 4, w => w.id).map(w => ({ t: 'konus', w }));
  else if (m === 'bul') steps = pickBy(uw.filter(hasPic), 'bul', 5, w => w.id).map(w => ({ t: 'pic', w }));
  else if (m === 'yaz') {
    const seen = new Set();
    pickBy(uw, 'yaz', 14, w => w.id).forEach(w => { const L = trUpper(w.word.charAt(0)); if (seen.has(L) || steps.length >= 5) return; seen.add(L); steps.push({ t: 'yaz', w, letter: CASE_MODE === 'lower' ? trLower(L) : L }); });
  } else {
    const ws = shuffle(uw).slice(0, 8), pp = picPool().length >= 3, sy = currSyl();
    ws.slice(0, 3).forEach(w => steps.push(pp && hasPic(w) ? { t: 'pic', w } : { t: 'txt', w }));
    if (sy.length >= 3) shuffle(sy).slice(0, 2).forEach(s => steps.push({ t: 'hece', syl: s }));
    ws.filter(sylReady).slice(0, 1).forEach(w => steps.push({ t: 'sirala', w }));
    ws.slice(3, 5).forEach(w => steps.push({ t: 'konus', w }));
  }
  if (!steps.length) { toast('Bu pratik için yeterli sesli içerik yok.'); return; }
  go('ders', { lesson: null, steps, i: 0, total: steps.length, done: 0, mistakes: 0, xp: 0, requeued: 0, practice: true, pm: m });
}

/* ---------- ders ekranı ---------- */
const curStep = () => V.steps[V.i];
const stepWord = () => curStep().w;
const COACH = {
  intro: 'Yeni kelime! Dinle ve dokun.', introy: 'Yeni hece! Dinle.', pic: 'Dinle, doğru resmi bul.', txt: 'Dinle, doğru kelimeyi bul.',
  hece: 'Dinle, doğru heceyi bul.', sirala: 'Hecelere sırayla dokun.', konus: 'Şimdi sen söyle!', yaz: 'Parmağınla harfin üstünden geç.'
};
PREP.ders = () => {
  const st = curStep(); V.fb = null; V.mood = 'happy'; V.wrong = []; V.right = null; V.missed = false; V.rec = false; V.busy = false;
  if (V.child) { URL.revokeObjectURL(V.child); } V.child = null; V.ok = false;
  if (st.t === 'pic') {
    const o = shuffle(picPool().filter(x => x.id !== st.w.id)).slice(0, 2); V.opts = shuffle([st.w, ...o]);
  } else if (st.t === 'txt') {
    const pool = usableWords().filter(x => x.id !== st.w.id), near = pool.filter(x => Math.abs(x.word.length - st.w.word.length) <= 1 && x.word[0] !== st.w.word[0]);
    V.opts = shuffle([st.w, ...shuffle(near.length >= 2 ? near : pool).slice(0, 2)]);
  } else if (st.t === 'hece') {
    const pool = currSyl().filter(x => x !== st.syl), same = pool.filter(x => x.length === st.syl.length);
    V.opts = shuffle([st.syl, ...shuffle(same.length >= 2 ? same : pool).slice(0, 2)]);
  } else if (st.t === 'sirala') {
    V.bank = shuffle(st.w.syl.map((s, i) => ({ s, i }))); V.built = []; V.badIdx = -1;
    if (st.w.syl.length > 1 && V.bank.map(b => b.s).join('|') === st.w.syl.join('|')) V.bank.reverse();
  }
};
function prog() { return Math.round(100 * V.done / V.total); }
function footInner() {
  const f = V.fb;
  if (f && f.k === 'good') return `<div class="in"><div class="msg">${esc(f.msg)}</div><button class="cta mint" data-act="cont">Devam</button></div>`;
  if (f && f.k === 'bad') return `<div class="in"><div class="msg">${esc(f.msg)}</div></div>`;
  const st = curStep();
  if (st.t === 'intro' || st.t === 'introy') return `<div class="in"><button class="cta block" data-act="cont">Devam</button></div>`;
  if (st.t === 'konus' || st.t === 'yaz') return `<div class="in"><button class="cta ghost block" data-act="skip">Atla</button></div>`;
  return '';
}
const footClass = () => 'lfoot' + (V.fb ? ' ' + V.fb.k : '');
function setFoot() { const f = el('foot'); if (!f) return; f.className = footClass(); f.innerHTML = footInner(); f.style.display = footInner() ? '' : 'none'; }
function coach(text) {
  const mood = V.fb ? (V.fb.k === 'good' ? 'cheer' : 'oops') : V.mood;
  return `<div class="coach" id="coach">${mascot(mood)}<div class="bubble">${esc(text)}</div></div>`;
}
const picBox = w => hasPic(w) ? `<button class="pic2" data-act="sayWord" aria-label="${esc(w.word)} dinle">${picHtml(w)}</button>` : '';
const hearBtn = (cls = '') => `<button class="hear ${cls}" data-act="sayStep" aria-label="Dinle">🔊</button>`;

const STEPV = {
  intro: st => {
    const w = st.w, ok = sylReady(w);
    return `${coach(COACH.intro)}${picBox(w)}<div class="bigword">${esc(fmt(w.word))}</div>
      ${ok ? `<div class="sylrow2" id="syl">${w.syl.map(s => `<button class="sylchip" data-act="saySyl" data-s="${esc(s)}">${esc(fmt(s, false))}</button>`).join('')}</div>` : ''}
      <div class="row2">${hearBtn()}${ok ? `<button class="cta ghost" data-act="sayAllSyl">Heceler</button>` : ''}</div>`;
  },
  introy: st => `${coach(COACH.introy)}<div class="bigsyl">${esc(fmt(st.syl, false))}</div>${hearBtn('lg')}`,
  pic: st => `${coach(COACH.pic)}${hearBtn('lg')}<div class="opts ${V.opts.length > 2 ? 'c3' : 'c2'}" style="grid-template-columns:repeat(${Math.min(3, V.opts.length)},1fr)">${V.opts.map(o => `<button class="opt p ${V.wrong.includes(o.id) ? 'bad' : ''} ${V.right === o.id ? 'good' : V.right ? 'dim' : ''}" data-act="pick" data-id="${esc(o.id)}" aria-label="seçenek">${picHtml(o)}</button>`).join('')}</div>`,
  txt: st => `${coach(COACH.txt)}${hearBtn('lg')}<div class="opts" style="grid-template-columns:1fr">${V.opts.map(o => `<button class="opt t ${V.wrong.includes(o.id) ? 'bad' : ''} ${V.right === o.id ? 'good' : V.right ? 'dim' : ''}" data-act="pick" data-id="${esc(o.id)}">${esc(fmt(o.word))}</button>`).join('')}</div>`,
  hece: st => `${coach(COACH.hece)}${hearBtn('lg')}<div class="opts" style="grid-template-columns:repeat(3,1fr)">${V.opts.map(o => `<button class="opt t ${V.wrong.includes(o) ? 'bad' : ''} ${V.right === o ? 'good' : V.right ? 'dim' : ''}" data-act="pickHece" data-s="${esc(o)}">${esc(fmt(o, false))}</button>`).join('')}</div>`,
  sirala: st => {
    const w = st.w, n = w.syl.length;
    return `${coach(COACH.sirala)}${picBox(w)}${hearBtn()}
      <div class="slots" aria-label="Kurulan kelime">${V.built.map(b => `<span class="sylchip">${esc(fmt(b.s, false))}</span>`).join('')}${Array.from({ length: n - V.built.length }, () => '<span class="ph"></span>').join('')}</div>
      <div class="bank">${V.bank.map((b, k) => `<button class="sylchip ${V.built.some(x => x.k === k) ? 'used' : ''} ${V.badIdx === k ? 'bad' : ''}" data-act="build" data-k="${k}">${esc(fmt(b.s, false))}</button>`).join('')}</div>`;
  },
  konus: st => {
    const w = st.w, txt = w ? fmt(w.word) : fmt(st.syl, false);
    let ctl;
    if (V.busy) ctl = `<div class="micwrap"><p>Bir saniye…</p></div>`;
    else if (V.child) ctl = `<div class="row2"><button class="cta ghost" data-act="sayStep">▶ ${esc(profName())}</button><button class="cta ghost" data-act="playChild">▶ Ben</button><button class="cta ghost" data-act="retry">↻</button></div>`;
    else ctl = `<div class="micwrap"><button class="mic2 ${V.rec ? 'rec' : ''}" data-act="micToggle" aria-label="${V.rec ? 'Bitir' : 'Söyle'}">${V.rec ? '■' : '🎤'}</button><p>${V.rec ? 'Dinliyorum…' : 'Dokun ve söyle'}</p></div><button class="cta ghost" data-act="sayStep">▶ ${esc(profName())}</button>`;
    return `${coach(COACH.konus)}${w ? picBox(w) : ''}<div class="${w ? 'bigword' : 'bigsyl'}">${esc(txt)}</div>${ctl}`;
  },
  yaz: st => `${coach(COACH.yaz)}<div class="row2" style="align-items:center">${hasPic(st.w) ? `<div class="pic2" style="width:84px;border-radius:20px">${picHtml(st.w)}</div>` : ''}<div class="bigword" style="font-size:2.4rem">${esc(fmt(st.w.word))}</div></div>
    <div class="letterbox"><canvas id="cvg" width="360" height="360"></canvas><canvas id="cvd" width="360" height="360" aria-label="Çizim alanı"></canvas></div>
    <button class="cta ghost" data-act="yazClear">↻ Sil</button>`
};
VIEWS.ders = () => {
  const st = curStep(), fi = footInner();
  return `<div class="lesson"><header class="lhead"><button class="lx" data-act="lessonExit" aria-label="Çık">✕</button><div class="lprog" role="progressbar" aria-valuenow="${prog()}"><i style="width:${prog()}%"></i></div></header>
    <main class="lbody">${STEPV[st.t](st)}</main><footer id="foot" class="${footClass()}" ${fi ? '' : 'style="display:none"'}>${fi}</footer></div>`;
};
const stepKey = () => { const st = curStep(); return st.w ? 'w:' + st.w.id : 'y:' + st.syl; };
AFTER.ders = async () => {
  const st = curStep(); if (!V.fresh) return; V.fresh = false; const t = tok;
  if (st.t === 'yaz') initYaz();
  if (st.t === 'intro' && V.i === 0 && !V.practice) { await say('ui:yeni'); if (t !== tok) return; }
  if (st.t === 'pic' && !V.hintPic) { V.hintPic = true; }
  if (st.t === 'yaz') { await say('ui:harf'); return; }
  if (st.t === 'konus') { await say(stepKey()); if (t === tok && !V.hintSay) { V.hintSay = true; await say('ui:soyle'); } return; }
  await say(stepKey());
};
ACT.sayStep = () => { say(stepKey()); };
ACT.sayWord = () => { if (curStep().w) say('w:' + curStep().w.id); };
ACT.saySyl = d => { SFX.play('tap'); say('y:' + d.s); };
ACT.sayAllSyl = async () => {
  const w = stepWord(), t = tok, chips = document.querySelectorAll('#syl .sylchip');
  for (let i = 0; i < w.syl.length; i++) {
    if (t !== tok) return;
    chips.forEach((c, j) => c.classList.toggle('on', j === i));
    await say('y:' + w.syl[i]);
  }
  chips.forEach(c => c.classList.remove('on'));
};
ACT.lessonExit = () => {
  if (!confirm('Dersten çıkılsın mı?')) return;
  go(V.practice ? 'practice' : 'path');
};

/* adım ilerletme */
function xpAdd(n) { V.xp += n; }
function advanceStep() {
  V.done++; V.i++;
  if (V.i >= V.steps.length) return finishLesson();
  PREP.ders(); V.fresh = true; render();
}
ACT.cont = () => { SFX.play('tap'); const st = curStep(); if (st.t === 'intro') log('oku', st.w.id, 'done'); advanceStep(); };
ACT.skip = () => { SFX.play('tap'); advanceStep(); };
function requeue() { if (V.requeued < 3) { V.requeued++; V.steps.push(Object.assign({}, curStep())); V.total++; } }
function goodFb(extra) {
  const k = PRAISE[Math.floor(Math.random() * PRAISE.length)];
  V.fb = { k: 'good', msg: extra || phraseText(k) }; SFX.play('good'); buzz(25); return k;
}
function badFb() {
  V.fb = { k: 'bad', msg: 'Bir daha deneyelim' }; V.mood = 'think'; SFX.play('soft');
  const st = curStep(), tk = tok, i = V.i;
  setTimeout(() => { if (tk === tok && i === V.i && V.fb && V.fb.k === 'bad') { V.fb = null; if (V.name === 'ders') { const f = el('foot'); if (f) setFoot(); const c = el('coach'); if (c) c.outerHTML = coach(COACH[st.t]); } } }, 1700);
}

/* seçmeli adımlar */
ACT.pick = async d => {
  if (V.right) return;
  const st = curStep(), tk = tok;
  if (d.id === st.w.id) {
    V.right = d.id; xpAdd(V.missed ? 5 : 10); log('bul', st.w.id, V.missed ? 'miss' : 'ok'); PROG.correct = (PROG.correct || 0) + 1;
    const k = goodFb(); render(); await say(k);
  } else {
    V.missed = true; V.mistakes++; if (!V.wrong.length) requeue(); V.wrong.push(d.id); log('bul', st.w.id, 'miss');
    badFb(); render(); await say('fb:bir-daha'); if (tk === tok) say('w:' + st.w.id);
  }
};
ACT.pickHece = async d => {
  if (V.right) return;
  const st = curStep(), tk = tok;
  if (d.s === st.syl) {
    V.right = d.s; xpAdd(V.missed ? 5 : 10); log('hece', st.syl, V.missed ? 'miss' : 'ok');
    const k = goodFb(); render(); await say(k);
  } else {
    V.missed = true; V.mistakes++; if (!V.wrong.length) requeue(); V.wrong.push(d.s); log('hece', st.syl, 'miss');
    badFb(); render(); await say('fb:bir-daha'); if (tk === tok) say('y:' + st.syl);
  }
};
ACT.build = async d => {
  if (V.fb && V.fb.k === 'good') return;
  const st = curStep(), w = st.w, k = +d.k, b = V.bank[k], tk = tok;
  if (V.built.some(x => x.k === k)) return;
  if (b.s === w.syl[V.built.length]) {
    V.built.push({ s: b.s, k }); V.badIdx = -1; SFX.play('pop');
    if (V.built.length === w.syl.length) {
      xpAdd(V.missed ? 5 : 10); log('sirala', w.id, V.missed ? 'miss' : 'ok');
      const pk = goodFb(); render(); await say('w:' + w.id); if (tk === tok) await say(pk);
    } else { render(); await say('y:' + b.s); }
  } else {
    V.missed = true; V.mistakes++; V.badIdx = k; badFb(); render(); say('fb:bir-daha');
  }
};

/* konuş */
ACT.micToggle = async () => {
  if (V.rec) return finishChild();
  SFX.play('tap');
  try { await recStart(); } catch (e) { toast(micErr(e)); return; }
  V.rec = true; V.mood = 'listen'; render();
  autoStop = setTimeout(() => { if (V.rec) finishChild(); }, 6000);
};
async function finishChild() {
  clearTimeout(autoStop); const t = tok, st = curStep(), id = st.w ? st.w.id : 'y:' + st.syl; V.rec = false; V.mood = 'happy';
  let wav;
  try { wav = await clipFromBlob(await recStop()); } catch (e) { if (t === tok) { toast(e.message || 'Kayıt alınamadı.'); render(); } return; }
  if (t !== tok) return;
  await DB.put('c|' + id, { buf: wav, type: 'audio/wav' }); invalidate('c|' + id);
  V.child = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
  let cls = null, heard = '';
  if (S.cfg.asr && Bridge.ready()) {
    V.busy = true; render();
    try { const r = await asrCheck(new Blob([wav], { type: 'audio/wav' }), { text: st.w ? st.w.word : st.syl, kind: st.w ? 'w' : 'y' }); cls = r.cls; heard = r.text; } catch (e) { /* tanıma yoksa sessizce devam */ }
    if (t !== tok) return;
    V.busy = false;
  }
  log('konus', id, cls || 'done', heard); PROG.talk = (PROG.talk || 0) + 1; xpAdd(10);
  /* Öğrenciye puan veya hata gösterilmez; her denemede olumlu kapanır. */
  const k = goodFb(cls === 'near' ? phraseText('fb:yaklastin') : cls === 'far' ? phraseText('fb:bir-daha') : null);
  render();
  if (cls === 'near') await say('fb:yaklastin'); else if (cls === 'far') await say('fb:bir-daha'); else await say(k);
}
ACT.playChild = () => { if (V.child) playUrl(V.child); };
ACT.retry = () => { PREP.ders(); render(); };

/* yaz */
function initYaz() {
  const st = curStep(), g = el('cvg'), gc = g.getContext('2d'), d = el('cvd'), dc = d.getContext('2d');
  gc.font = 'bold 300px Lexend,"Segoe UI",Arial,sans-serif'; gc.fillStyle = '#d9d5f0'; gc.textAlign = 'center'; gc.textBaseline = 'middle';
  gc.fillText(st.letter, 180, 195);
  dc.lineCap = 'round'; dc.lineJoin = 'round'; dc.lineWidth = 30;
  dc.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#7c5cff'; dc.fillStyle = dc.strokeStyle;
  let drawing = false, last = null;
  const pos = e => { const r = d.getBoundingClientRect(); return { x: (e.clientX - r.left) * d.width / r.width, y: (e.clientY - r.top) * d.height / r.height }; };
  d.onpointerdown = e => { e.preventDefault(); d.setPointerCapture(e.pointerId); drawing = true; last = pos(e); dc.beginPath(); dc.arc(last.x, last.y, 15, 0, 7); dc.fill(); };
  d.onpointermove = e => { if (!drawing) return; const p = pos(e); dc.beginPath(); dc.moveTo(last.x, last.y); dc.lineTo(p.x, p.y); dc.stroke(); last = p; };
  const end = () => { if (!drawing) return; drawing = false; checkCoverage(gc, dc); };
  d.onpointerup = end; d.onpointercancel = end;
}
function checkCoverage(gc, dc) {
  if (V.ok) return;
  const a = gc.getImageData(0, 0, 360, 360).data, b = dc.getImageData(0, 0, 360, 360).data;
  let tot = 0, hit = 0;
  for (let y = 0; y < 360; y += 3) for (let x = 0; x < 360; x += 3) { const i = (y * 360 + x) * 4 + 3; if (a[i] > 40) { tot++; if (b[i] > 40) hit++; } }
  if (tot && hit / tot >= 0.6) {
    V.ok = true; log('yaz', stepWord().id, 'ok'); xpAdd(10);
    const k = goodFb(); setFoot(); const c = el('coach'); if (c) c.outerHTML = coach(COACH.yaz); say(k);
  }
}
ACT.yazClear = () => { el('cvd').getContext('2d').clearRect(0, 0, 360, 360); };

/* ---------- ders sonu ---------- */
function finishLesson() {
  const P = V.practice, L = V.lesson, mistakes = V.mistakes, xpGain = V.xp + (P ? 10 : 20);
  const stars = mistakes <= 1 ? 3 : mistakes <= 3 ? 2 : 1;
  const prevStreak = streak(), goalBefore = xpToday() >= goalXp();
  const t = dayKey(); if (!PROG.days.includes(t)) PROG.days.push(t);
  PROG.days = PROG.days.slice(-400);
  PROG.xp += xpGain; PROG.xpDay[t] = (PROG.xpDay[t] || 0) + xpGain;
  const keep = Object.keys(PROG.xpDay).sort().slice(-60); const nd = {}; keep.forEach(k => { nd[k] = PROG.xpDay[k]; }); PROG.xpDay = nd;
  const nowStreak = streak(); PROG.best = Math.max(PROG.best || 0, nowStreak);
  let newWords = 0;
  if (L) {
    PROG.done[L.id] = Math.max(PROG.done[L.id] || 0, stars); PROG.lessons++;
    if (L.kind === 'w') L.items.forEach(w => { if (!PROG.learned.includes(w.id)) { PROG.learned.push(w.id); newWords++; } });
    if (stars === 3 && mistakes === 0) PROG.perfect = (PROG.perfect || 0) + 1;
  }
  const goalNow = !goalBefore && xpToday() >= goalXp(); if (goalNow) PROG.goalDays = (PROG.goalDays || 0) + 1;
  const fresh = []; BADGES.forEach(([id, ic, nm, test]) => { if (!PROG.badges[id] && test(PROG)) { PROG.badges[id] = Date.now(); fresh.push(ic + ' ' + nm); } });
  saveProg(); log('mod', null, 'done');
  go('done', { stars, xpGain, practice: P, newWords, fresh, goalNow, streakUp: nowStreak > prevStreak, streak: nowStreak });
}
VIEWS.done = () => `<main class="finish">
  ${mascot('cheer')}
  <h1>${V.practice ? 'Pratik bitti!' : V.stars === 3 ? 'Muhteşem!' : 'Ders bitti!'}</h1>
  ${V.practice ? '' : `<div class="bigstars">${[1, 2, 3].map(i => starSvg(i <= V.stars)).join('')}</div>`}
  <div class="rewards"><div class="reward xp">⭐ +${V.xpGain}</div>${V.streakUp || V.streak ? `<div class="reward fire">🔥 ${V.streak} gün</div>` : ''}${V.newWords ? `<div class="reward">📘 +${V.newWords} kelime</div>` : ''}</div>
  ${V.goalNow ? '<div class="newbadge">🎯 Günlük hedef tamam!</div>' : ''}
  ${V.fresh.map(b => `<div class="newbadge">Yeni rozet: ${esc(b)}</div>`).join('')}
  <button class="cta big mint" data-act="doneOk">Devam</button>
</main>`;
AFTER.done = async () => {
  SFX.play(V.stars === 3 || V.practice ? 'done' : 'good'); confetti(V.stars === 3 ? 140 : 80);
  const t = tok; await sleepMs(500); if (t !== tok) return;
  await say(V.stars === 3 && hasKey('fb:muhtesem') ? 'fb:muhtesem' : 'fb:aferin');
};
const sleepMs = ms => new Promise(r => setTimeout(r, ms));
ACT.doneOk = () => { SFX.play('tap'); if (overTime()) go('end'); else go(V.practice ? 'practice' : 'path'); };

VIEWS.end = () => `<main class="finish">${mascot('sleep')}<h1>Bugünlük bu kadar</h1>
  <div class="rewards"><div class="reward xp">⭐ ${xpToday()} puan</div><div class="reward fire">🔥 ${streak()} gün</div></div>
  <p class="sub" style="color:var(--lmut);font-weight:700">Yarın görüşürüz!</p><button class="cta big" data-act="endOk">Tamam</button></main>`;
AFTER.end = async () => { await say('ui:bitti'); await say('ui:yarin'); };
ACT.endOk = () => { endSession(); go('home'); };

/* ---------- cihaz kurulumu (telefon ilk açılış) ---------- */
VIEWS.kur = () => `<main class="setup">${mascot('listen')}<h1 style="font-size:1.6rem">Sesler indiriliyor</h1><div class="progress"><i id="kbar" style="width:${Math.round((V.pct || 0) * 100)}%"></i></div><p id="kmsg" style="font-weight:700;color:var(--lmut)">${esc(V.msg || 'Hazırlanıyor…')}</p></main>`;
