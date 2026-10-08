/* İçerik paketleri: kelime, foto(emoji), hece ayrımı, hedef ses.
   Terapist yeni paket eklemek isterse bu dosyaya benzer blok ekler.
   NOT: çocuk fotoğrafı/adı ASLA repoya girmez; emoji kullanılır. */
window.ICERIK = {
  surum: 1,
  gruplar: [
    {
      id: 'yonerge', baslik: 'Yönergeler',
      ogeler: [
        { anahtar: 'yn_dokun', metin: 'Dokun', foto: '👆' },
        { anahtar: 'yn_dinle', metin: 'Dinle', foto: '👂' },
        { anahtar: 'yn_tekrar', metin: 'Tekrar et', foto: '🔁' },
        { anahtar: 'yn_sec', metin: 'Seç', foto: '✅' },
        { anahtar: 'yn_devam', metin: 'Devam et', foto: '▶️' },
        { anahtar: 'yn_bastan', metin: 'Baştan dinle', foto: '⏮️' },
        { anahtar: 'kutu_oku', metin: 'Oku', foto: '📖' },
        { anahtar: 'kutu_yaz', metin: 'Yaz', foto: '✏️' },
        { anahtar: 'kutu_konus', metin: 'Konuş', foto: '🎤' },
        { anahtar: 'kutu_gunluk', metin: 'Günlük Hayat', foto: '🧼' }
      ]
    },
    {
      id: 'geri', baslik: 'Geri bildirimler',
      ogeler: [
        { anahtar: 'gb_harika', metin: 'Harika!', foto: '🎉' },
        { anahtar: 'gb_super', metin: 'Süper!', foto: '⭐' },
        { anahtar: 'gb_guzel', metin: 'Çok güzel!', foto: '🌟' },
        { anahtar: 'gb_aferin', metin: 'Aferin sana!', foto: '👏' },
        { anahtar: 'gb_muthis', metin: 'Müthişsin!', foto: '🏆' },
        { anahtar: 'gb_guzelbirdaha', metin: 'Güzel, bir daha!', foto: '💛' },
        { anahtar: 'gb_birdaha', metin: 'Bir daha deneyelim!', foto: '🔄' },
        { anahtar: 'gb_oldusayilir', metin: 'Oldu sayılır, devam!', foto: '🙂' },
        { anahtar: 'gb_dinliyorum', metin: 'Dinliyorum, söyle!', foto: '🎤' },
        { anahtar: 'gb_bugunluk', metin: 'Bugünlük bu kadar!', foto: '🌙' }
      ]
    },
    {
      id: 'acilis', baslik: 'Açılış ve kapanış',
      ogeler: [
        { anahtar: 'ak_merhaba', metin: 'Merhaba! Oynamak için bir kutu seç.', foto: '☀️' },
        { anahtar: 'ak_hosgeldin', metin: 'Hoş geldin!', foto: '😊' },
        { anahtar: 'ak_gorusuruz', metin: 'Görüşürüz! Yarın yine oynayalım.', foto: '👋' },
        { anahtar: 'ak_mola', metin: 'Mola zamanı! Biraz dinlenelim.', foto: '🧃' }
      ]
    },
    {
      id: 'kelime', baslik: 'Eğitim kelimeleri ve heceleri',
      ogeler: [
        { anahtar: 'kl_ayi', metin: 'Ayı', foto: '🐻', heceler: ['a', 'yı'], hedefSes: '/j/ hece sonu' },
        { anahtar: 'kl_ev', metin: 'Ev', foto: '🏠', heceler: ['ev'], hedefSes: '/v/ hece sonu' },
        { anahtar: 'kl_ip', metin: 'İp', foto: '🧶', heceler: ['ip'], hedefSes: '/p/ hece sonu' },
        { anahtar: 'kl_otobus', metin: 'Otobüs', foto: '🚌', heceler: ['o', 'to', 'büs'], hedefSes: '/s/ kelime başı' },
        { anahtar: 'kl_ucak', metin: 'Uçak', foto: '✈️', heceler: ['u', 'çak'], hedefSes: '/ç/ hece başı' },
        { anahtar: 'kl_uzum', metin: 'Üzüm', foto: '🍇', heceler: ['ü', 'züm'], hedefSes: '/z/ hece başı' },
        { anahtar: 'kl_balon', metin: 'Balon', foto: '🎈', heceler: ['ba', 'lon'], hedefSes: '/b/ kelime başı' },
        { anahtar: 'kl_muz', metin: 'Muz', foto: '🍌', heceler: ['muz'], hedefSes: '/m/ kelime başı' },
        { anahtar: 'kl_kedi', metin: 'Kedi', foto: '🐱', heceler: ['ke', 'di'], hedefSes: '/k/ kelime başı' },
        { anahtar: 'kl_su', metin: 'Su', foto: '💧', heceler: ['su'], hedefSes: '/s/ kelime başı' },
        { anahtar: 'kl_top', metin: 'Top', foto: '⚽', heceler: ['top'], hedefSes: '/t/ kelime başı' },
        { anahtar: 'kl_ordek', metin: 'Ördek', foto: '🦆', heceler: ['ör', 'dek'], hedefSes: '/r/ hece sonu' }
      ]
    },
    {
      id: 'hikaye', baslik: 'Hikaye ve senaryo cümleleri',
      ogeler: [
        { anahtar: 'hk_gunes', metin: 'Güneş açtı, kuşlar ötüyor.', foto: '🌤️' },
        { anahtar: 'hk_kedi', metin: 'Kedi sütünü içti, mır mır etti.', foto: '🐱' },
        { anahtar: 'hk_top', metin: 'Top havaya uçtu, yere düştü.', foto: '⚽' },
        { anahtar: 'hk_park', metin: 'Parkta salıncakta sallandık.', foto: '🛝' },
        { anahtar: 'hk_ayicik', metin: 'Ayıcık balını yedi, uykuya daldı.', foto: '🐻' },
        { anahtar: 'hk_yagmur', metin: 'Yağmur yağdı, şemsiyeyi açtık.', foto: '🌧️' }
      ]
    },
    {
      id: 'gunluk', baslik: 'Günlük hayat rutinleri',
      ogeler: [
        { anahtar: 'gr_el1', metin: 'Musluğu aç', foto: '🚰' },
        { anahtar: 'gr_el2', metin: 'Sabunla ovala', foto: '🧼' },
        { anahtar: 'gr_el3', metin: 'Durula ve kurula', foto: '🤲' },
        { anahtar: 'gr_dis1', metin: 'Macunu sür', foto: '🪥' },
        { anahtar: 'gr_dis2', metin: 'Dişleri fırçala', foto: '😁' },
        { anahtar: 'gr_dis3', metin: 'Ağzı çalkala', foto: '💧' },
        { anahtar: 'gr_okul1', metin: 'Kahvaltı yap', foto: '🍳' },
        { anahtar: 'gr_okul2', metin: 'Dişleri fırçala', foto: '😁' },
        { anahtar: 'gr_okul3', metin: 'Çantayı al', foto: '🎒' }
      ]
    }
  ],
  hedefSesler: [
    '/b/ kelime başı', '/m/ kelime başı', '/k/ kelime başı', '/t/ kelime başı',
    '/s/ kelime başı', '/ç/ hece başı', '/z/ hece başı', '/v/ hece sonu',
    '/p/ hece sonu', '/r/ hece sonu', '/j/ hece sonu'
  ]
};
