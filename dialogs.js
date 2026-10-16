'use strict';
/* dialogs.js — günlük hayat diyalogları. Her diyalog 3 konuşma turundan oluşur: [karşıdaki söyler, öğrenci cevap verir].
   Cümleler PHRASES içine eklenir (anahtar: d:<id>:<tur>p / d:<id>:<tur>s) ve yetişkinin sesiyle üretilir. */
const DIALOGS = [
  { id: 'selam', t: 'Selamlaşma', e: '👋', l: [['Merhaba! Nasılsın?', 'İyiyim, sen nasılsın?'], ['Ben de iyiyim. Bugün hava çok güzel.', 'Evet, çok güzel.'], ['Hadi görüşürüz!', 'Görüşürüz, hoşça kal!']] },
  { id: 'gunaydin', t: 'Sabah', e: '☀️', l: [['Günaydın! İyi uyudun mu?', 'Günaydın, iyi uyudum.'], ['Kahvaltıda ne yemek istersin?', 'Yumurta yemek istiyorum.'], ['Çayını da getireyim mi?', 'Evet, lütfen.']] },
  { id: 'kahvalti', t: 'Kahvaltı', e: '🍳', l: [['Sofra hazır. Gel otur.', 'Tamam, geliyorum.'], ['Ekmek ister misin?', 'Evet, ekmek istiyorum.'], ['Afiyet olsun!', 'Teşekkür ederim.']] },
  { id: 'market', t: 'Markette', e: '🛒', l: [['Merhaba, ne istiyorsun?', 'Bir ekmek istiyorum.'], ['Başka bir şey var mı?', 'Süt de istiyorum.'], ['Hepsi on beş lira.', 'Buyurun, teşekkür ederim.']] },
  { id: 'firin', t: 'Fırında', e: '🥖', l: [['Hoş geldin! Ne alırsın?', 'İki simit lütfen.'], ['Başka bir şey ister misin?', 'Hayır, bu kadar.'], ['Afiyet olsun!', 'Sağ ol, iyi günler.']] },
  { id: 'doktor', t: 'Doktorda', e: '🩺', l: [['Merhaba, neyin var?', 'Karnım ağrıyor.'], ['Ne zamandan beri ağrıyor?', 'Dünden beri ağrıyor.'], ['Bu ilacı iç, geçer.', 'Tamam, teşekkür ederim.']] },
  { id: 'eczane', t: 'Eczanede', e: '💊', l: [['Merhaba, nasıl yardımcı olabilirim?', 'Bu reçeteyi getirdim.'], ['Bu ilacı günde iki kez iç.', 'Tamam, anladım.'], ['Geçmiş olsun!', 'Sağ olun, hoşça kalın.']] },
  { id: 'otobus', t: 'Otobüste', e: '🚌', l: [['Nereye gidiyorsun?', 'Okula gidiyorum.'], ['Biletin var mı?', 'Evet, biletim var.'], ['Burada inebilirsin.', 'Teşekkür ederim, iyi günler.']] },
  { id: 'telefon', t: 'Telefonda', e: '📞', l: [['Alo, merhaba!', 'Merhaba, annem orada mı?'], ['Evet, burada. Çağırayım mı?', 'Evet, lütfen.'], ['Şimdi telefonu veriyorum.', 'Çok teşekkür ederim.']] },
  { id: 'oyun', t: 'Arkadaşla oyun', e: '⚽', l: [['Merhaba! Benimle oynar mısın?', 'Evet, oynarım.'], ['Hangi oyunu oynayalım?', 'Top oynayalım.'], ['Çok eğlendim!', 'Ben de çok eğlendim.']] },
  { id: 'okul', t: 'Okulda', e: '🏫', l: [['Günaydın! Hazır mısın?', 'Evet, hazırım.'], ['Bugün okuma yapacağız.', 'Tamam, okuyalım.'], ['Aferin sana!', 'Teşekkür ederim.']] },
  { id: 'yardim', t: 'Yardım isteme', e: '🆘', l: [['Bir sorun mu var?', 'Evet, bana yardım eder misin?'], ['Tabii. Ne oldu?', 'Çantamı bulamıyorum.'], ['Birlikte arayalım.', 'Çok teşekkür ederim.']] },
  { id: 'kayip', t: 'Kaybolunca', e: '🧭', l: [['Neden üzgünsün?', 'Kayboldum.'], ['Korkma, sana yardım edeceğim.', 'Annemi bulmak istiyorum.'], ['Annene telefon edelim.', 'Tamam, lütfen.']] },
  { id: 'dogumgunu', t: 'Doğum günü', e: '🎂', l: [['Doğum günün kutlu olsun!', 'Teşekkür ederim.'], ['Bu da senin hediyen.', 'Çok güzel, çok sevindim.'], ['Pastadan ister misin?', 'Evet, istiyorum.']] },
  { id: 'misafir', t: 'Misafir', e: '🏠', l: [['Merhaba, geldim!', 'Hoş geldin, gir lütfen.'], ['Teşekkür ederim.', 'Otur lütfen.'], ['Su içer misin?', 'Evet, getireyim.']] },
  { id: 'park', t: 'Parkta', e: '🌳', l: [['Hadi kaydırağa binelim.', 'Tamam, binelim.'], ['Sen önce git.', 'Teşekkür ederim.'], ['Çok güzeldi!', 'Bir daha binelim.']] },
  { id: 'kafe', t: 'Kafede', e: '☕', l: [['Hoş geldiniz, ne istersiniz?', 'Bir çay lütfen.'], ['Yanında bir şey ister misiniz?', 'Hayır, teşekkürler.'], ['Buyurun, çayınız.', 'Sağ olun.']] },
  { id: 'lokanta', t: 'Lokantada', e: '🍽️', l: [['Ne yemek istersiniz?', 'Pilav ve tavuk istiyorum.'], ['İçecek ister misiniz?', 'Ayran lütfen.'], ['Başka bir şey ister misiniz?', 'Hesabı alabilir miyim?']] },
  { id: 'giyin', t: 'Dışarı çıkarken', e: '🧥', l: [['Hava soğuk. Montunu giy.', 'Tamam, giyiyorum.'], ['Atkını da al.', 'Aldım.'], ['Hazırsan çıkalım.', 'Hazırım, gidelim.']] },
  { id: 'eve', t: 'Eve gelince', e: '🏡', l: [['Hoş geldin! Okul nasıldı?', 'Çok güzeldi.'], ['Bugün ne öğrendin?', 'Yeni kelimeler öğrendim.'], ['Elini yıka, yemek hazır.', 'Tamam, yıkıyorum.']] },
  { id: 'aksam', t: 'Akşam yemeği', e: '🍲', l: [['Yemek nasıl?', 'Çok lezzetli.'], ['Biraz daha ister misin?', 'Evet, biraz daha lütfen.'], ['Karnın doydu mu?', 'Evet, doydum.']] },
  { id: 'uyku', t: 'Uyku zamanı', e: '🌙', l: [['Uyku vakti geldi.', 'Dişlerimi fırçalayayım.'], ['Çok iyi. Şimdi yatağa gir.', 'Yattım.'], ['İyi geceler, tatlı rüyalar!', 'Sana da iyi geceler.']] },
  { id: 'duygu', t: 'Duygular', e: '😊', l: [['Bugün nasıl hissediyorsun?', 'Çok mutluyum.'], ['Neden mutlusun?', 'Arkadaşımla oynadım.'], ['Çok sevindim.', 'Ben de seni seviyorum.']] },
  { id: 'hasta', t: 'Hasta olunca', e: '🤒', l: [['İyi görünmüyorsun. Neyin var?', 'Başım ağrıyor.'], ['Ateşine bakalım.', 'Tamam, bakalım.'], ['Biraz dinlen, geçecek.', 'Dinleneceğim.']] },
  { id: 'tanis', t: 'Tanışma', e: '🤝', l: [['Merhaba, tanıştığıma memnun oldum.', 'Ben de memnun oldum.'], ['Kaç yaşındasın?', 'Yirmi yaşındayım.'], ['Neleri seversin?', 'Müzik dinlemeyi severim.']] },
  { id: 'giysi', t: 'Giysi alırken', e: '👗', l: [['Bu gömlek sana yakışır.', 'Evet, beğendim.'], ['Bunu denemek ister misin?', 'Evet, deneyeyim.'], ['Nasıl oldu?', 'Tam oldu, bunu alalım.']] },
  { id: 'mutfak', t: 'Mutfakta', e: '🥕', l: [['Bana yardım eder misin?', 'Tabii, yardım ederim.'], ['Havuçları yıka.', 'Yıkıyorum.'], ['Çok iyi oldu, sağ ol.', 'Rica ederim.']] },
  { id: 'temizlik', t: 'Temizlik', e: '🧹', l: [['Odayı toplayalım mı?', 'Evet, toplayalım.'], ['Sen yatağını düzelt.', 'Düzeltiyorum.'], ['Süpürgeyi de getir.', 'Getiriyorum.']] },
  { id: 'bayram', t: 'Bayram', e: '🎉', l: [['Bayramın kutlu olsun!', 'Senin de bayramın kutlu olsun.'], ['Al, bayram şekeri.', 'Çok teşekkür ederim.'], ['Dedeni ziyaret edelim mi?', 'Evet, gidelim.']] },
  { id: 'ozur', t: 'Özür dileme', e: '🙏', l: [['Pardon, ayağına bastım.', 'Önemli değil.'], ['Özür dilerim.', 'Sorun değil.'], ['Teşekkür ederim.', 'Rica ederim.']] },
  { id: 'yagmur', t: 'Yağmurlu hava', e: '🌧️', l: [['Dışarıda yağmur yağıyor.', 'Şemsiyemi alayım.'], ['Montunu da giy.', 'Giydim.'], ['Hazırsan çıkalım.', 'Hadi gidelim.']] },
  { id: 'film', t: 'Film izlerken', e: '📺', l: [['Film izleyelim mi?', 'Evet, izleyelim.'], ['Hangi filmi seversin?', 'Çizgi film seviyorum.'], ['Mısır ister misin?', 'Evet, çok isterim.']] }
];
const dKey = (id, i, who) => 'd:' + id + ':' + i + who;
DIALOGS.forEach(d => d.l.forEach((pr, i) => {
  PHRASES.push({ k: dKey(d.id, i, 'p'), t: pr[0], g: 'Diyaloglar · ' + d.t });
  PHRASES.push({ k: dKey(d.id, i, 's'), t: pr[1], g: 'Diyaloglar · ' + d.t });
}));
const dlgOf = id => DIALOGS.find(d => d.id === id);
