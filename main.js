'use strict';
/* main.js — başlatma (en son yüklenir) */
async function autoPull(fromLink) {
  try {
    const c = await syncCheck();
    if (c.state === 'yok') { if (fromLink) toast('Köprü bağlandı ama sunucuda henüz paket yok. Ana cihazda "Sunucuya yükle" yapın.'); return; }
    if (c.state !== 'yeni') return;
    go('kur', { msg: 'Başlıyor…', pct: 0 });
    await syncPull((m, p) => { V.msg = m; V.pct = p; const a = el('kmsg'), b = el('kbar'); if (a) a.textContent = m; if (b) b.style.width = Math.round(p * 100) + '%'; });
    go('home'); toast('Sesler indirildi. Hazırız!');
  } catch (e) { go('home'); toast(e.message || 'Sesler indirilemedi.'); }
}
(async function init() {
  const fromLink = applySetupHash();
  rebuild(); CASE_MODE = S.cfg.casemode; SFX.on = S.cfg.sfx !== false;
  try { await DB.open(); await refreshRec(); await loadPhotos(); }
  catch (e) { toast('Bu tarayıcıda depolama kullanılamıyor (gizli sekme olabilir).'); }
  document.documentElement.style.setProperty('--accent', S.cfg.accent);
  render();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  /* Yeni cihaz: köprü bağlı ama hiç ses yok -> sunucudaki paketi indir */
  if (Bridge.ready() && recSet.size === 0 && !S.cfg.profiles.some(p => p.voiceId)) autoPull(fromLink);
})();
