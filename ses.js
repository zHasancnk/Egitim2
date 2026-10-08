/* Ses katmanı: MediaRecorder ile kayıt (HTTPS gerekir — GitHub Pages sağlar),
   baştaki/sondaki sessizliği otomatik kırpma, ses seviyesi eşitleme,
   WAV kodlama (tüm tarayıcılarda ortak format), Web Audio ile çalma.
   Kayıt yoksa robot ses YOKTUR — ekranda nazik uyarı gösterilir. */
window.SES = (() => {
  let baglam = null;
  let oge = null; // hece vurgusu geri çağrısı
  const DESTEK = !!(navigator.mediaDevices && window.MediaRecorder);

  function ac() {
    if (!baglam) baglam = new (window.AudioContext || window.webkitAudioContext)();
    if (baglam.state === 'suspended') baglam.resume();
    return baglam;
  }

  async function kayitYap(sureSn, ilerleme) {
    if (!DESTEK) throw new Error('Bu tarayıcı kaydı desteklemiyor.');
    const akis = await navigator.mediaDevices.getUserMedia({ audio: true });
    try {
      // iPhone/Safari uyumu: desteklenen türü seç
      let tur = '';
      for (const t of ['audio/webm', 'audio/mp4', 'audio/ogg']) {
        if (window.MediaRecorder.isTypeSupported(t)) { tur = t; break; }
      }
      const kayitci = tur ? new MediaRecorder(akis, { mimeType: tur }) : new MediaRecorder(akis);
      const parcalar = [];
      kayitci.ondataavailable = (e) => { if (e.data.size) parcalar.push(e.data); };
      const bitti = new Promise((c) => { kayitci.onstop = c; });
      kayitci.start(250);
      const baslangic = Date.now();
      while (Date.now() - baslangic < sureSn * 1000) {
        if (ilerleme) ilerleme(Math.min(1, (Date.now() - baslangic) / (sureSn * 1000)));
        await new Promise((r) => setTimeout(r, 100));
      }
      kayitci.stop();
      await bitti;
      const ham = new Blob(parcalar, { type: kayitci.mimeType || 'audio/webm' });
      return await wavCevir(ham);
    } finally {
      akis.getTracks().forEach((t) => t.stop());
    }
  }

  async function wavCevir(blob) {
    const ctx = ac();
    const tampon = await blob.arrayBuffer();
    const ses = await ctx.decodeAudioData(tampon);
    const kanal = ses.getChannelData(0);
    const oran = ses.sampleRate;
    // Sessizlik kırp: tepenin %3'ü eşiği, 0.25 sn baş / 0.4 sn son payı
    let tepe = 0;
    for (let i = 0; i < kanal.length; i++) { const m = Math.abs(kanal[i]); if (m > tepe) tepe = m; }
    if (tepe < 0.01) throw new Error('sessiz');
    const esik = tepe * 0.03;
    let bas = 0;
    while (bas < kanal.length && Math.abs(kanal[bas]) < esik) bas++;
    let son = kanal.length - 1;
    while (son > bas && Math.abs(kanal[son]) < esik) son--;
    bas = Math.max(0, bas - Math.floor(0.25 * oran));
    son = Math.min(kanal.length - 1, son + Math.floor(0.4 * oran));
    const kirp = kanal.slice(bas, son + 1);
    // Seviye eşitle: tepeyi 0.89'a getir
    let tepe2 = 0;
    for (let i = 0; i < kirp.length; i++) { const m = Math.abs(kirp[i]); if (m > tepe2) tepe2 = m; }
    const kazanc = tepe2 > 0 ? 0.89 / tepe2 : 1;
    const pcm = new Int16Array(kirp.length);
    for (let i = 0; i < kirp.length; i++) {
      const v = Math.max(-1, Math.min(1, kirp[i] * kazanc));
      pcm[i] = Math.round(v * 32767);
    }
    return { blob: wavKodla(pcm, oran), sure: kirp.length / oran };
  }

  function wavKodla(pcm, oran) {
    const tampon = new ArrayBuffer(44 + pcm.length * 2);
    const g = new DataView(tampon);
    const yaz = (o, s) => { for (let i = 0; i < s.length; i++) g.setUint8(o + i, s.charCodeAt(i)); };
    yaz(0, 'RIFF'); g.setUint32(4, 36 + pcm.length * 2, true); yaz(8, 'WAVE');
    yaz(12, 'fmt '); g.setUint32(16, 16, true); g.setUint16(20, 1, true);
    g.setUint16(22, 1, true); g.setUint32(24, oran, true);
    g.setUint32(28, oran * 2, true); g.setUint16(32, 2, true); g.setUint16(34, 16, true);
    yaz(36, 'data'); g.setUint32(40, pcm.length * 2, true);
    for (let i = 0; i < pcm.length; i++) g.setInt16(44 + i * 2, pcm[i], true);
    return new Blob([tampon], { type: 'audio/wav' });
  }

  async function blobCal(blob, vurgu) {
    const ctx = ac();
    const ses = await ctx.decodeAudioData(await blob.arrayBuffer());
    const kaynak = ctx.createBufferSource();
    kaynak.buffer = ses;
    kaynak.connect(ctx.destination);
    kaynak.start();
    if (vurgu) vurgu();
    await new Promise((c) => { kaynak.onended = c; });
  }

  // Kayıtlı sesi çal; yoksa false döner (robot ses çalınmaz).
  async function anahtarCal(profil, anahtar) {
    const kayit = await DB.al('kayitlar', profil + ':' + anahtar);
    if (!kayit || !kayit.blob) return false;
    await blobCal(kayit.blob);
    return true;
  }

  // Sırayla çal (kelime -> heceler), her adımda vurgu geri çağrısı.
  async function siraCal(profil, anahtarlar, vurguCb) {
    for (let i = 0; i < anahtarlar.length; i++) {
      const ok = await anahtarCal(profil, anahtarlar[i]);
      if (!ok) return { tamam: false, eksik: anahtarlar[i] };
      if (vurguCb) vurguCb(i);
      await new Promise((r) => setTimeout(r, 180));
    }
    return { tamam: true };
  }

  return { DESTEK, kayitYap, wavKodla, blobCal, anahtarCal, siraCal, ac,
           vurgu: (fn) => { oge = fn; } };
})();
