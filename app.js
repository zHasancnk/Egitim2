/* Uygulama: yönlendirici + birey ekranları (sade, tek dokunuşlu).
   Kayıt yoksa robot ses YOK — ekranda nazik yönlendirme gösterilir. */
window.APP = (() => {
  const $ = (s) => document.querySelector(s);
  const ekran = () => document.getElementById('ekran');
  const rnd = (n) => Math.floor(Math.random() * n);
  const karistir = (d) => { d = d.slice(); for (let i = d.length - 1; i > 0; i--) { const j = rnd(i + 1); [d[i], d[j]] = [d[j], d[i]]; } return d; };

  let profil = 'Anne';
  let sayacTimer = null;

  function bilgi(mesaj) {
    const b = document.getElementById('bilgi');
    b.textContent = mesaj;
    b.classList.add('goster');
    clearTimeout(b._t);
    b._t = setTimeout(() => b.classList.remove('goster'), 2600);
  }

  function bugun() { return new Date().toISOString().slice(0, 10); }

  async function gunlukAl() {
    const g = (await DB.ayarAl('gunluk', {})) || {};
    if (!g[bugun()]) g[bugun()] = { sure: 0, dogru: 0, yanlis: 0 };
    return g;
  }
  async function gunlukIsle(dogruMu, sureEkle) {
    const g = await gunlukAl();
    const k = g[bugun()];
    if (dogruMu === true) k.dogru++;
    if (dogruMu === false) k.yanlis++;
    if (sureEkle) k.sure += sureEkle;
    await DB.ayarKoy('gunluk', g);
  }

  async function yildizVer() {
    const y = (await DB.ayarAl('yildiz', 0)) + 1;
    await DB.ayarKoy('yildiz', y);
    guncelleUst();
    return y;
  }

  async function guncelleUst() {
    document.getElementById('yildiz').textContent = '⭐ ' + (await DB.ayarAl('yildiz', 0));
  }

  function ustGoster(goster) {
    document.getElementById('ustbar').hidden = !goster;
  }

  function baslik(metin) { document.getElementById('baslik-orta').textContent = metin; }

  // Oturum sayacı (varsayılan 15 dk) + "Bugünlük bu kadar"
  async function sayaciBaslat() {
    clearInterval(sayacTimer);
    const dk = await DB.ayarAl('sureDk', 15);
    let kalan = dk * 60;
    const yaz = () => {
      const d = String(Math.floor(kalan / 60)).padStart(2, '0');
      const s = String(kalan % 60).padStart(2, '0');
      document.getElementById('sure').textContent = `⏱ ${d}:${s}`;
    };
    yaz();
    sayacTimer = setInterval(async () => {
      kalan--;
      if (kalan <= 0) {
        clearInterval(sayacTimer);
        await gunlukIsle(null, dk * 60);
        location.hash = '#/mola';
        return;
      }
      yaz();
    }, 1000);
  }

  function anaSayfaBtn(metin) {
    return `<button class="dugme" onclick="location.hash='#/ev'">⬅ Ana Sayfa</button>`;
  }

  async function kayitYokUyarisi(eksikAnahtar) {
    bilgi('Bu ses henüz kaydedilmedi. Ebeveyn panelinden kaydedin.');
  }

  // ---- EV ----
  async function ev() {
    ustGoster(true); baslik('☀️ Güneşim'); sayaciBaslat(); guncelleUst();
    const plan = await DB.ayarAl('plan', {});
    const hedef = plan.hedefSes ? `<p class="orta">🎯 Bu hafta: <b>${plan.hedefSes}</b></p>` : '';
    const ilgi = await DB.ayarAl('ilgi', '');
    ekran().innerHTML = `
      <div class="orta"><div class="buyuk-emoji">☀️</div>
      <h1>Merhaba!</h1><p>Ne oynamak istersin?</p>${hedef}${ilgi ? `<p class="orta">💛 Sevdiğin şey: <b>${ilgi}</b></p>` : ''}</div>
      <button class="kart yesil" data-kart="oku">📖<br>Oku<small>Fotoğraf + kelime + heceler</small></button>
      <button class="kart mavi" data-kart="yaz">✏️<br>Yaz<small>Parmakla harf izle</small></button>
      <button class="kart turuncu" data-kart="konus">🎤<br>Konuş<small>Dinle, tekrar et</small></button>
      <button class="kart mor" data-kart="gunluk">🧼<br>Günlük Hayat<small>El yıkama, diş, okul</small></button>
      <div class="satir"><button class="dugme" id="ebeveynBtn">👨‍👩‍👧 Ebeveyn</button></div>`;
    const adlar = { oku: 'Oku', yaz: 'Yaz', konus: 'Konuş', gunluk: 'Günlük Hayat' };
    document.querySelectorAll('[data-kart]').forEach((b) => {
      b.addEventListener('click', async () => {
        // Kutu adını profili sesiyle söyle (kayıtlıysa)
        const ok = await SES.anahtarCal(profil, 'kutu_' + b.dataset.kart);
        if (!ok) bilgi(adlar[b.dataset.kart] + ' açılıyor...');
        location.hash = '#/' + b.dataset.kart;
      });
    });
    document.getElementById('ebeveynBtn').addEventListener('click', () => { location.hash = '#/ebeveyn'; });
    await SES.anahtarCal(profil, 'ak_merhaba');
  }

  // ---- OKU ----
  const kelimeler = () => ICERIK.gruplar.find((g) => g.id === 'kelime').ogeler;
  async function oku() {
    ustGoster(true); baslik('📖 Oku');
    const havuz = kelimeler();
    const plan = await DB.ayarAl('plan', {});
    let liste = havuz.slice();
    if (plan.hedefKelime) {
      const h = havuz.find((k) => k.metin === plan.hedefKelime);
      if (h) liste = [h, h, ...karistir(havuz.filter((k) => k !== h))].slice(0, 6);
    } else {
      liste = karistir(liste).slice(0, 6);
    }
    let i = 0;
    async function sor() {
      const k = liste[i % liste.length];
      ekran().innerHTML = `
        <div class="orta"><div class="buyuk-emoji">${k.foto}</div>
        <h1>${k.metin}</h1>
        <div id="heceler"></div>
        <div class="satir" style="justify-content:center">
          <button class="dugme birincil" id="dinleBtn">🔊 Dinle</button>
          <button class="dugme mavi" id="heceleBtn">🔡 Hecele</button>
        </div>
        <h2>Fotoğrafı bul:</h2><div id="sec"></div></div>
        ${anaSayfaBtn()}`;
      const heceAlani = document.getElementById('heceler');
      async function kelimeyiSoyle() {
        const ok = await SES.anahtarCal(profil, k.anahtar);
        if (!ok) kayitYokUyarisi(k.anahtar);
      }
      document.getElementById('dinleBtn').addEventListener('click', kelimeyiSoyle);
      document.getElementById('heceleBtn').addEventListener('click', async () => {
        heceAlani.innerHTML = '';
        const heceAnahtarlar = (k.heceler || []).map((h, n) => `${k.anahtar}_hec${n}`);
        for (let n = 0; n < (k.heceler || []).length; n++) {
          const s = document.createElement('span');
          s.className = 'hece' + (n === 0 ? ' aktif' : '');
          s.textContent = k.heceler[n];
          heceAlani.appendChild(s);
          const ok = await SES.anahtarCal(profil, heceAnahtarlar[n]);
          if (!ok) { kayitYokUyarisi(heceAnahtarlar[n]); break; }
          [...heceAlani.children].forEach((c) => c.classList.remove('aktif'));
          if (heceAlani.children[n + 1]) heceAlani.children[n + 1].classList.add('aktif');
          else s.classList.add('aktif');
        }
      });
      // Eşleştirme: doğru foto + zorluğa göre çeldirici (1:2, 2:3, 3:4 seçenek)
      const zorluk = await DB.ayarAl('zorluk', 2);
      const celdir = karistir(havuz.filter((x) => x !== k)).slice(0, Math.max(1, Math.min(3, zorluk)));
      const sec = karistir([k, ...celdir]);
      const alan = document.getElementById('sec');
      sec.forEach((s) => {
        const b = document.createElement('button');
        b.className = 'sec';
        b.innerHTML = `<span style="font-size:3rem">${s.foto}</span>`;
        b.addEventListener('click', async () => {
          if (s === k) {
            b.classList.add('dogru');
            await SES.anahtarCal(profil, 'gb_harika');
            await yildizVer();
            await gunlukIsle(true, 0);
            bilgi('🎉 +1 ⭐');
            i++;
            setTimeout(sor, 900);
          } else {
            b.classList.add('yanlis');
            await SES.anahtarCal(profil, 'gb_birdaha');
            await gunlukIsle(false, 0);
          }
        });
        alan.appendChild(b);
      });
      await kelimeyiSoyle();
    }
    sor();
  }

  // ---- YAZ (parmakla izleme + boşluk doldurma) ----
  async function yaz() {
    ustGoster(true); baslik('✏️ Yaz');
    const havuz = kelimeler();
    const k = havuz[rnd(havuz.length)];
    const harf = k.metin[0].toLocaleUpperCase('tr');
    ekran().innerHTML = `
      <div class="orta"><h1>${harf} harfini izle 👆</h1>
      <p>${k.foto} ${k.metin}</p></div>
      <canvas id="iz" class="izleme" width="500" height="320"></canvas>
      <div class="satir">
        <button class="dugme birincil" id="dinleBtn">🔊 Dinle</button>
        <button class="dugme" id="temizleBtn">🧽 Temizle</button>
        <button class="dugme mavi" id="olduBtn">✅ Oldu</button>
      </div>
      <div class="orta"><h2>Boşluğu doldur:</h2><div id="bos"></div></div>
      ${anaSayfaBtn()}`;
    const cv = document.getElementById('iz');
    const ctx = cv.getContext('2d');
    // Harf kılavuzu (soluk)
    function kilavuz() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.font = 'bold 240px "Segoe UI", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#E8E0CC';
      ctx.fillText(harf, cv.width / 2, cv.height / 2 + 10);
    }
    kilavuz();
    ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.strokeStyle = '#2E7D32';
    let ciziyor = false, cizgiUzunlugu = 0, sonNokta = null;
    function nokta(e) {
      const r = cv.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      return [(t.clientX - r.left) * (cv.width / r.width), (t.clientY - r.top) * (cv.height / r.height)];
    }
    cv.addEventListener('pointerdown', (e) => { ciziyor = true; sonNokta = nokta(e); cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => {
      if (!ciziyor) return;
      const [x, y] = nokta(e);
      ctx.beginPath(); ctx.moveTo(sonNokta[0], sonNokta[1]); ctx.lineTo(x, y); ctx.stroke();
      cizgiUzunlugu += Math.hypot(x - sonNokta[0], y - sonNokta[1]);
      sonNokta = [x, y];
    });
    const bitir = () => { ciziyor = false; };
    cv.addEventListener('pointerup', bitir);
    cv.addEventListener('pointercancel', bitir);
    document.getElementById('temizleBtn').addEventListener('click', () => { kilavuz(); cizgiUzunlugu = 0; });
    document.getElementById('dinleBtn').addEventListener('click', async () => {
      const ok = await SES.anahtarCal(profil, k.anahtar);
      if (!ok) kayitYokUyarisi(k.anahtar);
    });
    document.getElementById('olduBtn').addEventListener('click', async () => {
      if (cizgiUzunlugu > 150) {
        await SES.anahtarCal(profil, 'gb_aferin');
        await yildizVer(); await gunlukIsle(true, 0);
        bilgi('🎉 +1 ⭐');
      } else {
        await SES.anahtarCal(profil, 'gb_guzelbirdaha');
        bilgi('Parmağınla üstünden geç! 👆');
      }
    });
    // Boşluk doldurma: kelimenin ilk harfi yok
    const gizli = '_' + k.metin.slice(1);
    const alan = document.getElementById('bos');
    alan.innerHTML = `<p style="font-size:2.2rem;letter-spacing:0.4rem">${gizli}</p>`;
    const zorlukY = await DB.ayarAl('zorluk', 2);
    const aday = karistir('ABCÇDEFG'.split('').filter((h) => h !== k.metin[0])).slice(0, Math.max(1, Math.min(3, zorlukY)));
    const sec = karistir([k.metin[0], ...aday]);
    sec.forEach((h) => {
      const b = document.createElement('button');
      b.className = 'sec'; b.textContent = h.toLocaleUpperCase('tr');
      b.addEventListener('click', async () => {
        if (h === k.metin[0]) {
          b.classList.add('dogru');
          await SES.anahtarCal(profil, 'gb_super');
          await yildizVer(); await gunlukIsle(true, 0);
          bilgi('🎉 +1 ⭐');
          setTimeout(yaz, 1200);
        } else {
          b.classList.add('yanlis');
          await SES.anahtarCal(profil, 'gb_birdaha');
          await gunlukIsle(false, 0);
        }
      });
      alan.appendChild(b);
    });
  }

  // ---- KONUŞ (model + tekrar + yan yana dinleme, skor YOK) ----
  async function konus() {
    ustGoster(true); baslik('🎤 Konuş');
    const havuz = kelimeler();
    const k = havuz[rnd(havuz.length)];
    ekran().innerHTML = `
      <div class="orta"><div class="buyuk-emoji">${k.foto}</div>
      <h1>${k.metin}</h1>
      <div class="satir" style="justify-content:center">
        <button class="dugme birincil" id="modelBtn">🔊 Dinle</button>
        <button class="dugme mor" id="soyleBtn">🎤 Söyle</button>
      </div>
      <div id="karsilastir"></div></div>
      ${anaSayfaBtn()}`;
    document.getElementById('modelBtn').addEventListener('click', async () => {
      const ok = await SES.anahtarCal(profil, k.anahtar);
      if (!ok) kayitYokUyarisi(k.anahtar);
    });
    document.getElementById('soyleBtn').addEventListener('click', async () => {
      const alan = document.getElementById('karsilastir');
      alan.innerHTML = '<p>Dinliyorum... 👂</p>';
      try {
        const { blob } = await SES.kayitYap(4, null);
        const id = await DB.ekle('cocuk', { blob, hedef: k.metin, tarih: Date.now() });
        alan.innerHTML = `
          <div class="kutu"><p><b>Model (aile):</b></p>
            <button class="dugme birincil" id="mBtn">▶ Dinle</button></div>
          <div class="kutu"><p><b>Benim sesim:</b></p>
            <button class="dugme mavi" id="bBtn">▶ Dinle</button></div>
          <p class="kucuk">İkisini de dinledin mi? Ebeveyninle konuşun. 💛</p>`;
        document.getElementById('mBtn').addEventListener('click', async () => {
          const ok = await SES.anahtarCal(profil, k.anahtar);
          if (!ok) kayitYokUyarisi(k.anahtar);
        });
        document.getElementById('bBtn').addEventListener('click', () => SES.blobCal(blob));
        await SES.anahtarCal(profil, 'gb_guzelbirdaha');
        await yildizVer(); await gunlukIsle(true, 0);
      } catch (e) {
        alan.innerHTML = '<p>Ses alınamadı. Mikrofona izin verin ve tekrar deneyin.</p>';
      }
    });
    const ok = await SES.anahtarCal(profil, k.anahtar);
    if (!ok) kayitYokUyarisi(k.anahtar);
  }

  // ---- GÜNLÜK HAYAT ----
  const rutinSetler = [
    { baslik: 'Ellerimizi yıkayalım', emoji: '🧼', adimlar: ['gr_el1', 'gr_el2', 'gr_el3'] },
    { baslik: 'Dişimizi fırçalayalım', emoji: '🪥', adimlar: ['gr_dis1', 'gr_dis2', 'gr_dis3'] },
    { baslik: 'Okula hazırlanalım', emoji: '🎒', adimlar: ['gr_okul1', 'gr_okul2', 'gr_okul3'] }
  ];
  function rutinMetin(anahtar) {
    for (const g of ICERIK.gruplar) for (const o of g.ogeler) if (o.anahtar === anahtar) return o;
    return null;
  }
  async function gunluk() {
    ustGoster(true); baslik('🧼 Günlük Hayat');
    const r = rutinSetler[rnd(rutinSetler.length)];
    let html = `<div class="orta"><div class="buyuk-emoji">${r.emoji}</div><h1>${r.baslik}</h1>`;
    r.adimlar.forEach((a, n) => {
      const o = rutinMetin(a);
      html += `<div class="kutu"><b>${n + 1}.</b> ${o.foto} ${o.metin}
        <button class="dugme" data-adim="${a}" style="margin-top:0.4rem">🔊 Dinle</button></div>`;
    });
    html += `<h2>İlk önce ne yaparız?</h2><div id="sec"></div>` + anaSayfaBtn() + `</div>`;
    ekran().innerHTML = html;
    document.querySelectorAll('[data-adim]').forEach((b) => {
      b.addEventListener('click', async () => {
        const ok = await SES.anahtarCal(profil, b.dataset.adim);
        if (!ok) kayitYokUyarisi(b.dataset.adim);
      });
    });
    const sec = karistir(r.adimlar.slice());
    const alan = document.getElementById('sec');
    sec.forEach((a) => {
      const o = rutinMetin(a);
      const b = document.createElement('button');
      b.className = 'sec'; b.textContent = `${o.foto} ${o.metin}`;
      b.addEventListener('click', async () => {
        if (a === r.adimlar[0]) {
          b.classList.add('dogru');
          await SES.anahtarCal(profil, 'gb_harika');
          await yildizVer(); await gunlukIsle(true, 0);
          bilgi('🎉 +1 ⭐');
          setTimeout(gunluk, 1200);
        } else {
          b.classList.add('yanlis');
          await SES.anahtarCal(profil, 'gb_birdaha');
          await gunlukIsle(false, 0);
        }
      });
      alan.appendChild(b);
    });
  }

  // ---- MOLA ----
  async function mola() {
    ustGoster(false);
    clearInterval(sayacTimer);
    ekran().innerHTML = `
      <div class="orta"><div class="buyuk-emoji">🧃</div>
      <h1>Bugünlük bu kadar! 🌙</h1>
      <p>Gözlerin dinlensin. Biraz su iç, hareket et. 💛</p>
      <button class="kart yesil" id="tekrarBtn">▶<br>Tekrar Oyna</button></div>`;
    await SES.anahtarCal(profil, 'gb_bugunluk');
    document.getElementById('tekrarBtn').addEventListener('click', async () => {
      await DB.ayarKoy('sonMola', Date.now());
      location.hash = '#/ev';
    });
  }

  // ---- TANI (açılmama durumunda bakılır) ----
  async function tani() {
    ustGoster(false);
    const satirlar = [];
    const ekle = (k, v) => satirlar.push(`<div class="kutu"><b>${k}:</b> ${v}</div>`);
    ekle('Adres', location.href);
    ekle('Güvenli bağlantı', (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'evet ✅ (mikrofon çalışır)' : 'HAYIR ❌ — mikrofon için HTTPS gerekir');
    try {
      const kayitli = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
      ekle('Service worker', kayitli ? 'kayıtlı ✅' : 'yok (ilk açılışta normal)');
    } catch (e) { ekle('Service worker', 'bakılamadı'); }
    try {
      await DB.ayarKoy('_tani', 1);
      const ok = (await DB.ayarAl('_tani', 0)) === 1;
      ekle('Kalıcı depolama (IndexedDB)', ok ? (DB.bellekModu() ? 'BELLEK MODU ⚠️ (gizli mod? kayıtlar sekmede silinir)' : 'çalışıyor ✅') : 'BOZUK ❌');
    } catch (e) { ekle('Kalıcı depolama (IndexedDB)', 'BOZUK ❌'); }
    ['ICERIK', 'DB', 'SES', 'ZIP', 'APP', 'PANEL'].forEach((ad) => {
      ekle('JS modülü ' + ad, typeof window[ad] !== 'undefined' ? 'yüklendi ✅' : 'YÜKLENEMEDİ ❌');
    });
    ekle('Mikrofon kaydı', SES.DESTEK ? 'destekleniyor ✅' : 'desteklenmiyor ❌ (güncel Chrome/Safari kullanın)');
    ekle('Tarayıcı', navigator.userAgent.slice(0, 90) + '…');
    ekran().innerHTML = `<div class="orta"><h1>🔧 Tanı</h1></div>` +
      satirlar.join('') +
      `<p class="kucuk">Bu ekranın fotoğrafını destek için gönderin.</p>` + anaSayfaBtn();
  }

  // ---- Yönlendirici ----
  const yollar = {
    '/ev': ev, '/oku': oku, '/yaz': yaz, '/konus': konus,
    '/gunluk': gunluk, '/mola': mola, '/tani': tani,
    '/ebeveyn': () => PANEL.ebeveyn(), '/kayit': () => PANEL.kayit()
  };

  async function yonlendir() {
    profil = await DB.ayarAl('aktifProfil', 'Anne');
    const yol = (location.hash || '#/ev').replace('#', '');
    const fn = yollar[yol] || ev;
    try { await fn(); } catch (e) {
      ekran().innerHTML = `<div class="orta"><h1>Bir sorun oldu</h1>
        <p class="kucuk">${String(e).slice(0, 200)}</p>` + anaSayfaBtn() + `</div>`;
    }
    window.__uygulamaBasladi = true;
    window.scrollTo(0, 0);
  }

  function basla() {
    window.addEventListener('hashchange', yonlendir);
    DB.ayarAl('tema', 'yesil').then((t) => { try { PANEL.temaUygula(t); } catch (_) {} });
    yonlendir();
  }

  return { basla, bilgi, yildizVer, gunlukIsle, guncelleUst, profilAl: async () => profil,
           profilKoy: async (p) => { profil = p; await DB.ayarKoy('aktifProfil', p); } };
})();

document.addEventListener('DOMContentLoaded', () => APP.basla());
