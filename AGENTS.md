# CasualPass çalışma kaydı

## Proje özeti

CasualPass, GitHub Pages üzerinde bağımlılıksız HTML, CSS ve JavaScript ile çalışan mini oyun koleksiyonudur. Oyunlar kök dashboard’dan `wood-turning`, `snake-game`, `2048-game`, `xox-game`, `chess-game`, `son-hat`, `owl-game`, `wood-blocks`, `fps-game` ve `vektor` sayfalarına doğrudan bağlanır.

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

## 2026-10-19 — Arena FPS (çok oyunculu nişancı)

### Amaç

Eymen'in paylaştığı tek dosyalık "HTML5 + WebRTC Multiplayer FPS v4" oyununu CasualPass'e eklemek ve "çok daha gelişmiş" hâle getirmek.

### Yapılanlar

- `fps-game/`: Paylaşılan harita (sabit tohum), 4 silah, ADS/dürbün, kayma/çömelme/zıplama, çalılıkta saklanma, kafadan vuruş ve 13 baytlık ikili konum paketi korundu. Eklenenler:
  - **Botlar** (yalnızca tek oyunculu/host'ta simüle edilir): 1 m'lik ızgarada A* ile yol bulma (string pulling), görüş/duyma/vurulma algısı, tepki süresi, oturan nişan hatası, şerit (strafe) hareketi, silaha göre tercih mesafesi, seri atış. Kolay/Normal/Zor.
  - **Maç sistemi**: süre (3/5/10 dk) ve öldürme hedefi (10/20/30), skor tablosu (Tab), maç sonu sıralaması, yeniden başlatma; host çevrimiçi maçta 25 sn sonra kendiliğinden yeni maç açar.
  - **Ağ**: host her tikte kendi kaydını, botları ve diğer istemcileri tek pakette toplar (1 + 12·N bayt); istemci yalnızca kendini yollar ve host başkası adına konum kabul etmez. Uzak oyuncular 100 ms gecikmeli anlık görüntü ara değerlemesiyle çizilir. İsabeti atan bildirir, hasarı hedefin sahibi uygular; host isabeti yalnızca hedefin bağlantısına iletir. Olaylar doğrulanır/sınırlanır; isimler yalnızca `textContent` ile basılır. TURN listesi artık `eval`/`new Function` ile değil yalnızca `JSON.parse` ile okunur ve kaydedilmez (aktif kodda localStorage yok).
  - El bombası (G; sekme fiziği, görüş hattı kontrollü alan hasarı), can yenilenmesi, 2 sn doğuş kalkanı, hasar yönü göstergesi, isabet/öldürme işaretleri, seri bildirimleri, ölüm kamerası, radar (yalnızca ateş edenler görünür), isim etiketleri (yalnızca görüş hattındaysa), mermi izleri, geri tepme toparlanması, adım/konumsal (stereo) sesler.
  - Dokunmatik kontroller: sol sanal çubuk (sonuna kadar itince koşu), sağ taraf bakış, Ateş/Nişan/Zıpla/Çömel/R/Silah/Bomba düğmeleri.
  - Ayarlar (`cp_arena_prefs` çerezi): hassasiyet, görüş açısı, ses, grafik kalitesi (Düşük: düşük çözünürlük ve anizotropi yok; Yüksek: gölgeler). Maç seçenekleri de aynı çerezde.
  - Performans: ~800 statik mesh malzemeye göre birleştirilir (~35 çizim çağrısı); efektler hiç dispose edilmeyen havuzlardan gelir (son malzeme dispose edilince three.js shader programını silip bir sonraki atışta yeniden derliyordu); efekt shader'ları maç başında derlenir; tam ekran gizli katmanlar (liquid temanın bulanık blob'ları, `backdrop-filter`, görünmez hasar flaşı) kaldırıldı; HUD yalnızca değer değişince DOM'a yazar; başarısız bot rotası her karede yeniden aranmıyor.
  - `vendor/three.min.js` (three@0.128.0) ve `vendor/peerjs.min.js` (peerjs@1.5.4) npm paketlerinden değiştirilmeden kopyalandı; lisanslar `vendor/LICENSES.md`.
  - `?debug` yalnızca testler için salt-okunur `window.ArenaDebug` açar; `?signal=host:port` kendi PeerJS sunucusunu kullanır.
- `casual-profile.js`: `camos` kataloğu (Standart ücretsiz; Çöl 100, Orman 180, Kutup 260, Kızıl 420, Altın 800 CM), `ownedCamos`/`selectedCamo`, `buyCamo`, `selectCamo`, `arenaRewardForMatch`, `awardArenaMatch` (öldürme başına 2 CM, birincilik +6 CM, maç başına en fazla 40 CM, yeniden doğuş çarpanı). `unlockAll` kaplamaları da açar. Sürüm `?v=14`.
- `casual-cheats.js`: ölümsüzlük yalnızca tek oyunculu Arena'da geçerli (çevrimiçi maçta arkadaşlara karşı işlemez); `allopen` kaplamaları önizlemeye açar; `score set`/`score plus` tek oyunculu maçta öldürme sayısına uygulanır. Sürüm `?v=8`. Maç sırasında "Kod gir" düğmesi ateş düğmelerinin üstüne binmesin diye gizlenir.
- `index.html`, `style.css`: Dashboard'a 9. kart (Arena FPS); masaüstü grid 9, tablet 3 sütun (3×3). Stil `?v=16`.
- Rekor (maçtaki en çok öldürme) `cp_arena_best` çerezinde; istatistik `recordGameResult('Arena FPS', …)`. Hile açıkken rekor, ödül ve satın alma kaydedilmez.

### Bilinen bağlam ve riskler

- Çok oyunculu mod PeerJS'in herkese açık sinyal sunucusuna (0.peerjs.com) bağlıdır; sunucu kapalıysa oda açılamaz (tek oyunculu mod çalışır). Simetrik NAT arkasındaki cihazlar TURN olmadan bağlanamayabilir.
- İstemci tarafı isabet kaydı: hile yapan bir istemci sahte isabet yollayabilir. Hasar 0–250 ile sınırlanır; arkadaş oyunu için kabul edilmiştir.
- Yalnızca host simüle eder: host ayrılınca oda kapanır (host göçü yok).

### Testler

- `node --check`: `fps-game/script.js`, `casual-profile.js`, `casual-cheats.js` başarılı.
- Playwright (Chromium, SwiftShader): tek oyunculu maç başlatma, botların doğup gezmesi ve birbirleriyle savaşması; gerçek fare girdisiyle bota nişan alıp öldürme ve öldürme akışı; silah değiştirme, şarjör, el bombası (kendi ayağına atınca 100 → 12 can), W ile hareket, Tab skor tablosu, işaretçi kilidi bırakınca duraklatma/devam; maç sonu (+40 CM tavanı, istatistik, rekor), yeni maç ve menüye dönüş.
- İki ayrı tarayıcı bağlamı ve yerel PeerJS sunucusuyla (`?signal=127.0.0.1:9000`) gerçek WebRTC: oda kodu ile katılma, host konumunun istemcide birebir görünmesi, istemcinin host'u vurup öldürmesi (iki tarafta aynı skor ve öldürme akışı), bomba senkronu, host maçı bitirince istemcide sonuç ekranı (+8 CM) ve "Host bekleniyor", host yeni maç açınca istemcinin oyuna dönmesi, istemci ayrılınca host'ta silinmesi, host ayrılınca istemcinin "Host ile bağlantı koptu." ile menüye dönmesi. Konsolda hata yok.
- iPhone 12 dokunmatik emülasyonu (yatay 844×390 ve dikey 390×844): sanal çubukla yürüme, sağ tarafla bakış, Ateş düğmesiyle atış, duraklatma; yatay taşma yok.
- Dashboard 1440, 1000, 390, 320 px: yatay taşma yok, "Dokuz oyun aynı ekranda."
- Not: SwiftShader yazılım GPU'su bu ortamda karesi pahalı çizdiği için FPS ölçümleri gerçek cihazları temsil etmiyor; JS tarafı 5 sn'lik profilde ~100 ms'e indi ve maç sırasında shader yeniden derlenmiyor.

## 2026-10-19 — Arena FPS doku kalitesi

### Yapılanlar

- `fps-game/script.js`: Tek renkli yüzeyler yerine dosya indirmeden üretilen dokular. Döşenebilir (kenarları birleşen) fraktal değer gürültüsü ve kenar sarmalı çizimle 11 yüzey: çim (tek tek çim yaprakları, kuru lekeler), asfalt (kenar çizgileri, aşınmış orta şerit, çatlaklar), sıva, beton (panel derzleri, kalıp delikleri), çatı, sandık (çerçeve, çapraz destek, tahta damarı, çivi), oluklu metal, kum torbası, kaya, ağaç kabuğu, yaprak. Dokular çoğunlukla açık gri; malzeme rengi onları renklendirir, böylece her bina/konteyner rengi aynı dokuyu paylaşır.
- Birleştirilmiş statik geometriye dünya koordinatlı kutu UV'si verildi (her yüzeyde aynı piksel yoğunluğu); sandıklar kendi kutu UV'sini korur.
- Zemine düşük frekanslı köşe renkleri (açık/koyu ve kuru çimen lekeleri) eklendi; çim dokusunun tekrarı görünmez.
- Silahlar: Çöl/Orman/Kutup/Kızıl kaplamalar gerçek kamuflaj deseniyle boyanır; Standart ve Altın fırçalanmış metal ve ahşap damarı kullanır.
- Kalite: Düşük 256 px, Orta 512 px, Yüksek 1024 px (çim ve asfalt; diğerleri en çok 512 px). Anizotropi Düşük 1, Orta 4, Yüksek 8. Ayardan kalite değişince dokular yeniden çizilir.
- Hata düzeltmesi: güneşin gölge kamerası sınırları ayarlandıktan sonra `updateProjectionMatrix()` çağrılmıyordu; "Yüksek"te gölgeler yalnızca harita merkezinin ±5 m'sinde çıkıyordu. Artık tüm haritada.
- `index.html` betik sürümü `?v=2`.

### Testler

- `node --check fps-game/script.js` başarılı.
- Playwright: Orta ve Yüksek kalitede bina, konteyner, sandık, yol, kaya ve kamuflajlı silah ekran görüntüleri; konsolda hata yok.
- Önceki tek oyunculu, iki tarayıcılı WebRTC ve iPhone 12 dokunmatik (Düşük kalite) testleri yeniden geçti.

## 2026-10-19 — Vektör (5'e 5 taktik kahraman nişancı)

### Amaç

Eymen'in isteği: VALORANT'a grafik, tasarım ve teknik açıdan çok benzeyen bir oyun. Riot'un adı, logosu, ajan/silah/harita adları ve varlıkları kullanılmadı; oynanış ve görünüm türün kendi diliyle, özgün adlarla yeniden kuruldu.

### Yapılanlar

- `vektor/`: Arena FPS motoru (Three.js, prosedürel dokular, birleştirilmiş statik geometri, A*, WebRTC yıldız ağ) üzerine yeni oyun. `script.js` tek dosya, ~5000 satır.
  - **Harita "Liman"**: 2 m hücreli ızgaradan oyulan, iki kurma bölgeli (A/B), orta alanlı, boğazlı ve ara geçitli Akdeniz liman kasabası. Bölgeye göre renkli sıva duvarlar, süpürgelik ve korniş, kiremit saçaklar, saksılar, duvar dışında çatılar ve çan kulesi. Bölge zeminleri boyalı, duvarlarda büyük A/B harfleri. Satın alma evresinde doğuş bariyerleri.
  - **Raunt sistemi**: satın alma (25 sn) → raunt (100 sn) → çekirdek kurulunca 45 sn → raunt sonu. Kazanmak için 5/7/13 raunt; `hedef − 1` raunttan sonra taraf değişir. Eleme, süre dolması, patlama ve çözme sonuçları.
  - **Çekirdek**: rastgele bir saldırgan taşır; ölünce düşer, ilk geçen saldırgan alır. Bölgede F basılı 4 sn kurma, 7 sn çözme (3,5 sn'de yarı kayıt). Kurulunca hızlanan bip ve kırmızı ışık.
  - **Ekonomi**: başlangıç 800, galibiyet 3000, yenilgi 1900/2400/2900, öldürme 200, kurma 300 (tüm saldırganlara), tavan 9000; devre arasında sıfırlanır. Herkes kendi kredisini aynı kurallarla hesaplar.
  - **Satın alma menüsü** (B): tabanca, hafif, tüfek, keskin, kalkanlar, yetenek şarjları; silah görselleri gerçek 3B modellerden beyaz siluet olarak çizilir. Bu raunt alınan geri satılabilir.
  - **Silahlar**: Pim, Ölçü, Arı, Saçma, Kartal (mesafeden bağımsız tek kafa), Şahin (susturuculu), Yayla (gövdeye tek atış), bıçak, çekirdek. Kafa/gövde/bacak çarpanı ve mesafe düşüşü.
  - **İsabet modeli**: duran ilk mermi isabetli; koşarken büyük, yürürken (Shift) küçük dağılım; havada çok kötü; çömelmek ve nişan almak iyileştirir. Tüfekte önce yukarı, sonra sağa sola kayan sabit tarama kalıbı; ara verince sıfırlanır. Hızlı ivmelenme ve daha hızlı fren (karşı-strafe). Vurulunca kısa yavaşlama. Koşan düşmanın ayak sesi duvar arkasından duyulur, yürüyen sessizdir.
  - **Ajanlar** (C/Q/E + X nihai, 6 puan): Kor (alev topu, kör edici, atılım, cehennem), Sis (bataklık, gölge, duman, gece perdesi), Ok (şok oku, parlama, keşif oku, av), Kale (tuzak teli, kalkan duvarı, onarım, kilit). E her raunt ücretsiz yenilenir; nihai puanı öldürme, ölüm, kurma ve çözmeden gelir.
  - **Görünüm**: düşmanlar kırmızı dış hatlı (ters gövde), görünür kılınınca hat duvarın arkasından görünür; müttefiklerin üstünde camgöbeği işaret ve isim. Lacivert/kırmızı/kırık beyaz HUD: üstte takım ajan çipleri ve skor/süre, solda harita (düşmanlar yalnızca görülünce), sağda öldürme akışı (silah siluetiyle), altta can/kalkan, yetenek çubuğu ve cephane; raunt ve öldürme afişleri; ölünce ölüm kamerası, sonra takım arkadaşını izleme.
  - **Botlar**: takım planı (hedef bölge, lobide bekleme, giriş, kurma; savunmada bölge tutma, çekirdek kurulunca geri alma ve çözme), satın alma mantığı (tabanca raundu, eko, zorunlu alım, tam alım), durup ateş etme, takım bilgisi paylaşımı, ses ve vurulmaya tepki, rol tabanlı yetenek kullanımı.
  - **Çevrimiçi**: 13 baytlık kayıt (silah ve çekirdek baytı eklendi). Katılan oyuncu insanı az olan takıma girer, takım doluysa bir botun yerini alır; ayrılanın yerine bot geçer. Raunt, evre, çekirdek ve skor host'tan; istemci olayları doğrulanır.
  - Dokunmatik: çubuk (az itince yürüme), bakış, Ateş/Nişan/Zıpla/Çömel/R/Silah/F ve C/Q/E/X/satın alma düğmeleri.
  - Çömelme Ctrl yerine Z: Ctrl+W sekmeyi kapatır ve sayfa engelleyemez.
  - `?debug` testler için `window.VektorDebug` açar; `?signal=host:port` kendi PeerJS sunucusu.
- `casual-profile.js`: `vektorRewardForMatch`, `awardVektorMatch` (öldürme + kazanılan raunt başına 1 CM, zafer +10, maç başına en fazla 40 CM, yeniden doğuş çarpanı). Sürüm `?v=15` (tüm sürümlü sayfalar).
- `index.html`, `style.css`: 10. kart (Vektör); masaüstü ve tablet grid 5 sütun (2 satır). Wood Blocks kart çiziminin kareleri `.game-art`'ın `align-items: center` kuralı yüzünden 0 yükseklikteydi; `align-items: stretch` ile düzeldi. Stil `?v=17`.
- Rekor `cp_vektor_best`, ayarlar `cp_vektor_prefs` çerezlerinde; istatistik `recordGameResult('Vektör', …)`.

### Testler

- `node --check` ve ESLint (`no-undef`, `no-unused-vars`) temiz.
- Playwright (Chromium, SwiftShader): botların tam raunt oynaması (çatışma, taşıyıcı ölünce çekirdeğin düşmesi ve alınması, A'ya kurma, savunmanın çözmesi); satın alma, geri satma, kalkan ve yetenek alımı; satın alma evresinde duman; bota ateş edip öldürme (+200 kredi, +1 nihai puan); oyuncunun kurması (+300) ve savunmada çözmesi; ölüm sonrası müttefik izleme; dört ajanın tüm C/Q/E/X yetenekleri; tam maç (kayıp serisi ekonomisi, devre arası taraf değişimi ve kredi sıfırlama, 9000 tavanı, 5–4 zafer, +15 CM, yeni maç).
- İki tarayıcılı gerçek WebRTC (yerel PeerJS): katılanın rakip takımda bir botun yerini alması, raunt ve ekonomi senkronu, istemcinin host'u öldürmesi, host botunun yeteneğinin istemcide görünmesi; konsolda hata yok.
- iPhone 12 dokunmatik (yatay/dikey): taşma yok, çubukla hareket, satın alma menüsü. Dashboard 1440/1000/390/320 px taşma yok.

### Bilinen bağlam ve riskler

- Botlar basit kurallarla oynar; insan takım arkadaşı gibi iletişim kurmaz.
- Çevrimiçi isabet ve kredi istemci tarafındadır; arkadaş oyunu içindir.
- Duman ve görünürlük her istemcide yerel hesaplanır; küçük zaman farkları olabilir.

## 2026-10-19 — Vektör: yeni haritalar ve ajanlar

### Yapılanlar

- `vektor/script.js`: Harita artık sabit değil; her harita 40×56 hücrelik bir karakter planı (`#` duvar, `.` zemin, `k`/`K` sandık, `M` konteyner, `h` alçak duvar, `o` sütun, `p` süs), bölge ve doğuş dikdörtgenleri, taktik noktaları ve görünümle (gökyüzü, sis, güneş, zemin/duvar dokusu, dış manzara) tanımlanır. `buildMap(id)` eski haritayı atıp yenisini kurar; çarpışma, gezinme ızgarası, mini harita, doğuş bariyerleri (doğuş dikdörtgeninin açık kenarlarından otomatik) ve bölge harfleri (en yakın duvar yüzüne otomatik) yeniden üretilir.
- Haritalar: **Liman** (mevcut), **Kumsaray** (çöl kalesi; uzun A koridoru, kapılı B, ortada avlu), **Üçyol** (teknopark; A/B/C üç kurma bölgesi), **Buzul** (kutup üssü; A savunmaya, B saldırıya yakın, sütunlu kubbe salonu, kar yağışı). Yeni dokular: kumtaşı, taş döşeme, kar, panel zemin, cam cephe.
- Menüde harita seçimi (önizlemeli plan çizimi) ve "Rastgele"; tercih `cp_vektor_prefs` çerezinde. Host haritayı anlık görüntüyle (`m.map`) gönderir, katılan aynı haritayı kurar. Botlar bölge listesini haritadan alır (üç bölgede savunma her bölgeye bir kişi koyar).
- Tasarım denetimi: saldırgan/savunan doğuşundan bölgelere yürüme mesafesi Liman'a yakın tutuldu (saldırgan 43–52, savunan 14–28 hücre). Doğuştan doğuşa görüş hattı denetimi Liman'da da düz bir orta hat buldu; Liman, Kumsaray ve Buzul'un ortasına görüşü kesen birer blok kondu. Liman'da duvar içine gömülü 4 saksı kaldırıldı.
- Yeni ajanlar: **Rüzgâr** (Düellocu: Yükseliş, Bulut, Süzülüş, nihai Fırtına Bıçakları — 5 isabetli bıçak, öldürünce dolar), **Ayaz** (Kontrolcü: Buz Duvarı, Kırağı, Kar Küresi, nihai Tipi — yavaşlatan ve yakan alan), **Fay** (Öncü: Sarsıntı Bombası, Fay Hattı — duvar ardına geçen şerit, Yer Dinleme, nihai Büyük Kırılma), **Nöbet** (Gözcü: Alarm, Kalkan Takviyesi, Taret — vurulunca bozulur, nihai Fener). Sarsılan oyuncu yavaşlar, dağılımı artar ve görüşü titrer; botlarda isabet düşer.
- Ağ: yeni yetenekler mevcut `ab`/`abx` olaylarını kullanır; bozulan taret için `zd` olayı eklendi. Bıçaklar 9. silah sırası (4 bitlik silah alanına sığar).
- Botlar yeni yetenekleri kullanır (savunmada taret/alarm, saldırıda duman/fay hattı/kalkan, hedefe göre atış açısı).
- `?debug` ek kısayolları: `map`, `mapCheck`, `freeze`, `sim`, `setSim`, `revealed`, `zoneList`.

### Testler

- `node --check` ve ESLint temiz.
- Dört haritada `mapCheck`: tüm doğuş/taktik noktaları serbest hücrede ve iki doğuştan da ulaşılabilir, kurma noktaları bölge içinde; kurulum 0–50 ms.
- Playwright: her haritada oyun içi ekran görüntüsü; dört yeni ajanın tüm C/Q/E/X yetenekleri; donmuş bota karşı etkiler (Fay Hattı ve Sarsıntı Bombası botu sersemletti, Yer Dinleme ve Büyük Kırılma gösterdi, taret 100 → 52 can, Kalkan Takviyesi 0 → 25 kalkan, Tipi yavaşlattı ve yaktı, Fırtına Bıçakları iki atışta öldürüp şarjörü doldurdu); Üçyol, Buzul ve Kumsaray'da 5v5 bot maçı.

## 2026-10-19 — Wood Turning, mobil torna oyunu tarzında

### Yapılanlar

- `wood-turning/`: Yeniden yazıldı (Play Store sayfası bu ortamdan açılamadığı için türün bilinen akışına göre). Işıklı, dönen 3B görünümlü kütük ve koddan üretilen ahşap damarı; parmağın biraz üstünde duran keski; Kaba/Oluk/İnce uçlar; kıvrılan talaşlar ve tezgâhta biriken yonga; derin kesimler kırmızı. Aşamalar Oy → Zımpara → Boya (her seviye 1–4 renk bandı ister) → yan yana karşılaştırma, puan ve 1–3 yıldız. "Seviye N" ilerlemesi, 20 şekil (sonrası sabit tohumla), her 5. seviye serbest tasarım (×1,5). Mağaza sekmeleri: Keski, Ahşap, Boya, Atölye; son 12 yıldızlı iş koleksiyon rafında. Dikey telefonda torna dik durur.
- `casual-profile.js`: `logs` (Kayın ücretsiz; Meşe 120, Ceviz 260, Kiraz 420, Zebrano 700, Abanoz 1100 CM) ve `chisels` (Çelik ücretsiz; Karbür 150, Şam Çeliği 400, Elmas 900 CM; kesim hızı) katalogları, `ownedLogs/selectedLog/ownedChisels/selectedChisel`, `woodTurning.level/stars/shelf`, `buyLog`, `selectLog`, `buyChisel`, `selectChisel`, `turnStars`. `awardWoodTurning({ score, level, freeDesign })` eski çağrılarla uyumlu. Sürüm `?v=16` (tüm sürümlü sayfalar).

### Testler

- `node --check`, `git diff --check` temiz; aktif kodda localStorage yok.
- Playwright 1440 px ve 390×844: gerçek sürüklemelerle beş seviye, ödül, seviye atlama, mağaza alımı ve yenileme sonrası kalıcılık; misafir oynayıp sonuçtan giriş yapınca ödülün alınması; hile önizlemesi kayıt yapmadan; 320/390/1000/1440 px ve yatay telefonda taşma ve konsol hatası yok.

## 2026-10-19 — Hakkında sayfası

- `about.html`: Tüm oyunların amacı, kontrolleri ve CM kazanımı; oyunlara hızlı bağlantılar ve her kartta "Oyna" düğmesi. Dashboard stilini (`style.css?v=18`) kullanır.
- `index.html`, `style.css`: Üst çubuğa "Oyunlar" ve "Hakkında" bağlantıları. 720 px altında üst çubuk taşmasın diye logo yanındaki "CasualPass" yazısı gizlenir.
- Test: Playwright 1440/390/320 px — dashboard'dan Hakkında'ya ve geri gidiş, 11 kart, yatay taşma ve sayfa hatası yok.

## 2026-10-19 — Kendiliğinden güncelleme

- Sitede service worker yok; ana ekrana eklenen uygulama ve GitHub Pages önbelleği (10 dk) eski HTML'i tutabiliyordu. `version.json` eklendi; `shared-settings.js` (`?v=8`, tüm sayfalar) açılışta ve uygulamaya dönülünce bu dosyayı önbelleksiz okur, sürüm çerezdekinden farklıysa sayfayı `?v=<sürüm>` ile yeniden yükler. **Her yayında `version.json` içindeki `v` değeri değiştirilmeli.**
- Yanlışlıkla eklenen `shots/dash_top.png` silindi.

## 2026-10-19 — PWA ve çevrimdışı oyun

- `manifest.webmanifest`, `icons/` (192, 512, maskable 512, apple-touch 180, favicon): ana ekrana eklenince tam ekran uygulama olarak açılır. Tüm sayfalarda manifest/simge/`apple-mobile-web-app-*` etiketleri; dashboard ve Hakkında'da `<meta name="cp-page" content="hub">`.
- `sw.js` (`tools/sw.template.js`'ten `tools/build-sw.py` ile üretilir): sitedeki tüm dosyaları ve sayfaların `?v=` ile istediği tam adresleri kurulumda önbelleğe alır. Sayfalar ağ öncelikli (çevrimiçiyken taze, değilse önbellek), diğer dosyalar o sürümün önbelleğinden; Google Fonts çalışma anında önbelleğe alınır. `version.json` aynı içerik özetini taşır.
- **Her yayından önce `python3 tools/build-sw.py` çalıştırılmalı**; dosyalar değişince sürüm değişir, eski önbellek silinir.
- `shared-settings.js` (`?v=9`): service worker'ı kaydeder; uygulamaya dönülünce `version.json`'ı önbelleksiz okuyup yeni sürüm varsa service worker'ı günceller. Yeni dosyalar hazır olunca dashboard/Hakkında hemen, oyun sayfaları yalnızca açılışın ilk 6 sn'sinde yenilenir (oyun ortasında sayfa yenilenmez; sonraki açılışta yeni sürüm gelir).
- `chess-game/vendor/chess.js`: chess.js 0.10.3 npm paketinden (lisans yanında); Chess artık CDN'e bağlı değil.
- Çevrimdışı çalışmayanlar: Arena FPS ve Vektör'ün çevrimiçi odaları (PeerJS sunucusu gerekir), freesound.org'dan gelen birkaç tıklama sesi (Snake, 2048, XOX, Wood Turning; sessiz kalır).

### Testler

- Playwright: ilk açılışta 81 adres önbelleğe alındı, sayfa service worker kontrolünde; internet kesikken 12 sayfanın hepsi açıldı (Chess motoru ve Three.js yüklü, sayfa hatası yok), Vektör'de tek oyunculu maç başladı.
- Güncelleme: Hakkında sayfası değiştirilip `build-sw.py` çalıştırıldı, uygulamaya dönüş olayıyla sayfa yeni içerikle yenilendi ve eski önbellek silindi.

## 2026-10-20 — Kayıt dosyası (dışa/içe aktarma, 7-3-1 doğrulama)

- `casual-save.js` (`window.CasualSave`): `cp_*` ve `casualpass_*` çerezlerinin hepsini (`cp_site_version` hariç) ham değerleriyle JSON dosyasına yazar (`casualpass-kayit-YYYY-AA-GG.json`; telefonda paylaşım menüsü, masaüstünde indirme). Bütünlük: her çerez için bir 7-3-1 kontrol hanesi (karakter kodları 7, 3, 1 ağırlıklarıyla toplanır, mod 10), tüm yük için bir hane daha (`check731`, ör. `873-6`) ve tuz + yük + hanelerden SHA-256 mühür (`seal`). Tuz sayfada olduğu için bu yalnızca değiştirildiğini gösterir; kodu okuyan birini durduramaz.
- İçe aktarma: dosya biçimi ve çerez adları/değerleri denetlenir (yalnızca bizim çerezler, `;`/satır sonu yok, ≤4000 karakter). Doğrulanırsa "Kaydı yükle" onayı; doğrulanamazsa "Bu dosya değiştirilmiş olabilir… Yine de bu kayıt dosyasıyla devam etmek istiyor musunuz?" uyarısı. Kabul edilirse mevcut çerezler silinip dosyadakiler yazılır, sayfa yenilenir; doğrulanmamış dosya `cp_save_unverified` çereziyle işaretlenir ve dashboard'da uyarı görünür.
- `index.html` (dashboard'da "Kayıt dosyası" paneli ve `<dialog>`), `script.js?v=13`, `style.css?v=19`, `about.html` notu.

### Testler

- Playwright 390 px: günlük ödülle 35 CM → dışa aktarma (3 çerez, `873-6`) → çerezleri silme (0) → içe aktarma "doğrulandı", bakiye 35'e döndü; profildeki bakiye elle +9000 yapılınca "Kayıt doğrulanamadı" uyarısı (7-3-1 ve mühür tutmuyor), Vazgeç bakiyeyi değiştirmedi, kabul 9.035 yükleyip "doğrulanmamış" uyarısını gösterdi; CasualPass kaydı olmayan dosya reddedildi; sayfa hatası yok.

## 2026-10-20 — CasualFish yeni motor

### Yapılanlar

- `chess-game/casualfish.js`: CasualPass'in kendi motoru (Stockfish değil). Eski CasualFish yalnızca taş sayan 2–3 yarım hamlelik bir minimax'tı ve chess.js'in hamle üretimini kullandığı için saniyede ~1.500 pozisyona bakabiliyordu (chess.js her hamleye SAN üretiyor). Yeni motorun kendi tahtası var: 0x88 dizi, Zobrist anahtarı, yap/geri al; ~250 bin pozisyon/sn. Arama: kademeli derinleşme ve süre sınırı, negamax + alfa-beta + PVS, dönüşüm tablosu, boş hamle budaması, geç hamle azaltması, şah çekince uzatma, katil/geçmiş sezgileri, taş almaları sonuna kadar izleyen sakinlik araması; tekrar ve 50 hamle beraberlik sayılır. Değerlendirme: taş değerleri, kare tabloları (şah için orta oyun/oyun sonu karışımı), fil çifti, geçer/ikili/yalnız piyon, açık hatta kale.
- Seviyeler (`LEVELS`): Kolay (1 yarım hamle, sakinlik araması yok, ±220 gürültü, %30 rastgele hamle), Orta (3 yarım hamle, ±35 gürültü, 0,6 sn), Zor (1,5 sn), Usta (3 sn; başlangıç pozisyonunda ~8+ yarım hamle). Seçici 1–4 (`index.html`).
- `chess-game/casualfish-worker.js`: arama Web Worker'da; sayfa donmaz. Ana iş parçacığı hamle listesini (`e2e4` biçiminde) yollar, motor tekrarları görür; ölümsüzlük hilesinde izinli hamleler listesi gider. Worker yoksa eski minimax yedek olarak kalır. `script.js?v=2`.

### Testler

- Perft (5 standart pozisyon, başlangıç derinlik 4 = 197.281, Kiwipete derinlik 3 = 97.862 dahil) chess.js ile birebir.
- Tek hamlede mat (Rd8#) ve asılı vezir alma bulundu.
- Node'da eski motora karşı 10'ar oyun: yeni Orta–eski Orta 10/10, yeni Orta–eski Zor 10/10, yeni Zor–eski Zor 10/10. Kolay yeni başlayanlara göre ayarlandı: eski Kolay'a (rastgele) 10/10, eski Orta'ya 1,5/10, eski Zor'a 0/10.
- Playwright: Usta'ya karşı 4 hamle; her yanıt geldi, düşünürken ana iş parçacığı gecikmesi 0–11 ms, sayfa hatası yok.
