# Web Sürümü (PWA) — Yayınlama ve Kullanım

Stajyer değil, **birincil ürün**: tamamen statik site, sunucu yok, internet
gerekmez (kurulumdan sonra), tüm sesler ailenin kendi kaydı.

## 1) GitHub'da yayınlama (5 dakika)

1. GitHub'da yeni **public** repo açın (örn. `gunesim-ogreniyor`).
   Public olması sorun değil: ses kayıtları repoda değil, cihazda durur.
   Çocuğun fotoğrafını ve adını repoya **koymayın** (uygulama zaten emoji kullanır).
2. Bu klasördeki her şeyi repoya yükleyin (`web/` + `.github/workflows/pages.yml`
   dahil — klasör yapısını aynen koruyun).
3. Repo → **Settings → Pages → Source: GitHub Actions** seçin.
4. `main` dalına her push'ta site otomatik yayınlanır:
   `https://<kullanıcı-adı>.github.io/<repo-adı>/`
5. Telefondan ve bilgisayardan bu linki açın → tarayıcı menüsü →
   **"Ana ekrana ekle"** → uygulama gibi kurulur, sonra internetsiz çalışır.

## 2) İlk kurulum (ebeveyn, ~30-40 dakika)

1. Ebeveyn paneli → PIN: `1234` (Ayarlar'dan değiştirin).
2. **Ses Kayıt Stüdyosu** → profili seçin (Anne/Baba/Terapist, + ile eklenir).
3. **Rehberli kayıt** ile 71 satırı sırayla okuyun: sessiz oda, mikrofona
   15-20 cm, sakin net ses, kelimeyi tek başına (soru tonu yapmadan).
   Dinleyin → beğenmediyseniz yeniden kaydedin. İlerleme çubuğu %100 olsun.
4. **Yedekleme** → Dışa aktar (ZIP) → dosyayı güvenli yerde saklayın.
   Telefon ve bilgisayar kayıtları **birleşmez**; ZIP ile taşınır.
5. Yedek hatırlatma 7 günde bir panelde görünür — düzenli alın:
   tarayıcı verisi silinirse kayıtlar gider.

## 3) Günlük kullanım

- Birey: 4 büyük kutu (Oku, Yaz, Konuş, Günlük Hayat). Oturum 10-20 dk
  (Ayarlar'dan seçilir), bitince "Bugünlük bu kadar" ekranı gelir.
- Konuş oyunu: model (aile sesi) söyler → birey tekrar eder → kaydı saklanır →
  ikisi yan yana dinlenir. Skor **yoktur**; "Güzel, bir daha!" gibi yumuşak
  geri bildirim verilir. Değerlendirmeyi uzman yapar.
- Terapist: Hedef & Plan ekranına TEDİL/TODİL ve SST sonuçlarını kendisi yazar;
  hedef ses/kelime seçer; ilerlemeyi (süre, doğru/yanlış, kayıtlar) izler.

## 4) Yeni içerik paketi ekleme

`web/js/icerik.js` dosyasına grup/öğe ekleyin
(`{ anahtar, metin, foto, heceler?, hedefSes? }`), push'layın — site güncellenir.
Yeni öğeler kayıt stüdyosunda otomatik görünür.

## Bilinen sınırlar

- Kayıtlar cihaza özeldir (IndexedDB). Cihazlar arası ZIP ile taşınır.
- Safari (iPhone) ve Chrome farklı format kaydeder; uygulama hepsini
  kaydederken ortak **WAV** formatına çevirir.
- Mikrofon izni için sayfanın **HTTPS** (GitHub Pages) veya `localhost`
  üzerinden açılması gerekir.
