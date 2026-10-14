'use strict';
/* sync.js — cihazlar arası aktarım.
   Ana cihazda üretilen sesler, fotoğraflar ve ayarlar köprüdeki depoya (Cloudflare KV) parçalar halinde yüklenir;
   telefon ve diğer cihazlar indirir. Ana cihazın açık olması gerekmez.
   AKTARILMAYANLAR: PIN, köprü parolası, ilerleme kayıtları, öğrencinin kendi kayıtları (her cihazda ayrı kalır). */

const SYNC = { running: false, msg: '', pct: 0, err: '' };
const SYNC_CFG = ['name', 'profiles', 'active', 'accent', 'min', 'levels', 'themes', 'hidden', 'casemode', 'asr', 'model', 'speed', 'stability', 'similarity', 'goal', 'sfx', 'unlockAll'];
const CHUNK_CHARS = 900000;          // parça başına yaklaşık 0,9 MB metin (KV değer sınırının çok altında)

const syncKeys = async () => (await DB.keys()).filter(k => typeof k === 'string' && (k.startsWith('v|') || k.startsWith('img|')));

async function syncPush(ui) {
  const keys = await syncKeys();
  if (!keys.length) throw new Error('Yüklenecek ses yok. Önce sesleri üretin.');
  let old = null;
  try { old = await Bridge.syncManifestGet(); } catch (e) { if (FATAL.includes(e.kind)) throw e; }
  const pack = 'p' + Date.now().toString(36), names = [];
  let buf = [], size = 0, n = 0, done = 0;
  const flush = async () => {
    if (!buf.length) return;
    const name = pack + '-' + (n++);
    await withRetry(() => Bridge.syncChunkPut(name, JSON.stringify(buf)));
    names.push(name); buf = []; size = 0;
  };
  for (const k of keys) {
    const r = await DB.get(k); if (!r) continue;
    const b64 = toB64(r.buf);
    buf.push([k, r.type, r.src || '', b64]); size += b64.length + k.length + 40;
    if (size >= CHUNK_CHARS) await flush();
    done++; ui('Yükleniyor… ' + done + ' / ' + keys.length, done / keys.length);
  }
  await flush();
  const cfg = {}; SYNC_CFG.forEach(k => { cfg[k] = S.cfg[k]; });
  /* Önceki paket hemen silinmez: KV'nin yayılması sürerken başka cihaz eski listeyi okuyabilir. İki nesil önceki parçalar silinir. */
  const prev = old && Array.isArray(old.chunks) ? old.chunks : [];
  await withRetry(() => Bridge.syncManifestPut({ v: 1, pack, t: Date.now(), count: done, chunks: names, prev, cfg, custom: S.custom, manual: [...MAN] }));
  if (old && Array.isArray(old.prev)) for (const nm of old.prev) { try { await Bridge.syncChunkDel(nm); } catch (e) { /* eski parça kalabilir; zararsız */ } }
  LS.set('sync', { pack, t: Date.now() });
  return { count: done, chunks: names.length };
}

async function syncPull(ui) {
  const m = await Bridge.syncManifestGet();
  if (!m || m.empty || !Array.isArray(m.chunks)) throw new Error('Sunucuda henüz paket yok. Önce ana cihazda "Sunucuya yükle" yapın.');
  const got = new Set(); let done = 0;
  for (const name of m.chunks) {
    let text = null;
    for (let a = 0; a < 9 && text === null; a++) {            // KV'nin yayılması 1-2 dk sürebilir
      try { text = await Bridge.syncChunkGet(name); }
      catch (e) {
        if (e.status !== 404 || a === 8) throw (e.status === 404 ? new Error('Sunucu verisi henüz yayılmadı. Yükledikten sonra 1-2 dakika bekleyip tekrar deneyin.') : e);
        ui('Sunucu verisi yayılıyor, bekleniyor…', done / Math.max(1, m.count)); await sleep(8000);
      }
    }
    for (const [k, type, src, b64] of JSON.parse(text)) {
      const rec = { type, buf: fromB64(b64) }; if (src) rec.src = src;
      await DB.put(k, rec); invalidate(k); got.add(k); done++;
    }
    ui('İndiriliyor… ' + done + ' / ' + m.count, done / Math.max(1, m.count));
  }
  for (const k of await syncKeys()) if (!got.has(k)) { invalidate(k); await DB.del(k); }     // sunucuda olmayan eski yerel kayıtlar kalkar
  SYNC_CFG.forEach(k => { if (m.cfg && k in m.cfg) S.cfg[k] = m.cfg[k]; });
  if (!S.cfg.profiles.some(p => p.id === S.cfg.active)) S.cfg.active = S.cfg.profiles[0].id;
  S.custom = m.custom || []; MAN = new Set(m.manual || []);
  saveCfg(); saveCustom(); saveMan(); CASE_MODE = S.cfg.casemode;
  urlCache.forEach(u => URL.revokeObjectURL(u)); urlCache.clear();
  rebuild(); await refreshRec(); await loadPhotos();
  LS.set('sync', { pack: m.pack, t: Date.now() });
  return { count: done };
}

/* Telefon için kurulum bağlantısı: köprü adresi ve parolası #kur= parçasında taşınır (sunucuya gitmez). */
const b64u = s => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const syncInfo = () => LS.get('sync', null);
/* Sunucudaki paketin durumu: 'yok' | 'ayni' | 'yeni' (sunucuda bu cihazda olmayan paket var) */
async function syncCheck() {
  const m = await Bridge.syncManifestGet();
  if (!m || m.empty) return { state: 'yok', m: null };
  const mine = syncInfo();
  return { state: mine && mine.pack === m.pack ? 'ayni' : 'yeni', m };
}
function qrSvg(text) {
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  return q.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
}
function setupLink() {
  const c = Bridge.cfg(); if (!c.url || !c.token) return '';
  return location.origin + location.pathname + '#kur=' + b64u(JSON.stringify({ u: c.url, t: c.token }));
}
function applySetupHash() {
  const m = /[#&]kur=([A-Za-z0-9_-]+)/.exec(location.hash || ''); if (!m) return false;
  try {
    let s = m[1].replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
    const o = JSON.parse(atob(s));
    if (o && o.u && o.t) { LS.set('bridge', { url: String(o.u), token: String(o.t) }); history.replaceState(null, '', location.pathname + location.search); return true; }
  } catch (e) { /* bozuk bağlantı: yok say */ }
  return false;
}

/* ---------- Yetişkin paneli: Cihazlar sekmesi ---------- */
async function syncRefresh() {
  V.sinfo = { loading: true }; if (V.name === 'panel' && V.tab === 'esitle') render();
  let info;
  try {
    const p = await Bridge.ping(); info = { kv: !!p.kv };
    if (p.kv) { const c = await syncCheck(); info.state = c.state; info.m = c.m; }
  } catch (e) { info = { err: e.message }; }
  V.sinfo = info; if (V.name === 'panel' && V.tab === 'esitle') render();
}
const fmtDate = t => { try { return new Date(t).toLocaleString('tr'); } catch (e) { return ''; } };
PANEL.esitle = () => {
  const ready = Bridge.ready(), si = V.sinfo || {}, link = ready ? setupLink() : '', busy = SYNC.running;
  const localN = [...recSet].length;
  let status = '';
  if (!ready) status = '<div class="warn">Önce <b>Ses</b> sekmesinde köprü adresi ve parolayı girin.</div>';
  else if (si.loading) status = '<p>Sunucu kontrol ediliyor…</p>';
  else if (si.err) status = `<div class="warn">${esc(si.err)}</div>`;
  else if (si.kv === false) status = `<div class="warn"><b>Bulut deposu (KV) bağlı değil.</b> Cloudflare'de bir KV oluşturup köprü Worker'ına <b>BO_KV</b> adıyla bağlayın, sonra Worker'ı yeniden Deploy edin. Adımlar README.md → "Cihazlar arası aktarım" bölümünde.</div>`;
  else if (si.state === 'yok') status = '<div class="warn">Sunucuda henüz paket yok. Sesleri üretip <b>Sunucuya yükle</b> deyin.</div>';
  else if (si.state === 'ayni') status = `<div class="good">✔ Bu cihaz sunucudakiyle aynı (${esc(fmtDate(si.m.t))}, ${si.m.count} dosya).</div>`;
  else if (si.state === 'yeni') status = `<div class="good">Sunucuda ${esc(fmtDate(si.m.t))} tarihli ${si.m.count} dosyalık paket var. Bu cihazda olmayan bir paket olabilir.</div>`;
  const can = ready && si.kv && !busy;
  return `<div class="box"><h3>Sesleri tüm cihazlarda kullan</h3>
    <p>Sesleri <b>bir kez</b> bu cihazda üretin, <b>Sunucuya yükle</b> deyin. Telefonda veya başka bir bilgisayarda aşağıdaki QR kodu okutup bağlantıyı açın; sesler kendiliğinden iner. Bu cihazın açık olması gerekmez; paket sizin Cloudflare hesabınızdaki depoda durur.</p>
    <p>Aktarılanlar: ses kayıtları, kelime fotoğrafları, ses profili, müfredat ve ayarlar. Aktarılmayanlar: PIN, köprü parolası (bağlantıyla ayrıca gelir), öğrencinin ilerlemesi ve kendi kayıtları.</p>
    ${status}
    <div class="kv"><div>Bu cihazdaki ses<b>${localN}</b></div><div>Son eşitleme<b style="font-size:1rem">${syncInfo() ? esc(fmtDate(syncInfo().t)) : '—'}</b></div></div>
    <div class="inline"><button class="btn primary" data-act="syncPush" ${can && localN ? '' : 'disabled'}>⬆ Sunucuya yükle</button><button class="btn" data-act="syncPull" ${can && si.state && si.state !== 'yok' ? '' : 'disabled'}>⬇ Sunucudan indir</button><button class="btn" data-act="syncRefresh" ${ready && !busy ? '' : 'disabled'}>↻ Durumu yenile</button></div>
    ${(busy || SYNC.msg) ? `<div class="progress"><i id="sync-bar" style="width:${Math.round(SYNC.pct * 100)}%"></i></div><p id="sync-txt">${esc(SYNC.msg)}</p>` : ''}
    ${SYNC.err ? `<div class="warn">${esc(SYNC.err)}</div>` : ''}</div>
  <div class="box"><h3>Telefonu bağla</h3>
    ${ready ? `<p>Telefonun kamerasıyla QR kodu okutun ya da bağlantıyı kendinize gönderip telefonda açın. Site açılınca sesler indirilir; sonra "Ana ekrana ekle" deyin.</p>
    <div style="width:min(70vw,260px);background:#fff;padding:6px;border:2px solid var(--line);border-radius:14px;margin:8px 0">${qrSvg(link)}</div>
    <div class="inline"><button class="btn" data-act="copyLink">Bağlantıyı kopyala</button></div>
    <div class="warn">Bu bağlantı köprü parolanızı içerir. Yalnızca kendi cihazlarınızda açın; başkasıyla paylaşmayın.</div>` : '<p>Önce köprü bağlantısını kurun.</p>'}</div>`;
};
function updSync() { const b = el('sync-bar'), t = el('sync-txt'); if (b) b.style.width = Math.round(SYNC.pct * 100) + '%'; if (t) t.textContent = SYNC.msg; }
const syncUi = (m, p) => { SYNC.msg = m; SYNC.pct = p; updSync(); };
ACT.syncRefresh = () => syncRefresh();
ACT.copyLink = async () => { try { await navigator.clipboard.writeText(setupLink()); toast('Bağlantı kopyalandı.'); } catch (e) { prompt('Bağlantıyı kopyalayın:', setupLink()); } };
async function syncRun(fn, okMsg) {
  if (SYNC.running) return; SYNC.running = true; SYNC.err = ''; SYNC.msg = 'Başlıyor…'; SYNC.pct = 0; render();
  try { const r = await fn(syncUi); SYNC.msg = okMsg(r); SYNC.pct = 1; toast(SYNC.msg); }
  catch (e) { SYNC.err = e.message || 'Aktarım başarısız.'; SYNC.msg = ''; }
  SYNC.running = false; await syncRefresh();
}
ACT.syncPush = () => {
  if (V.sinfo && V.sinfo.state === 'yeni' && !confirm('Sunucuda bu cihazda olmayan bir paket var. Yüklerseniz o paket bu cihazdakiyle değişir. Devam edilsin mi?')) return;
  syncRun(syncPush, r => 'Yüklendi: ' + r.count + ' dosya.');
};
ACT.syncPull = () => {
  if (!confirm('Bu cihazdaki sesler, fotoğraflar ve müfredat ayarları sunucudakiyle değiştirilecek. Öğrencinin ilerlemesi ve kayıtları kalır. Devam edilsin mi?')) return;
  syncRun(syncPull, r => 'İndirildi: ' + r.count + ' dosya.');
};
