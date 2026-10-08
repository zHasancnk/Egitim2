/* Ebeveyn/terapist paneli (PIN'li): ses kayıt stüdyosu, profiller,
   yedekleme (ZIP dışa/içe aktar), hedef+plan, ilerleme, tema/ilgi/zorluk, notlar.
   Değerlendirmeyi (TEDİL/TODİL, SST) UZMAN yapar; uygulama puanlamaz. */
window.PANEL = (() => {
  const ekran = () => document.getElementById('ekran');
  const SIFRE = '1234';

  function tumOgeler() {
    // [{grup, anahtar, metin, foto}] + hece alt satırları
    const liste = [];
    for (const g of ICERIK.gruplar) {
      for (const o of g.ogeler) {
        liste.push({ grup: g.baslik, anahtar: o.anahtar, metin: o.metin, foto: o.foto || '🔊' });
        (o.heceler || []).forEach((h, n) => {
          liste.push({ grup: g.baslik, anahtar: `${o.anahtar}_hec${n}`,
                       metin: `Hece: "${h}" (${o.metin})`, foto: o.foto || '🔡' });
        });
      }
    }
    return liste;
  }

  async function profilListesi() {
    let p = await DB.ayarAl('profiller', null);
    if (!p) { p = ['Anne', 'Baba', 'Terapist']; await DB.ayarKoy('profiller', p); }
    return p;
  }

  // ---- EBEVEYN GİRİŞ ----
  async function ebeveyn() {
    document.getElementById('ustbar').hidden = false;
    document.getElementById('baslik-orta').textContent = '👨‍👩‍👧 Ebeveyn';
    ekran().innerHTML = `
      <div class="orta"><h1>Ebeveyn Girişi</h1>
      <input type="password" id="pin" inputmode="numeric" placeholder="PIN (1234)" style="text-align:center"></div>
      <button class="kart mavi" id="girBtn">Giriş</button>
      ${anaSayfa()}`;
    document.getElementById('girBtn').addEventListener('click', async () => {
      const v = document.getElementById('pin').value;
      const kayitli = await DB.ayarAl('pin', SIFRE);
      if (v === kayitli) anaPanel();
      else APP.bilgi('PIN yanlış.');
    });
  }

  function anaSayfa() { return `<button class="dugme" onclick="location.hash='#/ev'">⬅ Ana Sayfa</button>`; }

  // ---- ANA PANEL ----
  async function anaPanel() {
    const g = await DB.tumu('ayar').catch(() => []);
    const sonYedek = await DB.ayarAl('sonYedek', 0);
    const gun = Math.floor((Date.now() - sonYedek) / 86400000);
    const yedekUyari = (!sonYedek || gun >= 7)
      ? `<div class="kutu" style="border-color:#B71C1C"><b>🔔 Yedek hatırlatma:</b> ${
          sonYedek ? `son yedek ${gun} gün önce` : 'hiç yedek alınmamış'
        }. Tarayıcı verisi silinirse kayıtlar gider — lütfen yedek alın.</div>` : '';
    ekran().innerHTML = `
      <div class="orta"><h1>👨‍👩‍👧 Ebeveyn Paneli</h1></div>${yedekUyari}
      <button class="kart mor" id="kBtn">🎙 Ses Kayıt Stüdyosu<small>Kayıt, dinleme, yeniden kaydet</small></button>
      <button class="kart mavi" id="pBtn">🎯 Hedef & Çalışma Planı<small>Hedef ses, kelime, notlar</small></button>
      <button class="kart yesil" id="iBtn">📊 İlerleme<small>Süre, doğru/yanlış, kayıtları dinleme</small></button>
      <button class="kart turuncu" id="yBtn">💾 Yedekleme<small>Dışa aktar / İçe aktar (ZIP)</small></button>
      <button class="kart koyu" id="aBtn">⚙️ Ayarlar<small>Tema, ilgi, zorluk, PIN</small></button>
      <div class="satir"><button class="dugme" id="taniBtn">🔧 Tanı (site açılmazsa bakın)</button></div>
      ${anaSayfa()}`;
    document.getElementById('kBtn').addEventListener('click', kayitEkrani);
    document.getElementById('pBtn').addEventListener('click', planEkrani);
    document.getElementById('iBtn').addEventListener('click', ilerlemeEkrani);
    document.getElementById('yBtn').addEventListener('click', yedekEkrani);
    document.getElementById('aBtn').addEventListener('click', ayarEkrani);
    document.getElementById('taniBtn').addEventListener('click', () => { location.hash = '#/tani'; });
  }

  // ---- KAYIT STÜDYOSU ----
  async function kayitEkrani() {
    const profs = await profilListesi();
    let aktif = await DB.ayarAl('aktifProfil', profs[0]);
    const ogeler = tumOgeler();
    async function kayitDurumu() {
      const anahtarlar = await DB.anahtarlar('kayitlar');
      const kume = new Set(anahtarlar);
      const o = {};
      ogeler.forEach((it) => { o[it.anahtar] = kume.has(aktif + ':' + it.anahtar); });
      return o;
    }
    async function ciz(rehberli) {
      const durum = await kayitDurumu();
      const biten = ogeler.filter((o) => durum[o.anahtar]).length;
      const yuzde = Math.round((biten / ogeler.length) * 100);
      let listeHtml = '';
      ogeler.forEach((o, n) => {
        listeHtml += `
        <div class="kutu" id="satir-${n}">
          <div class="kayit-satir"><span class="foto">${o.foto}</span>
            <span class="metin"><b>${o.metin}</b><br><span class="kucuk">${o.grup}</span></span>
            <span class="durum ${durum[o.anahtar] ? 'var' : 'yok'}" id="durum-${n}">
              ${durum[o.anahtar] ? '✅ var' : '⬜ yok'}</span></div>
          <div class="kayit-satir">
            <button class="dugme birincil" data-kaydet="${n}">● Kaydet</button>
            <button class="dugme" data-dinle="${n}">▶ Dinle</button>
            <button class="dugme mavi" data-yeniden="${n}">↻ Yeniden</button>
          </div>
          <div class="kucuk" id="bilgi-${n}"></div>
        </div>`;
      });
      ekran().innerHTML = `
        <div class="orta"><h1>🎙 Ses Kayıt Stüdyosu</h1></div>
        <label>Aktif ses profili (birey hangisini seviyorsa o)</label>
        <div class="satir" id="profSatir"></div>
        <div class="ilerleme"><div id="bar" style="width:${yuzde}%"></div></div>
        <p class="orta"><b>${biten}/${ogeler.length}</b> kayıt tamamlandı (%${yuzde})</p>
        <div class="kutu"><b>📏 Kayıt kuralları:</b> sessiz oda, mikrofon hep aynı
          mesafede (15-20 cm), sakin ve net ses. Kelimeyi tek başına okuyun,
          sonunda soru tonu yapmayın. Baş/son sessizlik otomatik kırpılır,
          ses seviyesi eşitlenir.</div>
        <div class="satir">
          <button class="dugme mor" id="rehberBtn">🧭 Rehberli kayıt (eksikleri sırayla)</button>
          <button class="dugme" id="geriBtn">⬅ Panele dön</button>
        </div>
        <div id="liste">${listeHtml}</div>
        <button class="dugme" id="geriBtn2">⬅ Panele dön</button>`;
      const ps = document.getElementById('profSatir');
      for (const p of profs) {
        const b = document.createElement('button');
        b.className = 'dugme' + (p === aktif ? ' birincil' : '');
        b.textContent = (p === aktif ? '✓ ' : '') + p;
        b.addEventListener('click', async () => {
          aktif = p;
          await DB.ayarKoy('aktifProfil', p);
          ciz(false);
        });
        ps.appendChild(b);
      }
      const profilEkle = document.createElement('button');
      profilEkle.className = 'dugme'; profilEkle.textContent = '+ Profil';
      profilEkle.addEventListener('click', async () => {
        const ad = prompt('Yeni profil adı (örn: Anneanne):');
        if (ad && ad.trim()) {
          profs.push(ad.trim());
          await DB.ayarKoy('profiller', profs);
          ciz(false);
        }
      });
      ps.appendChild(profilEkle);
      document.getElementById('geriBtn').addEventListener('click', anaPanel);
      document.getElementById('geriBtn2').addEventListener('click', anaPanel);
      document.getElementById('rehberBtn').addEventListener('click', () => rehberliKayit(aktif, ogeler));
      ekran().querySelectorAll('[data-kaydet],[data-yeniden]').forEach((b) => {
        b.addEventListener('click', () => tekKayit(aktif, ogeler, +b.dataset.kaydet ?? +b.dataset.yeniden, ciz));
      });
      ekran().querySelectorAll('[data-dinle]').forEach((b) => {
        b.addEventListener('click', async () => {
          const o = ogeler[+b.dataset.dinle];
          const ok = await SES.anahtarCal(aktif, o.anahtar);
          if (!ok) APP.bilgi('Kayıt yok — önce Kaydet.');
        });
      });
    }
    ciz(false);
  }

  async function tekKayit(aktif, ogeler, n, tazele) {
    if (!SES.DESTEK) { APP.bilgi('Bu tarayıcı kaydı desteklemiyor. Chrome/Safari güncel sürüm kullanın.'); return; }
    const o = ogeler[n];
    const bilgiEl = document.getElementById('bilgi-' + n);
    const sure = Math.min(8, Math.max(3, o.metin.length / 9 + 2));
    try {
      bilgiEl.textContent = 'Hazırlan... birazdan OKU!';
      await new Promise((r) => setTimeout(r, 1200));
      bilgiEl.textContent = '🔴 OKU: "' + o.metin + '"';
      const { blob, sure: sn } = await SES.kayitYap(sure, (k) => {
        bilgiEl.textContent = '🔴 Kaydediliyor... %' + Math.round(k * 100);
      });
      await DB.koy('kayitlar', aktif + ':' + o.anahtar, { blob, sure: sn, tarih: Date.now() });
      bilgiEl.textContent = `Kaydedildi ✅ (${sn.toFixed(1)} sn) — dinleniyor...`;
      await SES.anahtarCal(aktif, o.anahtar);
      if (tazele) tazele(false);
      else bilgiEl.textContent += ' Onaylıyorsanız sonrakine geçin.';
    } catch (e) {
      bilgiEl.textContent = 'Kayıt alınamadı: mikrofona izin verin ve tekrar deneyin.';
    }
  }

  async function rehberliKayit(aktif, ogeler) {
    const anahtarlar = await DB.anahtarlar('kayitlar');
    const kume = new Set(anahtarlar);
    const eksikler = ogeler.filter((o) => !kume.has(aktif + ':' + o.anahtar));
    if (!eksikler.length) { APP.bilgi('Bu profilde tüm kayıtlar tamam! 🎉'); return; }
    let i = 0;
    async function adim() {
      const o = eksikler[i];
      ekran().innerHTML = `
        <div class="orta"><h1>🧭 Rehberli kayıt ${i + 1}/${eksikler.length}</h1>
        <div class="buyuk-emoji">${o.foto}</div>
        <h1>"${o.metin}"</h1>
        <p class="kucuk">${o.grup}</p>
        <div class="ilerleme"><div style="width:${Math.round((i / eksikler.length) * 100)}%"></div></div>
        <p id="dur">Hazır olunca Kaydet'e basın.</p></div>
        <button class="kart yesil" id="kBtn2">● Kaydet ve Dinle</button>
        <div class="satir">
          <button class="dugme" id="atlaBtn">⏭ Atla</button>
          <button class="dugme" id="bitirBtn">⬅ Listeye dön</button>
        </div>`;
      document.getElementById('bitirBtn').addEventListener('click', kayitEkrani);
      document.getElementById('atlaBtn').addEventListener('click', () => { i++; i < eksikler.length ? adim() : kayitEkrani(); });
      document.getElementById('kBtn2').addEventListener('click', async () => {
        const dur = document.getElementById('dur');
        if (!SES.DESTEK) { APP.bilgi('Tarayıcı kaydı desteklemiyor.'); return; }
        try {
          dur.textContent = '🔴 OKU: "' + o.metin + '"';
          const sure = Math.min(8, Math.max(3, o.metin.length / 9 + 2));
          const { blob, sure: sn } = await SES.kayitYap(sure, null);
          await DB.koy('kayitlar', aktif + ':' + o.anahtar, { blob, sure: sn, tarih: Date.now() });
          dur.textContent = 'Dinleyin, beğenmediyseniz tekrar kaydedin:';
          await SES.anahtarCal(aktif, o.anahtar);
          ekran().insertAdjacentHTML('beforeend', `
            <div class="satir">
              <button class="dugme birincil" id="onayBtn">✅ Onayla, devam et</button>
              <button class="dugme mavi" id="tekrarBtn2">↻ Beğenmedim, tekrar</button>
            </div>`);
          document.getElementById('onayBtn').addEventListener('click', () => { i++; i < eksikler.length ? adim() : kayitEkrani(); });
          document.getElementById('tekrarBtn2').addEventListener('click', adim);
        } catch (e) { dur.textContent = 'Kayıt alınamadı, tekrar deneyin.'; }
      });
    }
    adim();
  }

  // ---- HEDEF & PLAN ----
  async function planEkrani() {
    const plan = (await DB.ayarAl('plan', {})) || {};
    const kelimeler = ICERIK.gruplar.find((g) => g.id === 'kelime').ogeler;
    ekran().innerHTML = `
      <div class="orta"><h1>🎯 Hedef & Çalışma Planı</h1></div>
      <div class="kutu"><b>Uzman notu:</b> TEDİL/TODİL ve SST sonuçlarını
        uygulama üretmez — değerlendirmeyi uzman yapar, hedefi siz girersiniz.</div>
      <label>Hedef ses (örn: /s/ kelime başı)</label>
      <select id="hedefSes"><option value="">— seçin —</option>
        ${ICERIK.hedefSesler.map((h) => `<option ${plan.hedefSes === h ? 'selected' : ''}>${h}</option>`).join('')}</select>
      <label>Hedef kelime (bu hafta)</label>
      <select id="hedefKelime"><option value="">— seçin —</option>
        ${kelimeler.map((k) => `<option ${plan.hedefKelime === k.metin ? 'selected' : ''}>${k.metin}</option>`).join('')}</select>
      <label>TEDİL / TODİL sonucu</label>
      <textarea id="tedil" placeholder="Uzmanın yazdığı puan ve yorum">${plan.tedil || ''}</textarea>
      <label>SST gözlemi (hangi ses, baş/orta/son, tutarlı mı?)</label>
      <textarea id="sst" placeholder="Örn: /s/ kelime başında düşüyor, tutarlı">${plan.sst || ''}</textarea>
      <label>Kısa dönem hedef (2-4 hafta)</label>
      <textarea id="kisa" placeholder="Örn: /s/ başı 5 kelimede">${plan.kisa || ''}</textarea>
      <label>Uzun dönem hedef (3-6 ay)</label>
      <textarea id="uzun" placeholder="Örn: spontan cümlede /s/">${plan.uzun || ''}</textarea>
      <div class="satir"><button class="dugme birincil" id="kaydetBtn">💾 Kaydet</button>
      <button class="dugme" id="geriBtn">⬅ Panele dön</button></div>`;
    document.getElementById('geriBtn').addEventListener('click', anaPanel);
    document.getElementById('kaydetBtn').addEventListener('click', async () => {
      await DB.ayarKoy('plan', {
        hedefSes: document.getElementById('hedefSes').value,
        hedefKelime: document.getElementById('hedefKelime').value,
        tedil: document.getElementById('tedil').value,
        sst: document.getElementById('sst').value,
        kisa: document.getElementById('kisa').value,
        uzun: document.getElementById('uzun').value
      });
      APP.bilgi('Plan kaydedildi. ✅');
    });
  }

  // ---- İLERLEME ----
  async function ilerlemeEkrani() {
    const g = (await DB.ayarAl('gunluk', {})) || {};
    const gunler = Object.keys(g).sort().slice(-7).reverse();
    let satir = gunler.length ? '' : '<p>Kayıt yok.</p>';
    gunler.forEach((t) => {
      const k = g[t];
      const dk = Math.round(k.sure / 60);
      satir += `<div class="kutu"><b>${t}</b>: ${dk} dk, ✅ ${k.dogru}, ❌ ${k.yanlis}</div>`;
    });
    const yildiz = await DB.ayarAl('yildiz', 0);
    ekran().innerHTML = `
      <div class="orta"><h1>📊 İlerleme</h1>
      <p>⭐ Toplam yıldız: <b>${yildiz}</b></p></div>
      <h2>Son 7 gün</h2>${satir}
      <h2>🎤 Bireyin kendi kayıtları</h2><div id="cocuklar"></div>
      <button class="dugme" id="geriBtn">⬅ Panele dön</button>`;
    document.getElementById('geriBtn').addEventListener('click', anaPanel);
    const alan = document.getElementById('cocuklar');
    const ids = await DB.anahtarlar('cocuk');
    if (!ids.length) alan.innerHTML = '<p class="kucuk">Henüz kayıt yok. Konuş oyunundan eklenir.</p>';
    const son = ids.slice(-10).reverse();
    for (const id of son) {
      const k = await DB.al('cocuk', id);
      if (!k) continue;
      const d = document.createElement('div');
      d.className = 'kutu';
      const t = new Date(k.tarih).toLocaleString('tr-TR');
      d.innerHTML = `<b>${k.hedef || ''}</b> <span class="kucuk">${t}</span><br>`;
      const dinle = document.createElement('button');
      dinle.className = 'dugme mavi'; dinle.textContent = '▶ Dinle';
      dinle.addEventListener('click', () => SES.blobCal(k.blob));
      const sil = document.createElement('button');
      sil.className = 'dugme tehlike'; sil.textContent = '🗑 Sil';
      sil.addEventListener('click', async () => {
        if (confirm('Silinsin mi?')) { await DB.sil('cocuk', id); ilerlemeEkrani(); }
      });
      d.appendChild(dinle); d.appendChild(document.createTextNode(' ')); d.appendChild(sil);
      alan.appendChild(d);
    }
  }

  // ---- YEDEKLEME ----
  async function yedekEkrani() {
    ekran().innerHTML = `
      <div class="orta"><h1>💾 Yedekleme</h1></div>
      <div class="kutu">Kayıtlar <b>bu cihaza özeldir</b> — telefondaki ses bilgisayarda
        görünmez. Taşımak için ZIP dışa aktarın, diğer cihazda içe aktarın.
        Hesap sistemi yoktur; verileriniz sizde kalır.</div>
      <button class="kart yesil" id="disBtn">📤 Dışa aktar (ZIP indir)</button>
      <button class="kart mavi" id="icBtn">📥 İçe aktar (ZIP yükle)</button>
      <input type="file" id="dosya" accept=".zip" hidden>
      <button class="dugme" id="geriBtn">⬅ Panele dön</button>`;
    document.getElementById('geriBtn').addEventListener('click', anaPanel);
    document.getElementById('disBtn').addEventListener('click', async () => {
      APP.bilgi('Yedek hazırlanıyor...');
      const dosyalar = [];
      const anahtarlar = await DB.anahtarlar('kayitlar');
      for (const k of anahtarlar) {
        const r = await DB.al('kayitlar', k);
        if (r && r.blob) {
          dosyalar.push({ ad: 'kayit/' + String(k).replace(':', '/') + '.wav',
                          veri: new Uint8Array(await r.blob.arrayBuffer()) });
        }
      }
      const ids = await DB.anahtarlar('cocuk');
      const cocukMeta = [];
      for (const id of ids) {
        const c = await DB.al('cocuk', id);
        if (c && c.blob) {
          dosyalar.push({ ad: 'cocuk/' + id + '.wav',
                          veri: new Uint8Array(await c.blob.arrayBuffer()) });
          cocukMeta.push({ id, hedef: c.hedef, tarih: c.tarih });
        }
      }
      const ayarlar = {};
      for (const a of ['profiller', 'aktifProfil', 'pin', 'plan', 'yildiz', 'gunluk', 'tema', 'ilgi', 'zorluk', 'sureDk']) {
        ayarlar[a] = await DB.ayarAl(a, null);
      }
      const meta = { uygulama: 'gunesim', surum: 1, tarih: Date.now(), cocukMeta };
      dosyalar.push({ ad: 'yedek.json',
        veri: new TextEncoder().encode(JSON.stringify({ ayarlar, meta })) });
      const zip = ZIP.yaz(dosyalar);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(zip);
      a.download = 'gunesim-yedek-' + new Date().toISOString().slice(0, 10) + '.zip';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      await DB.ayarKoy('sonYedek', Date.now());
      APP.bilgi('Yedek indirildi. ✅');
    });
    const girdi = document.getElementById('dosya');
    document.getElementById('icBtn').addEventListener('click', () => girdi.click());
    girdi.addEventListener('change', async () => {
      if (!girdi.files.length) return;
      try {
        const girisler = await ZIP.oku(girdi.files[0]);
        let n = 0;
        for (const e of girisler) {
          if (e.ad === 'yedek.json') {
            const y = JSON.parse(new TextDecoder().decode(e.veri));
            for (const k of Object.keys(y.ayarlar || {})) {
              if (y.ayarlar[k] !== null) await DB.ayarKoy(k, y.ayarlar[k]);
            }
            for (const c of (y.meta && y.meta.cocukMeta) || []) {
              const wav = girisler.find((x) => x.ad === 'cocuk/' + c.id + '.wav');
              if (wav) await DB.ekle('cocuk', { blob: new Blob([wav.veri], { type: 'audio/wav' }), hedef: c.hedef, tarih: c.tarih });
            }
          } else if (e.ad.startsWith('kayit/') && e.ad.endsWith('.wav')) {
            const parca = e.ad.slice(6, -4).split('/');
            const profil = parca.slice(0, -1).join('/') || 'Anne';
            const anahtar = parca[parca.length - 1];
            await DB.koy('kayitlar', profil + ':' + anahtar,
              { blob: new Blob([e.veri], { type: 'audio/wav' }), sure: 0, tarih: Date.now() });
            n++;
          }
        }
        APP.bilgi(`${n} kayıt içe aktarıldı. ✅`);
      } catch (e) {
        APP.bilgi('ZIP okunamadı. Bu uygulamadan alınmış yedek olmalı.');
      }
      girdi.value = '';
    });
  }

  // ---- AYARLAR ----
  async function ayarEkrani() {
    const tema = await DB.ayarAl('tema', 'yesil');
    const ilgi = await DB.ayarAl('ilgi', '');
    const zorluk = await DB.ayarAl('zorluk', 2);
    const sureDk = await DB.ayarAl('sureDk', 15);
    ekran().innerHTML = `
      <div class="orta"><h1>⚙️ Ayarlar</h1></div>
      <label>Tema rengi</label>
      <select id="tema">
        <option value="yesil" ${tema === 'yesil' ? 'selected' : ''}>Yeşil</option>
        <option value="mavi" ${tema === 'mavi' ? 'selected' : ''}>Mavi</option>
        <option value="turuncu" ${tema === 'turuncu' ? 'selected' : ''}>Turuncu</option>
      </select>
      <label>İlgi alanı (bireyin sevdiği şey)</label>
      <input type="text" id="ilgi" value="${(ilgi || '').replace(/"/g, '&quot;')}" placeholder="Örn: dinozor, tren">
      <label>Zorluk seviyesi</label>
      <select id="zorluk">
        <option value="1" ${zorluk == 1 ? 'selected' : ''}>1 — Kolay (2 seçenek)</option>
        <option value="2" ${zorluk == 2 ? 'selected' : ''}>2 — Orta (3 seçenek)</option>
        <option value="3" ${zorluk == 3 ? 'selected' : ''}>3 — Zor (4 seçenek)</option>
      </select>
      <label>Oturum süresi (dakika)</label>
      <select id="sureDk">
        ${[10, 15, 20].map((d) => `<option value="${d}" ${sureDk == d ? 'selected' : ''}>${d} dakika</option>`).join('')}
      </select>
      <label>Ebeveyn PIN'i</label>
      <input type="text" id="pin" value="${await DB.ayarAl('pin', SIFRE)}" maxlength="12">
      <div class="satir"><button class="dugme birincil" id="kaydetBtn">💾 Kaydet</button>
      <button class="dugme" id="geriBtn">⬅ Panele dön</button></div>`;
    document.getElementById('geriBtn').addEventListener('click', anaPanel);
    document.getElementById('kaydetBtn').addEventListener('click', async () => {
      await DB.ayarKoy('tema', document.getElementById('tema').value);
      await DB.ayarKoy('ilgi', document.getElementById('ilgi').value.trim());
      await DB.ayarKoy('zorluk', +document.getElementById('zorluk').value);
      await DB.ayarKoy('sureDk', +document.getElementById('sureDk').value);
      const p = document.getElementById('pin').value.trim() || SIFRE;
      await DB.ayarKoy('pin', p);
      temaUygula(document.getElementById('tema').value);
      APP.bilgi('Ayarlar kaydedildi. ✅');
    });
  }

  function temaUygula(tema) {
    const renkler = { yesil: '#2E7D32', mavi: '#1565C0', turuncu: '#EF6C00' };
    document.documentElement.style.setProperty('--birincil', renkler[tema] || renkler.yesil);
    document.querySelector('meta[name="theme-color"]').setAttribute('content', renkler[tema] || renkler.yesil);
  }

  return { ebeveyn, kayit: kayitEkrani, temaUygula };
})();
