'use strict';
/* fx.js — görsel ve işitsel eğlence katmanı: maskot (Pıtır), yıldız, ses efektleri, konfeti.
   Maskot ve çizimler bu projeye özgüdür; bilinen bir karakterin kopyası değildir. */

/* ---------- Maskot: Pıtır ----------
   mood: happy · cheer (sevinç) · think (düşünüyor) · oops (hafif "hata olsun") · listen (dinliyor) · sleep (uyuyor) */
function mascot(mood = 'happy', cls = '') {
  return `<svg class="pitir ${cls}" data-m="${mood}" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
  <g class="p-all">
    <g class="p-antenna"><path d="M100 40 Q96 22 112 12" fill="none" stroke="#6a55d9" stroke-width="5" stroke-linecap="round"/><path class="p-star" d="M112 2l3.2 6.6 7.2 1-5.2 5.1 1.2 7.2-6.4-3.4-6.4 3.4 1.2-7.2-5.2-5.1 7.2-1z" fill="#ffc233" stroke="#e8a200" stroke-width="1.2" stroke-linejoin="round"/></g>
    <ellipse cx="60" cy="70" rx="17" ry="22" fill="#7a66ea" transform="rotate(-18 60 70)"/><ellipse cx="60" cy="71" rx="9" ry="13" fill="#ffc2d6" transform="rotate(-18 60 71)"/>
    <ellipse cx="140" cy="70" rx="17" ry="22" fill="#7a66ea" transform="rotate(18 140 70)"/><ellipse cx="140" cy="71" rx="9" ry="13" fill="#ffc2d6" transform="rotate(18 140 71)"/>
    <ellipse class="p-foot" cx="72" cy="180" rx="23" ry="12" fill="#ffa94d"/><ellipse class="p-foot" cx="128" cy="180" rx="23" ry="12" fill="#ffa94d"/>
    <g class="p-arm p-arm-l"><ellipse cx="34" cy="122" rx="13" ry="22" fill="#8f7bff" transform="rotate(14 34 122)"/></g>
    <g class="p-arm p-arm-r"><ellipse cx="166" cy="122" rx="13" ry="22" fill="#8f7bff" transform="rotate(-14 166 122)"/></g>
    <ellipse cx="100" cy="114" rx="72" ry="70" fill="#8f7bff"/>
    <ellipse cx="100" cy="50" rx="40" ry="16" fill="#a595ff" opacity=".55"/>
    <ellipse cx="100" cy="138" rx="44" ry="38" fill="#fff4e0"/>
    <circle cx="58" cy="116" r="11" fill="#ff8fb1" opacity=".55"/><circle cx="142" cy="116" r="11" fill="#ff8fb1" opacity=".55"/>
    <g class="p-eyes p-open"><g class="p-blink"><ellipse cx="76" cy="94" rx="15" ry="18" fill="#fff"/><ellipse cx="124" cy="94" rx="15" ry="18" fill="#fff"/>
      <g class="p-pupils"><circle cx="78" cy="97" r="9" fill="#2b2250"/><circle cx="126" cy="97" r="9" fill="#2b2250"/><circle cx="81" cy="93" r="3.2" fill="#fff"/><circle cx="129" cy="93" r="3.2" fill="#fff"/></g></g></g>
    <g class="p-eyes p-arc"><path d="M61 98 Q76 76 91 98" fill="none" stroke="#2b2250" stroke-width="6" stroke-linecap="round"/><path d="M109 98 Q124 76 139 98" fill="none" stroke="#2b2250" stroke-width="6" stroke-linecap="round"/></g>
    <g class="p-eyes p-shut"><path d="M62 96 Q76 106 90 96" fill="none" stroke="#2b2250" stroke-width="5" stroke-linecap="round"/><path d="M110 96 Q124 106 138 96" fill="none" stroke="#2b2250" stroke-width="5" stroke-linecap="round"/></g>
    <g class="p-brows p-b-think"><path d="M62 70 Q76 62 90 68" fill="none" stroke="#2b2250" stroke-width="5" stroke-linecap="round"/><path d="M112 62 Q126 58 138 66" fill="none" stroke="#2b2250" stroke-width="5" stroke-linecap="round"/></g>
    <g class="p-brows p-b-oops"><path d="M64 72 Q76 66 90 64" fill="none" stroke="#2b2250" stroke-width="5" stroke-linecap="round"/><path d="M110 64 Q124 66 136 72" fill="none" stroke="#2b2250" stroke-width="5" stroke-linecap="round"/></g>
    <path class="p-mouth p-m-smile" d="M84 118 Q100 134 116 118" fill="none" stroke="#2b2250" stroke-width="5.5" stroke-linecap="round"/>
    <g class="p-mouth p-m-open"><path d="M80 112 Q100 150 120 112 Q100 120 80 112Z" fill="#6b2146" stroke="#2b2250" stroke-width="4" stroke-linejoin="round"/><path d="M90 130 Q100 138 110 130 Q100 124 90 130Z" fill="#ff8fb1"/></g>
    <path class="p-mouth p-m-think" d="M90 124 Q100 118 112 124" fill="none" stroke="#2b2250" stroke-width="5.5" stroke-linecap="round"/>
    <ellipse class="p-mouth p-m-o" cx="100" cy="124" rx="7" ry="8" fill="#6b2146" stroke="#2b2250" stroke-width="4"/>
    <g class="p-waves"><path d="M16 80 Q8 94 16 108" fill="none" stroke="#4dabf7" stroke-width="5" stroke-linecap="round"/><path d="M4 72 Q-8 94 4 116" fill="none" stroke="#4dabf7" stroke-width="5" stroke-linecap="round" opacity=".6"/><path d="M184 80 Q192 94 184 108" fill="none" stroke="#4dabf7" stroke-width="5" stroke-linecap="round"/><path d="M196 72 Q208 94 196 116" fill="none" stroke="#4dabf7" stroke-width="5" stroke-linecap="round" opacity=".6"/></g>
    <g class="p-zzz" fill="#5b6bd6" font-family="Lexend,Arial,sans-serif" font-weight="800"><text x="150" y="44" font-size="26">z</text><text x="168" y="26" font-size="20">z</text><text x="182" y="12" font-size="14">z</text></g>
  </g></svg>`;
}

/* Yıldız: dolu olanın yüzü var */
function starSvg(on, cls = '') {
  return `<svg class="starsvg ${on ? 'on' : 'off'} ${cls}" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 6l13 27 30 4-22 21 6 30-27-15-27 15 6-30L7 37l30-4z" fill="${on ? '#ffc233' : '#dfe3f0'}" stroke="${on ? '#e8a200' : '#c8cee3'}" stroke-width="5" stroke-linejoin="round"/>${on ? '<circle cx="40" cy="52" r="3.6" fill="#2b2250"/><circle cx="60" cy="52" r="3.6" fill="#2b2250"/><path d="M42 61 Q50 68 58 61" fill="none" stroke="#2b2250" stroke-width="3.5" stroke-linecap="round"/>' : ''}</svg>`;
}

/* ---------- ses efektleri (WebAudio; parçalar yok, dosya yok) ---------- */
const SFX = {
  ctx: null, on: true,
  init() {
    if (SFX.ctx) { if (SFX.ctx.state === 'suspended') SFX.ctx.resume().catch(() => {}); return SFX.ctx; }
    try { const C = window.AudioContext || window.webkitAudioContext; if (C) SFX.ctx = new C(); } catch (e) { SFX.ctx = null; }
    return SFX.ctx;
  },
  tone(f, t0, dur, type = 'sine', vol = 0.13) {
    const c = SFX.ctx; if (!c) return;
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + t0;
    o.type = type; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.03);
  },
  play(name) {
    if (!SFX.on || !SFX.init()) return;
    const T = (...a) => SFX.tone(...a);
    if (name === 'tap') T(620, 0, 0.06, 'triangle', 0.08);
    else if (name === 'good') { T(659, 0, 0.14, 'sine'); T(880, 0.1, 0.22, 'sine'); }
    else if (name === 'soft') { T(392, 0, 0.16, 'sine', 0.09); T(330, 0.12, 0.22, 'sine', 0.08); }
    else if (name === 'pop') T(780, 0, 0.09, 'triangle', 0.1);
    else if (name === 'done') { [523, 659, 784, 1047].forEach((f, i) => T(f, i * 0.11, 0.3, 'triangle', 0.12)); T(1568, 0.5, 0.5, 'sine', 0.06); }
    else if (name === 'star') T(1046, 0, 0.35, 'sine', 0.1);
  }
};
const reduceMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
const buzz = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };

/* ---------- konfeti ---------- */
function confetti(n = 90) {
  if (reduceMotion()) return;
  const cv = document.createElement('canvas'); cv.className = 'confetti'; cv.width = innerWidth; cv.height = innerHeight; document.body.appendChild(cv);
  const g = cv.getContext('2d'), cols = ['#ffc233', '#8f7bff', '#2fcf8f', '#ff8fb1', '#4dabf7', '#ffa94d'];
  const ps = Array.from({ length: n }, () => ({ x: cv.width / 2 + (Math.random() - .5) * 80, y: cv.height * 0.55, vx: (Math.random() - .5) * 13, vy: -8 - Math.random() * 11, s: 6 + Math.random() * 7, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: cols[Math.floor(Math.random() * cols.length)] }));
  const t0 = performance.now();
  (function frame(t) {
    const e = t - t0; g.clearRect(0, 0, cv.width, cv.height);
    ps.forEach(p => { p.vy += 0.33; p.x += p.vx; p.y += p.vy; p.r += p.vr; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.globalAlpha = Math.max(0, 1 - e / 2600); g.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * .6); g.restore(); });
    if (e < 2600) requestAnimationFrame(frame); else cv.remove();
  })(t0);
}
