/* IndexedDB katmanı: kayıtlar cihazda durur, sunucuya gitmez.
   Tablolar: kayitlar (profil:anahtar -> wav blob), cocuk (bireyin kayıtları),
   ayar (ad -> değer: profiller, aktifProfil, pin, tema, zorluk, plan, notlar, gunluk). */
window.DB = (() => {
  const AD = 'gunesim-db', SURUM = 1;
  let db = null;
  // Bellek yedeği: IndexedDB kapalıysa (gizli mod vb.) uygulama yine açılır,
  // veriler sekme kapanınca silinir. Tanı ekranında "bellek" yazar.
  let sadeceBellek = false;
  const bellek = { kayitlar: new Map(), ayar: new Map(), cocuk: new Map(), cocukId: 1 };

  function ac() {
    return new Promise((bitir, hata) => {
      if (db || sadeceBellek) return bitir(db);
      if (!('indexedDB' in window) || !window.indexedDB) {
        sadeceBellek = true;
        return bitir(null);
      }
      let istek;
      try {
        istek = indexedDB.open(AD, SURUM);
      } catch (e) {
        sadeceBellek = true;
        return bitir(null);
      }
      istek.onupgradeneeded = () => {
        const v = istek.result;
        if (!v.objectStoreNames.contains('kayitlar')) v.createObjectStore('kayitlar');
        if (!v.objectStoreNames.contains('cocuk')) v.createObjectStore('cocuk', { autoIncrement: true });
        if (!v.objectStoreNames.contains('ayar')) v.createObjectStore('ayar');
      };
      istek.onsuccess = () => { db = istek.result; bitir(db); };
      istek.onerror = () => hata(istek.error);
    });
  }

  function islem(tabla, kip, fn) {
    return ac().then((v) => {
      if (sadeceBellek || !v) return bellekIslem(tabla, fn);
      return new Promise((bitir, hata) => {
        let tx;
        try {
          tx = v.transaction(tabla, kip);
        } catch (e) {
          sadeceBellek = true;
          bitir(bellekIslem(tabla, fn));
          return;
        }
        let istek;
        try {
          istek = fn(tx.objectStore(tabla));
        } catch (e) {
          hata(e);
          return;
        }
        istek.onsuccess = () => bitir(istek.result);
        istek.onerror = () => hata(istek.error);
      });
    });
  }

  // fn: store yöntemini çağıran fonksiyon; bellek modunda yöntem adına göre çalışır.
  // Kullanılan yöntemler: put(deger, anahtar), get(anahtar), delete(anahtar),
  // getAll(), getAllKeys(), add(deger), clear()
  function bellekIslem(tabla, fn) {
    const depo = bellek[tablo];
    const sahte = {
      put: (deger, anahtar) => depo.set(anahtar, deger),
      get: (anahtar) => depo.get(anahtar),
      delete: (anahtar) => { depo.delete(anahtar); },
      getAll: () => [...depo.values()],
      getAllKeys: () => [...depo.keys()],
      add: (deger) => { const id = bellek.cocukId++; depo.set(id, deger); return id; },
      clear: () => depo.clear()
    };
    return Promise.resolve(fn(sahte));
  }

  const koy = (tablo, anahtar, deger) => islem(tablo, 'readwrite', (s) => s.put(deger, anahtar));
  const al = (tablo, anahtar) => islem(tablo, 'readonly', (s) => s.get(anahtar));
  const sil = (tablo, anahtar) => islem(tablo, 'readwrite', (s) => s.delete(anahtar));
  const tumu = (tablo) => islem(tablo, 'readonly', (s) => s.getAll());
  const anahtarlar = (tablo) => islem(tablo, 'readonly', (s) => s.getAllKeys());
  const ekle = (tablo, deger) => islem(tablo, 'readwrite', (s) => s.add(deger));
  const temizle = (tablo) => islem(tablo, 'readwrite', (s) => s.clear());

  async function ayarAl(ad, varsayilan) {
    const v = await al('ayar', ad);
    return v === undefined ? varsayilan : v;
  }
  const ayarKoy = (ad, deger) => koy('ayar', ad, deger);
  const bellekModu = () => sadeceBellek;

  return { ac, koy, al, sil, tumu, anahtarlar, ekle, temizle, ayarAl, ayarKoy, bellekModu };
})();
