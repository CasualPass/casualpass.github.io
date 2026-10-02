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
