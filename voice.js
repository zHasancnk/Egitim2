'use strict';
/* voice.js — ses fabrikası: köprü istemcisi, toplu üretim, YZ ile kalite kontrol, çocuk konuşması tanıma.
   Köprü (Cloudflare Worker) ElevenLabs anahtarını saklar; tarayıcı yalnızca köprü adresi + parolayı bilir. */

const TUNE = { retryBaseMs: 1000, gen: 3, qc: 2 };

class BridgeError extends Error {
  constructor(msg, kind, status) { super(msg); this.kind = kind; this.status = status || 0; this.retryAfter = 0; }
}
const FATAL = ['auth', 'origin', 'elauth', 'plan', 'config'];

function bridgeKind(status, upstream) {
  const s = upstream || status;
  if (status === 401) return ['auth', 'Köprü parolası yanlış.'];
  if (status === 403 && !upstream) return ['origin', 'Köprü bu siteden gelen isteği reddetti. Köprüdeki ALLOWED_ORIGIN değerini site adresinizle aynı yapın.'];
  if (s === 401) return ['elauth', 'ElevenLabs API anahtarı geçersiz (köprüdeki ELEVEN_API_KEY).'];
  if (s === 402) return ['plan', 'Hesabınızın planı veya kredisi bu işlem için yetersiz.'];
  if (s === 403) return ['plan', 'ElevenLabs bu işleme izin vermedi (plan veya anahtar izni).'];
  if (s === 429) return ['rate', 'Servis yoğun; biraz bekleyip yeniden deneniyor.'];
  if (s >= 500) return ['server', 'Servis geçici olarak yanıt vermiyor.'];
  return ['invalid', 'İstek reddedildi.'];
}

const Bridge = {
  cfg() { const c = LS.get('bridge', {}); return { url: String(c.url || '').trim().replace(/\/+$/, ''), token: String(c.token || '').trim() }; },
  ready() { const c = Bridge.cfg(); return !!(c.url && c.token); },
  async req(path, { method = 'GET', json, form } = {}) {
    const c = Bridge.cfg();
    if (!c.url || !c.token) throw new BridgeError('Köprü adresi ve parolası girilmemiş.', 'config');
    const headers = { Authorization: 'Bearer ' + c.token }; let body;
    if (json) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); } else if (form) body = form;
    let r;
    try { r = await fetch(c.url + path, { method, headers, body }); }
    catch (e) { throw new BridgeError('Köprüye bağlanılamadı. Adres doğru mu, internet var mı?', 'network'); }
    if (!r.ok) {
      let j = null; try { j = await r.json(); } catch (e) {}
      const [kind, msg] = bridgeKind(r.status, j && j.status);
      const err = new BridgeError(msg + ((j && j.detail && kind === 'invalid') ? ' (' + String(j.detail).slice(0, 140) + ')' : ''), kind, r.status);
      err.retryAfter = +r.headers.get('retry-after') || 0; throw err;
    }
    return r;
  },
  async ping() { return (await Bridge.req('/ping')).json(); },
  async clone(name, wavBuffers) {
    const f = new FormData(); f.append('name', name); f.append('consent', 'yes');
    wavBuffers.forEach((b, i) => f.append('sample' + i, new Blob([b], { type: 'audio/wav' }), 'ornek' + i + '.wav'));
    const j = await (await Bridge.req('/clone', { method: 'POST', form: f })).json();
    if (!j.voice_id) throw new BridgeError('Köprü ses kimliği döndürmedi.', 'invalid');
    return j.voice_id;
  },
  async tts(voiceId, text, o) {
    const r = await Bridge.req('/tts', { method: 'POST', json: Object.assign({ voice_id: voiceId, text }, o) });
    return { blob: await r.blob(), type: r.headers.get('content-type') || 'audio/mpeg' };
  },
  async stt(blob) {
    const f = new FormData(); f.append('file', blob, 'klip.wav');
    return String((await (await Bridge.req('/stt', { method: 'POST', form: f })).json()).text || '');
  },
  async del(voiceId) { return (await Bridge.req('/voice/' + encodeURIComponent(voiceId), { method: 'DELETE' })).json(); }
};

/* ---------- üretim varyantları ---------- */
function variants(cfg) {
  const m = cfg.model || 'eleven_multilingual_v2', flash = 'eleven_flash_v2_5';
  const first = { model: m, lang: m.includes('v2_5') ? 'tr' : null, suffix: '' };
  const second = m === flash ? { model: 'eleven_multilingual_v2', lang: null, suffix: '' } : { model: flash, lang: 'tr', suffix: '' };
  return [first, second, { model: m === flash ? 'eleven_multilingual_v2' : m, lang: null, suffix: '.' }];
}
const itemText = (it, v) => (it.kind === 'p' ? it.text : trLower(it.text)) + (v.suffix || '');
async function ttsOne(voiceId, it, cfg, vi) {
  const v = variants(cfg)[vi];
  return Bridge.tts(voiceId, itemText(it, v), { model: v.model, language: v.lang, speed: cfg.speed, stability: cfg.stability, similarity: cfg.similarity });
}
async function withRetry(fn, tries = 4) {
  for (let a = 0; ; a++) {
    try { return await fn(); }
    catch (e) {
      const retryable = e.kind === 'rate' || e.kind === 'network' || e.kind === 'server';
      if (!retryable || a >= tries - 1) throw e;
      await sleep(Math.max(e.retryAfter * 1000, TUNE.retryBaseMs * Math.pow(2, a)));
    }
  }
}

/* ---------- toplu üretim ---------- */
const GEN = { running: false, stop: false, done: 0, total: 0, fail: 0, failed: [], err: '', cur: '' };
async function genRun({ profId, voiceId, items, cfg, force, onProgress, onStored }) {
  if (GEN.running) return;
  Object.assign(GEN, { running: true, stop: false, done: 0, fail: 0, failed: [], err: '', cur: '' });
  const have = new Set(await DB.keys());
  const todo = items.filter(it => force || !have.has(vkey(it.key, profId)));
  GEN.total = todo.length; let idx = 0;
  const worker = async () => {
    while (!GEN.stop) {
      const i = idx++; if (i >= todo.length) break;
      const it = todo[i]; GEN.cur = it.text;
      try {
        const r = await withRetry(() => ttsOne(voiceId, it, cfg, 0));
        await DB.put(vkey(it.key, profId), { buf: await r.blob.arrayBuffer(), type: r.type, src: 'ai' });
        delete QC.map[profId + '|' + it.key];
        if (onStored) onStored(it.key);
        GEN.done++;
      } catch (e) {
        if (FATAL.includes(e.kind)) { GEN.err = e.message; GEN.stop = true; break; }
        GEN.fail++; GEN.failed.push(it.key);
      }
      if (onProgress) onProgress();
    }
  };
  await Promise.all(Array.from({ length: TUNE.gen }, worker));
  QC.save(); GEN.running = false; if (onProgress) onProgress(true);
}

/* ---------- YZ ile kalite kontrol ---------- */
const QC = { map: LS.get('qc', {}), save() { LS.set('qc', QC.map); } };
function qcOk(it, text) {
  const t = normTR(it.text), s = normTR(text);
  if (!s) return false;
  const m = sim(t, s);
  if (it.kind === 'y') return m >= 0.99 || (t.length >= 3 && m >= 0.65);
  return m >= 0.8;
}
const QCS = { running: false, stop: false, done: 0, total: 0, flag: 0, fixed: 0, err: '', cur: '' };
async function storeAi(profId, key, r) { await DB.put(vkey(key, profId), { buf: await r.blob.arrayBuffer(), type: r.type, src: 'ai' }); }
async function qcRun({ profId, voiceId, items, cfg, force, onProgress, onStored }) {
  if (QCS.running) return;
  Object.assign(QCS, { running: true, stop: false, done: 0, flag: 0, fixed: 0, err: '', cur: '' });
  const todo = [];
  for (const it of items) {
    const rec = await DB.get(vkey(it.key, profId));
    if (rec && rec.src === 'ai' && (force || QC.map[profId + '|' + it.key] !== 'ok')) todo.push(it);
  }
  QCS.total = todo.length; let idx = 0, since = 0;
  const worker = async () => {
    while (!QCS.stop) {
      const i = idx++; if (i >= todo.length) break;
      const it = todo[i]; QCS.cur = it.text; const mk = profId + '|' + it.key;
      try {
        const rec = await DB.get(vkey(it.key, profId));
        let ok = qcOk(it, await withRetry(() => Bridge.stt(new Blob([rec.buf], { type: rec.type }))));
        let fixed = false;
        for (let vi = 1; !ok && vi <= 2 && voiceId; vi++) {          // şüpheliyse farklı model/yazımla yeniden üret
          const r = await withRetry(() => ttsOne(voiceId, it, cfg, vi));
          const t = await withRetry(() => Bridge.stt(r.blob));
          if (qcOk(it, t)) { await storeAi(profId, it.key, r); if (onStored) onStored(it.key); ok = true; fixed = true; }
        }
        QC.map[mk] = ok ? 'ok' : 'flag';
        if (!ok) QCS.flag++; else if (fixed) QCS.fixed++;
      } catch (e) {
        if (FATAL.includes(e.kind)) { QCS.err = e.message; QCS.stop = true; break; }
      }
      QCS.done++;
      if (++since >= 25) { since = 0; QC.save(); }
      if (onProgress) onProgress();
    }
  };
  await Promise.all(Array.from({ length: TUNE.qc }, worker));
  QC.save(); QCS.running = false; if (onProgress) onProgress(true);
}
/* Tek öğeyi yeniden üret: sırayla varyantları dene, tanıma tutan ilkini kabul et. */
async function fixOne({ profId, voiceId, it, cfg, onStored }) {
  for (let vi = 0; vi < 3; vi++) {
    const r = await withRetry(() => ttsOne(voiceId, it, cfg, vi));
    const t = await withRetry(() => Bridge.stt(r.blob)).catch(() => null);
    const ok = t === null ? vi === 2 : qcOk(it, t);          // tanıma yoksa son denemeyi al
    if (ok || vi === 2) {
      await storeAi(profId, it.key, r); if (onStored) onStored(it.key);
      QC.map[profId + '|' + it.key] = ok ? 'ok' : 'flag'; QC.save(); return ok;
    }
  }
}

/* ---------- çocuğun konuşması (yumuşak sinyal) ---------- */
async function asrCheck(blob, target) {
  const text = await withRetry(() => Bridge.stt(blob), 2);
  const sm = sim(target.text, text);
  const cls = qcOk({ text: target.text, kind: target.kind === 'y' ? 'y' : 'w' }, text) ? 'match' : sm >= 0.5 ? 'near' : 'far';
  return { text, sim: sm, cls };
}
