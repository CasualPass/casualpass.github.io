# CasualPass çalışma kaydı

## Proje özeti

CasualPass, GitHub Pages üzerinde bağımlılıksız HTML, CSS ve JavaScript ile çalışan mini oyun koleksiyonudur. Oyunlar kök dashboard’dan `wood-turning`, `snake-game`, `2048-game`, `xox-game`, `chess-game`, `son-hat` ve `owl-game` sayfalarına doğrudan bağlanır.

## 2026-08-31 — Çerez odaklı dashboard yenilemesi

### Amaç

Ana sayfayı kaydırmalı bir vitrin yerine sade bir dashboard’a dönüştürmek; oyunları ilk ekranda doğrudan erişilebilir yapmak; profil/oturum ve CasualMoney durumunu yalnızca birinci taraf çerezlerinde tutmak; CasualMoney ile tema satın almayı eklemek.

### Hedef durumu

- [x] Beş mevcut oyunu sade dashboard grid’inde tek tıkla erişilebilir yapmak.
- [x] Profil ve ekonomi durumundan localStorage ile Supabase/OTP bağımlılığını kaldırmak.
- [x] CasualMoney ile tema satın alma ve seçme akışı eklemek.
- [x] Görsel ve işlevsel tarayıcı doğrulaması yapmak.

### Yapılanlar

- `index.html`, `style.css`, `script.js`: Açılış sayfası, hero/vitrin yapısı yerine sade dashboard olarak yeniden kuruldu. Beş oyunun tamamı masaüstünde tek grid satırında doğrudan bağlantı olarak görünür; bakiye, ödül, tema mağazası ve etkinlik özeti eklendi.
- `casual-profile.js`: Profil, aktif oturum, CasualMoney, Wood Turning ilerlemesi, satın alınan tema/boya ve hareket kaydı `SameSite=Lax` birinci taraf çerezlerine taşındı. Oturum ödülü (+15 CM), günlük ödül (+20 CM), bir varsayılan ve üç CasualMoney ile açılabilen temadan oluşan katalog ile geriye dönük Wood Turning API'si eklendi/korundu.
- `shared-settings.js`: Görsel ayarlar ve ortak oyun istatistikleri localStorage yerine çerezlere taşındı. `CasualSettings.setTheme()` ile seçilen tema tüm oyun sayfalarında uygulanır.
- `2048-game/script.js`, `snake-game/script.js`, `xox-game/script.js`: Kişisel yüksek skor ve yerel skor tablosu çerezlere taşındı.
- `wood-turning/index.html`, `wood-turning/script.js`: Bulut/OTP dosya yüklemeleri ve bulut durumu çıkarıldı; oyun cookie profilini, bakiyesini ve temayı doğrudan kullanır.
- `casual-cloud.js`, `cloud-config.js`: Eski bir sayfa önbelleği bunları isterse dış ağ veya depolama kullanmayan pasif, çerez-odaklı uyumluluk yüzeyine indirildi.
- `README.md`: Çerez odaklı mimari, ödüller, tema fiyatları ve çalıştırma notlarıyla güncellendi.

### Bilinen bağlam ve riskler

- Çerez tabanlı durum cihazlar arasında senkronlanmaz ve kullanıcı çerezleri temizlerse sıfırlanır.
- İstemci tarafında tutulan CasualMoney gerçek para veya güvenlik gerektiren bir ekonomi için uygun değildir.
- `wood-turning` `CasualProfile` API’sini kullanmaya devam eder; çerez sürümü bu API'nin gereken profil, ekonomi, boya ve ofis işlevlerini korur.
- Depoda kullanılmayan tarihsel `supabase/schema.sql` dosyası bırakıldı. Aktif HTML sayfaları bu şemayı, Supabase SDK'sını veya OTP akışını yüklemez.

### Testler

- `python3 -m http.server 4173 --bind 127.0.0.1`: Uygulama yerelde başarıyla servis edildi.
- Yerel tarayıcı görsel kontrolü: Dashboard, masaüstünde beş oyun kartını aynı satırda gösterdi; yatay carousel kullanılmadı.
- Yerel tarayıcı etkileşim testi: Oturum başlatma (+15 CM), günlük ödül (+20 CM), Paper temasını 30 CM karşılığında satın alma ve seçme başarılı oldu.
- Yerel tarayıcı yenileme testi: Açık oturum, 5 CM bakiye ve Paper teması sayfa yenilemesi sonrasında korundu.
- Wood Turning entegrasyon testi: Oyun cookie profilini `@CasualOyuncu`, 5 CM bakiye ve Paper temasıyla açtı; tarayıcı konsolunda hata/uyarı yoktu.
- 2048 yükleme testi: Ortak çerez yardımcılarıyla sayfa başarıyla yüklendi; tarayıcı konsolunda hata/uyarı yoktu.
- `rg -n "localStorage" --glob '*.js' --glob '*.html'`: Aktif JavaScript/HTML içinde localStorage kullanımı kalmadığı doğrulandı.
- `git diff --check`: Başarıyla tamamlandı.
- `node --check`: Çalıştırılamadı; çalışma ortamında `node` komutu bulunmuyor. JavaScript dosyaları ilgili tarayıcı sayfalarında yüklenip yürütüldü.

## 2026-09-30 — Minerva Owl

### Amaç

Flappy Bird benzeri, ana karakteri Minerva'nın baykuşu olan bir uçuş oyunu eklemek; diğer baykuşları CasualMoney ile satın alınabilir yapmak.

### Yapılanlar

- `owl-game/`: Canvas tabanlı uçuş oyunu. Baykuş mermer sütunların arasından geçer, her sütun 1 puan verir. Boşluk/↑/W, tıklama veya dokunma ile kanat çırpılır; Esc ya da sekme değişimi oyunu duraklatır. Fizik 1/120 sn alt adımlarla çalışır, böylece düşük FPS'de de hız aynıdır.
- `casual-profile.js`: `owls` kataloğu (Minerva ücretsiz; Kar 80, Peçeli 150, Puhu 260, Gece 420, Altın 750 CM), `ownedOwls`/`selectedOwl` profil alanları, `buyOwl`, `selectOwl`, `owlRewardForScore`, `awardOwlFlight` eklendi. Uçuş ödülü `floor(skor / 2)` CM, taban tavanı 40 CM; yeniden doğuş çarpanı uygulanır. `unlockAll` baykuşları da açar.
- `casual-cheats.js`: Ölümsüzlük baykuşu düşürmez; `allopen` baykuşları kaydetmeden önizlemeye açar. İpuçları güncellendi.
- `index.html`, `style.css`: Dashboard'a 7. kart (Minerva Owl) eklendi; grid masaüstünde 7, tablette 4, telefonda 2 sütun (tek kalan kart tam genişlik).
- Rekor `cp_owl_best` çerezinde, istatistik `recordGameResult('Minerva Owl', …)` ile tutulur. Hile açıkken rekor, ödül ve satın alma kaydedilmez.

### Testler

- `node --check`: `casual-profile.js`, `casual-cheats.js`, `owl-game/script.js`, `script.js` başarılı.
- Playwright (Chromium) uçtan uca: oturum başlatma (+15 CM), yetersiz bakiyede satın alma reddi, gerçek uçuş ve çarpışma sonrası sonuç ekranı, 20 puan → 10 CM, 500 puan → 40 CM tavanı, Kar Baykuşu'nu 80 CM'ye alıp seçme, yenileme sonrası seçimin korunması, ölümsüzlük hilesinde sütunlardan geçip puan alma.
- Görsel kontrol: masaüstü, 390 px telefon, 1000 px tablet dashboard'u ve Paper teması. Konsolda yalnızca ortam proxy'sinin Google Fonts sertifika hataları görüldü.

## 2026-10-01 — Dashboard UI/UX düzeltmeleri

### Yapılanlar

- `index.html`: Oyunlar paneli karşılama alanının hemen altına alındı; telefonda ilk ekranda dört oyun kartı tam görünür (önce yalnızca ilk satırın üstü görünüyordu). Metrikler ve yeniden doğuş oyunların altında.
- `style.css`: Toast, sabit "Kod gir" düğmesinin arkasında kalıyordu; artık onun üstünde ve önünde. Footer'a düğme kadar alt boşluk eklendi. 9–10 px metinler 11–13 px'e büyütüldü. "Temizle" 40 px dokunma alanı aldı. Telefonda oturum düğmesi, ödül alınana kadar etiketini gösterir. 400 px altında kart numaraları gizlenir (Snake sanatıyla çakışıyordu).
- `casual-cheats.js`: Sabit "Kod gir" düğmesi oyun sayfalarında her genişlikte, dashboard'da 720 px altında 44 px'lik yalnızca simgeli düğmedir (XOX tahtasını ve 1280 px'te Wood Turning'in "Zımparaya geç" düğmesini kapatıyordu); erişilebilir adı "Kod gir" olarak kalır. Sürümlü sayfalarda `?v=6`. `font: inherit` sıfırlaması `:where(.cp-cheat)` ile düşük özgüllüğe indirildi; önceden düğmelerin kendi boyut/kalınlık kuralları (ör. 14 px/800) eziliyordu ve oyunlar düğmeyi yeniden biçimlendiremiyordu.
- `script.js`: Günlük ödül oturum yokken oturumu da başlatır. Oturum ödülü günlük olduğundan, alınmamışsa düğme "Ödülü al", metrik "Bugün alındı" gösterir. Tema kartları açıklamayı, düğme fiyatı gösterir. "Temizle" yalnızca hareket varken görünür. Oyun sayısı metni kartlardan hesaplanır.

### Testler

- Playwright (Chromium) 1440, 1000, 390 ve 320 px: yatay taşma yok, sayfa hatası yok, 40 px altı düğme yok (atlama bağlantısı ve logo hariç), toast ile "Kod gir" çakışmıyor, oturumsuz günlük ödül +15 ve +20 CM verir.

## 2026-10-01 — Wood Blocks

### Amaç

Woodoku benzeri bir ahşap blok bulmacası eklemek; blok görünümlerini CasualMoney ile satın alınabilir yapmak.

### Yapılanlar

- `wood-blocks/`: Canvas tabanlı 9×9 bulmaca. Her turda 3 parça gelir; fare veya dokunmayla sürüklenir (dokunmada parça parmağın üstünde görünür). Dolu satır, sütun ve 3×3 kareler silinir. Yerleştirilen her kare 1 puan; silinen her grup 18 puan, aynı hamlede birden fazla grup ek bonus; art arda 3 hamle içinde yeniden silmek seri çarpanı verir. Hiçbir parça sığmayınca oyun biter. Klavye: 1/2/3 parça seçer, oklar taşır, Enter bırakır, Esc vazgeçer. Yeni elde her zaman en az bir parça sığar: rastgele el birkaç kez yeniden çekilir, yine sığmazsa bir parçası sığan bir şekille değiştirilir. Tahtaya sığmayan parçalar tepside soluk görünür.
- `casual-profile.js`: `woods` kataloğu (Çam ücretsiz; Ceviz 90, Kiraz 180, Abanoz 360 CM), `ownedWoods`/`selectedWood`, `buyWood`, `selectWood`, `blocksRewardForScore`, `awardBlocksGame` eklendi. Ödül `floor(skor / 50)` CM, taban tavanı 40 CM; yeniden doğuş çarpanı uygulanır. `unlockAll` ahşapları da açar.
- `casual-cheats.js`: Ölümsüzlükte tahta tıkanınca parçalar yenilenir; `allopen` ahşapları kaydetmeden önizlemeye açar.
- Dashboard, Wood Blocks, Minerva Owl ve Wood Turning `casual-profile.js?v=12` ve `casual-cheats.js?v=7` yükler (main'deki `?v=6` düğme değişiklikleri ve yeni ahşap ipuçları birlikte); dashboard stili `style.css?v=15`. Sürümsüz sayfalar (Snake, 2048, Chess, Son Hat, XOX) yeni betiği GitHub Pages'in 10 dakikalık önbelleği dolunca alır. Eski `cleanProfile` bilinmeyen alanları attığı için, yayından önce açılmış bir sekme profili yazarsa yeni `ownedWoods` alanı sıfırlanabilir; aynı risk baykuşlarda da vardı.
- `index.html`, `style.css`: Dashboard'a 8. kart (Wood Blocks); masaüstü grid 8 sütun.
- Rekor `cp_blocks_best` çerezinde, istatistik `recordGameResult('Wood Blocks', …)` ile tutulur.

### Testler

- `node --check`: `casual-profile.js`, `casual-cheats.js`, `wood-blocks/script.js` başarılı.
- Playwright (Chromium): gerçek fare sürüklemeleriyle oyun sonuna kadar oynama (833 puan → 16 CM), iPhone SE'de dokunmatik sürükleme, klavyeyle tam oyun, Ceviz'i 90 CM'ye alma ve yenileme sonrası seçimin korunması, yetersiz bakiyede red, ölümsüzlükte 150 hamle boyunca oyunun bitmemesi, `score set` hilesi.
- Yalnızca tek blokların sığdığı tahtada (her satır, sütun ve 3×3 karede bir boşluk) dağıtılan 3000 elin hepsinde sığan bir parça vardı ve 1500 el bitişinde oyun erken bitmedi. Düzeltmeden önceki kod aynı testte 17 oynanamaz el ve 8 erken oyun sonu üretiyordu.
- Görsel kontrol: masaüstü, telefon oyun ekranı ve dashboard (masaüstü, 1000 px, 390 px).

## 2026-10-04 — Son Hat, Last War tarzında yeniden yazıldı

### Amaç

Eymen'in Last War: Survival Game açıklaması ve altı mağaza görseline göre Son Hat'ı hiper-casual bir şerit savaşına çevirmek; "Tam üs" seçimiyle bina kurma, kaynak üretimi, dünya haritası ve kahraman toplama eklemek. İttifak ve çok oyunculu kısım sunucu olmadığı için yok.

### Yapılanlar

- `son-hat/script.js`: Canvas üzerinde perspektifli köprü. Birlik ileri koşar, sürükleme veya ←/→/A/D ile şerit seçilir; her asker otomatik ateş eder. Mavi kapılar (+N, ×2) birliği büyütür, kırmızı kapılar (−N) küçültür; kapıları vurmak mavileri büyütür, kırmızıları boşaltıp maviye çevirir. Numaralı sandıklar vurulup kırılınca silah (Tabanca → Makineli → Pompalı → Lazer), helikopter, asker veya ateş hızı verir; vurmadan çarpınca asker kaybedilir ve ödül gelmez. Zombi sürüleri, iri zombiler ve bölüm sonunda can barlı boss (her 5. bölüm dev boss). Bölümler sabit tohumla üretilir (aynı bölüm hep aynı). Esc/P veya sekme değişimi duraklatır.
- Üs: 5×5 arsa, ortada Karargâh. Bina türleri: Kışla (başlangıç askeri), Silah Atölyesi (hasar), Atış Poligonu (ateş hızı), Altın Madeni, Çiftlik, Demir Madeni, Depo (biriktirme süresi), Hangar (savaşa helikopterle başla). Karargâh seviyesi diğer binaların sınırı ve bina yeri sayısıdır (4 + Sv). Madenler dakika başı üretir, Depo'ya göre 60+30·Sv dakika biriktirir; kapalıyken de üretir (zaman damgası).
- Kahramanlar: 3 sınıf (Tank kalkan, Uçak hava saldırısı, Füze hedef arayan füze) × 3 nadirlik = 9 kahraman. Çağırma 150 altın (%70/%25/%5); tekrar gelen seviye atlar. Takım en fazla 3; aynı sınıftan 2 kahraman +%5, 3 kahraman +%15 hasar. Eğitim altın + yiyecek ister.
- Harita: bölgeler (Köprü, Liman, Sanayi, Şehir Merkezi, Son Kale), 99 bölüm, gücün ve önerilen güç.
- Kayıt: `cp_sonhat_v2` çerezi, kısa anahtarlı JSON (~300 bayt; 3000 baytı aşarsa yazılmaz). Eski `cp_sonhat_v1` altını yeni kayda aktarılır ve eski çerez silinir.
- `casual-profile.js`: `sonHatRewardForCoins`, `awardSonHatRun` (8 altın = 1 CM, koşu başına en fazla 40 CM, yeniden doğuş çarpanı uygulanır). Sürüm `?v=13` (dashboard, Owl, Wood Blocks, Wood Turning, Son Hat).
- Hile açıkken ilerleme, ganimet, satın alma ve CM kaydedilmez; ölümsüzlükte birlik 1 askerin altına düşmez.

### Testler

- `node --check`: `son-hat/script.js`, `casual-profile.js` başarılı.
- Playwright (Chromium), yönlendiren basit bir botla: Bölüm 1 ve 5 yükseltmesiz kazanıldı, Bölüm 10 yükseltmesiz kaybedildi, orta seviye üsle (Karargâh 4, savaş binaları 4, üç Sv 3 kahraman) Bölüm 10 kazanıldı.
- Üs akışı: üretimi toplama, boş arsaya Çiftlik/Silah Atölyesi kurma, Karargâh yükseltme, kahraman çağırma ve takıma ekleme; kayıt çerezi 289 bayt.
- 320, 390, 1000, 1440 px'te yatay taşma yok; konsolda yalnızca ortam proxy'sinin Google Fonts sertifika hatası.
