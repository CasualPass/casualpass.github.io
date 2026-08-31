# CasualPass çalışma kaydı

## Proje özeti

CasualPass, GitHub Pages üzerinde bağımlılıksız HTML, CSS ve JavaScript ile çalışan mini oyun koleksiyonudur. Oyunlar kök dashboard’dan `wood-turning`, `snake-game`, `2048-game`, `xox-game` ve `chess-game` sayfalarına doğrudan bağlanır.

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
