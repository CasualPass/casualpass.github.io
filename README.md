# CasualPass 🎮

CasualPass, GitHub Pages üzerinde doğrudan çalışabilen reklamsız ve bağımlılıksız mini oyun koleksiyonudur. Ana sayfa altı hızlı erişim kartı sunar; tüm oyunlar arama ve tür filtreleriyle `market.html` kataloğundadır:

- **Wood Turning:** Hedef formu şekillendir, zımparala, boya ve CasualMoney kazan.
- **Maze Paint:** Kaydırarak topu duvara kadar yuvarla, tüm açık kareleri boya. Çözülebilir 36 bölüm (son 12 bölümde durak kareleri), ipucu, kaydırma/ok tuşları/WASD, geri alma ve kayıt desteği.
- **Nuts & Bolts:** Somunları aynı renkteki somunların üstüne veya boş cıvatalara taşı. Dört somun kapasiteli cıvatalar, çözülebilir 30 bölüm, çözüm arayan ipucu, geri alma ve çerezde kaldığın yerden devam etme. Renk simgeleri ve klavye desteği vardır.
- **Dino:** Kaktüslerden zıplayarak kaç, hızlanan koşuda rekorunu kır. Boşluk / ↑, dokunma veya Zıpla düğmesi; P ile duraklat/devam et. Rekor ve koşular ortak çerez istatistiklerine kaydedilir. Açık oturumda her 100 puan 1 CM verir; koşu başına 40 CM taban sınırına yeniden doğuş çarpanı uygulanır. Ödül koşu sonunda eklenir; hileli koşu kaydedilmez.
- **Snake:** Yemi kapıp rekorunu uzat.
- **2048:** Taşları birleştirip en yüksek skora ulaş.
- **XOX:** Yerel rakibe veya bota karşı üçlüyü kur.
- **Chess:** CasualFish motoruna karşı hamleni hesapla.
- **Son Hat:** 3B askerler ve zombi sürüleriyle Last War’dan esinlenen köprü savaşı. Şerit seç, kapılardan geçip birliğini büyüt, sandıkları vurup silah ve helikopter kap, boss’un işaretli saldırısından kaç, Boşluk veya dokunmatik düğmeyle hava desteği çağır. Ganimetle üssünde bina kur, madenlerden altın/demir/yiyecek topla, kahraman çağırıp üç kişilik takım kur. Koşu başına en fazla 40 CM (8 altın = 1 CM).
- **Minerva Owl:** Minerva'nın baykuşuyla mermer sütunların arasından süzül; CasualMoney ile yeni baykuşlar aç.
- **Wood Blocks:** Ahşap blokları 9×9 tahtaya yerleştir; dolu satır, sütun ve 3×3 kareleri sil, CasualMoney ile yeni ahşaplar aç.
- **Vektör:** 5'e 5 taktik kahraman nişancı. Saldırıda çekirdeği bir bölgeye kur, savunmada engelle ya da çöz. Dört harita var: Liman, Kumsaray (çöl kalesi), Üçyol (A/B/C üç bölgeli teknopark) ve Buzul (kar yağışlı kutup üssü); menüden seçilir ya da rastgele gelir. Satın alma evresinde krediyle silah, kalkan ve yetenek al; sekiz ajanın (Kor, Sis, Ok, Kale, Rüzgâr, Ayaz, Fay, Nöbet) C/Q/E yetenekleri ve X nihai yeteneği var (duman, kör edici, ateş, keşif oku, tuzak teli, buz duvarı, sarsıntı, fay hattı, taret, alarm, tipi, fırlatma bıçakları…). Durarak ateş etmek isabetlidir, uzun taramada namlu kalıba göre kayar. Botlarla ya da oda koduyla arkadaşlarınla oynanır; boş yerleri botlar doldurur.
- **Arena FPS:** Üç boyutlu, çok oyunculu nişancı. Botlara karşı tek başına oyna ya da oda açıp 6 haneli kodu arkadaşlarına gönder; WebRTC ile tarayıcıdan tarayıcıya bağlanılır. Dört silah, el bombası, kayma/çömelme, çalılıkta saklanma, radar, skor tablosu ve dokunmatik kontroller vardır.

## Çerez tabanlı profil ve CasualMoney

Hesapsız oynanabilir. Oyun profili, CasualMoney, ilerleme ve rekorlar birinci taraf tarayıcı çerezlerinde tutulur. İsteğe bağlı Supabase hesabıyla kullanıcı adı ve şifre üzerinden giriş/kayıt yapılır; dashboard’daki **Buluta kaydet / Buluttan getir** ile ilerleme cihazlar arasında aktarılır. Otomatik birleştirme/senkronizasyon yapılmaz.

- Oturumu başlatmak günde bir kez **15 CM** verir.
- Günlük ödül günde bir kez **20 CM** verir.
- Wood Turning tamamlanan işin puanına göre CasualMoney kazandırır.
- Minerva Owl'da her 2 sütun 1 CM kazandırır (uçuş başına en fazla 40 CM, yeniden doğuş çarpanı uygulanır).
- Wood Blocks'ta her 50 puan 1 CM kazandırır (oyun başına en fazla 40 CM, yeniden doğuş çarpanı uygulanır). `Çam` varsayılan ahşaptır; `Ceviz` (90 CM), `Kiraz` (180 CM) ve `Abanoz` (360 CM) CasualMoney ile açılır.
- Minerva varsayılan baykuştur; `Kar Baykuşu` (80 CM), `Peçeli Baykuş` (150 CM), `Puhu` (260 CM), `Gece Baykuşu` (420 CM) ve `Altın Baykuş` (750 CM) CasualMoney ile açılır.
- Arena FPS'te her öldürme 2 CM, maç birinciliği +6 CM kazandırır (maç başına en fazla 40 CM, yeniden doğuş çarpanı uygulanır). `Standart` varsayılan silah kaplamasıdır; `Çöl` (100 CM), `Orman` (180 CM), `Kutup` (260 CM), `Kızıl` (420 CM) ve `Altın` (800 CM) CasualMoney ile açılır.
- Vektör'de her öldürme ve kazanılan her raunt 1 CM, maç zaferi +10 CM kazandırır (maç başına en fazla 40 CM). Silahlarda Arena FPS'te açılan kaplamalar kullanılır.
- `Liquid` varsayılan temadır; `Paper` (30 CM), `Neon` (180 CM) ve `Retro` (300 CM) temaları CasualMoney ile açılır.
- Çerezleri silmek yerel profil, bakiye ve ilerlemeyi siler. Önceden buluta veya dosyaya yedeklediğin kaydı geri yükleyebilirsin.

Çerezlerdeki veriler kullanıcı tarafından değiştirilebilir. Bu nedenle CasualMoney gerçek para, rekabetçi skor veya güvenlik gerektiren satın alma akışları için uygun değildir.

## Yerelde çalıştırma

Herhangi bir bağımlılık ya da build komutu gerekmez:

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Ardından `http://127.0.0.1:4173/` adresini aç.

### Arena FPS ve çok oyunculu bağlantı

Arena FPS, depodaki `fps-game/vendor/` klasöründen `three.js` (r128) ve `PeerJS` (1.5.4) yükler; CDN'e bağlı değildir (lisanslar `fps-game/vendor/LICENSES.md`). Çok oyunculu odalar için oyuncular PeerJS'in ücretsiz sinyal sunucusu üzerinden eşleşir, ardından oyun verisi doğrudan WebRTC ile akar. Host merkezli (yıldız) yapıda konumlar 12 baytlık ikili kayıtlarla, en fazla 15 Hz ve güvenilmez/sırasız kanaldan gönderilir; yalnızca isabet, ölüm ve bomba gibi olaylar güvenilir kanaldan gider.

- İki cihaz doğrudan bağlanamazsa menüdeki **Gelişmiş bağlantı (TURN)** alanına kendi TURN sağlayıcının `iceServers` listesini yapıştırabilirsin; liste hiçbir yere kaydedilmez.
- Oyun internet üzerinden çalışır; LAN'a bağlı değildir. Eşleşme için internette PeerJS sunucusu gerekir, ardından veri iki tarayıcı arasında doğrudan akar. Aynı Wi-Fi'deki cihazlar otomatik olarak yerel ağ üzerinden bağlanır.
- İnternetsiz bir yerel ağda oynamak ya da kendi PeerJS sinyal sunucunu kullanmak için sayfayı `?signal=sunucu:port` ile aç (ör. `fps-game/index.html?signal=192.168.1.20:9000`).
- Oyun durumu her oyuncunun kendi tarayıcısında hesaplandığı için Arena FPS rekabetçi/hileye dayanıklı bir oyun değildir; arkadaşlarla oynamak içindir.

## GitHub Pages

Repository ayarlarında **Pages → Deploy from a branch** seçeneğinden `main` dalını ve kök dizini seç. Tüm oyun bağlantıları görecelidir; repo alt yolu altında da çalışır.

## License

MIT

## PWA ve çevrimdışı

Site ana ekrana eklenebilen bir PWA'dır; ilk açılışta tüm oyunlar telefona indirilir ve internetsiz oynanır (çevrimiçi odalar hariç). Yayından önce `python3 tools/build-sw.py` çalıştırın: `sw.js` önbellek listesini ve `version.json` sürümünü yeniden üretir.

## AI Generated

Bu proje büyük ölçüde AI araçlarıyla geliştirilmiştir.

<p><img src="ai-generated.svg" height="64" alt="AI Generated"></p>

## Supabase kullanıcı adı ve şifre

Giriş/kayıt için e-posta veya SMTP gerekmez. Kullanıcı adı 3–24 karakterdir (`a-z`, `0-9`, `_`); baş/son boşluklar temizlenir ve küçük harfe çevrilir. Supabase’in e-posta tabanlı Auth kimliği, `<kullanıcı-adı>@accounts.casualpass.invalid` biçiminde dahili bir tanımlayıcıya eşlenir. Bu posta almayan bir kimliktir; e-posta sahipliği iddiası veya e-postayla şifre sıfırlama yoktur. Kullanıcı adını ve şifreni güvenli yerde sakla.

- Parolalar HTTPS üzerinden Supabase Auth’a gider; Supabase bunları **bcrypt hash** olarak saklar. Uygulama şifreyi veya hash’ini kendi tablolarına, çerezlerine, localStorage’a veya oyun yedeklerine yazmaz. Hash’i istemcide üretip parola yerine göndermeyiz.
- Uygulama en az 6 karakter ve bcrypt sınırı nedeniyle en fazla 72 UTF-8 bayt kabul eder. Supabase Email sağlayıcısının Minimum password length ayarını 6 olarak tut.
- Dashboard’da giriş ve yeni hesap oluşturma vardır. Eski e-posta hesabı açıkken ayrı kullanıcı adı hesabı oluşturulabilir. Yerel ilerleme korunur; kullanıcı yeni hesaba **Buluta kaydet** ile aktarır. Eski Auth ID ve bulut kaydı değiştirilmez. Mevcut hesabın e-postasını değiştirmek doğrulama e-postası istediğinden SMTP’siz geçişte bu yöntem kullanılmaz. Yeni şifreyi kullanıcı kendisi formda girer.

### Sunucu kurulumu

1. `cloud-config.js`: HTTPS `url`, yalnızca açık `publishableKey`, `enabled: true`, `loginMode: 'password'`. Secret/service_role anahtarı tarayıcıya konmaz.
2. `supabase/schema.sql` şemasını uygula. `casual_profiles` tablosunda `auth.uid() = user_id` RLS politikaları vardır; anonim role tablo yetkisi verilmez. Uygulamaya özel bir parola tablosu yoktur.
3. Authentication → Sign In / Providers: **Allow new users to sign up** açık, **Confirm email** kapalı. Bu proje kullanıcı adı kimlikleri kullandığından gerçek e-posta doğrulaması yapılmaz. Email sağlayıcısı şifre girişinin altyapısı olarak açık kalır. E-posta değişimi/şifre değişimi bildirimleri için SMTP kullanılmaz; eski e-posta/OTP yardımcıları yalnızca geriye dönük kod uyumluluğu içindir, yeni arayüzde sunulmaz.
4. `python3 tools/build-sw.py` ile önbelleği üretip yayınla. Giriş ve bulut aktarımı internet ister; yerel oyunlar çevrimdışı sürer.

`casual-cloud.js`, Supabase Auth HTTP API’sini ve PostgREST’i kullanır; ek paket/CDN yoktur. Access/refresh token’ları `sb-casualpass-…` localStorage anahtarında tutulur. Bu, yalnızca-çerez oyun depolamasına auth için sınırlı istisnadır; giriş token’ları oyun yedeğine girmez. Depolama kapalıysa oturum sayfa ömrüyle sınırlıdır. Süresi yaklaşan token yetkili işlem öncesinde yenilenir; Web Locks desteklendiğinde yenilemeler sıraya alınır.

Giriş yerel ilerlemeyi otomatik yüklemez veya başka hesaba geçince silmez. Ortak cihazda yerel kayıt paylaşılır. Buluta yükleme açık onayla önceki bulut kaydını değiştirir. Getirme doğrulama ve önizlemeden sonra açık kullanıcı eylemiyle yerel kaydı değiştirir. Otomatik birleştirme yoktur; son yüklenen kayıt geçerlidir. CM istemcide hesaplanır; bulut kaydı hileye dayanıklı ekonomi sağlamaz.

Doğrulama: `node --test tools/test-cloud.cjs`. Testler taklit HTTP ile parola girişi/kayıt, eski hesaptan ayrı yeni hesap oluşturma ve hata halinde eski oturumun korunması, şifrenin saklanmaması, doğrulama, token yenileme, çıkış ve yedek/token ayrımını kapsar. Canlı kullanıcı adı/şifre testi ayrıca yapılmalıdır.

Kaynaklar: [Supabase password security](https://supabase.com/docs/guides/auth/password-security), [password-based Auth](https://supabase.com/docs/guides/auth/passwords).


## Otomatik güncelleme

Yeni sürüm yayınlandığında uygulama açılışta, sekmeye dönünce, bağlantı geri gelince ve görünür sekmede dakikada bir güncellemeyi kontrol eder. Yeni dosyalar hazır olduğunda dashboard/Hakkında yenilenir; hesap formu dolduruluyorsa veya hesap işlemi sürüyorsa bekler. Oyun sayfaları açılıştan 6 saniye sonra otomatik yenilenmez; yeni sürüm sonraki sayfa açılışında kullanılır. Yayın öncesi `python3 tools/build-sw.py` çalıştırılarak sürüm ve çevrimdışı önbellek listesi üretilmelidir. Bir PR dalına push yapmak canlı GitHub Pages sitesini güncellemez; yayınlanan dala alınması gerekir.


### Son Hat savaş görünümü

Son Hat, yerelde bulunan `fps-game/vendor/three.min.js` (Three.js r128) ile gerçek 3B köprü, asker/zombi animasyonları, silah sandıkları ve helikopter çizer. Karakter ve çevre modelleri proje için kodla oluşturulmuştur; Last War dosyaları kullanılmaz. WebGL yoksa veya bağlam kaybolursa Canvas 2D görünümü devreye girer. Savaş ekranı masaüstünde 620 px genişliğinde, telefonda ekran genişliğindedir.

İlk üç bölümde sağdaki ardışık `+1` kapıları ile soldaki silah sandığı arasında seçim yapılır; sonraki kapılar, sürüler ve helikopter sandığı kararları devam eder. Askerler otomatik ateş eder. Sürükleme / A-D / yön tuşlarıyla hareket edilir; **Boşluk / Hava desteği** 18 saniye beklemeli alan saldırısıdır. Boss’un kırmızı işaretlediği şerit 1,35 saniye sonra vurulur. Mevcut `cp_sonhat_v2` üs/kahraman kaydı ve ödül kuralları korunur.


### Nuts & Bolts

`nuts-bolts/` süre sınırı olmayan renk ayırma bulmacasıdır. İlk beş bölüm üç renklidir, her beş bölümde bir renk eklenir (en fazla sekiz). Tüm bölümler sabit tohum ve ters hamle üretimiyle çözülebilir oluşturulur. Geri alma geçmişi son 500 hamleyi bellekte tutar; sayfa yenilenince yalnızca tahta, bölüm, hamle sayısı ve tamamlanan bölümler geri gelir. `cp_nuts_v1` mevcut dosya/bulut yedeğine dahildir; bölüm değişimi seçilen bölümü baştan açar. CM ödülü yoktur.

Kural araştırması: [Nut Sort yayıncı açıklaması](https://play.google.com/store/apps/details?hl=en&id=com.zm.nuts), [Nuts & Bolts: Color Sort](https://play.google.com/store/apps/details?id=com.gsg.nutsandbolts). Dört somun kapasitesi ve 30 bölüm bu uygulamanın tasarım seçimidir; görseller ve bölüm düzenleri özgündür. Doğrulama: `node --test tools/test-nuts-bolts.cjs tools/test-nuts-ui.cjs`.


### Maze Paint

`maze-paint/` içinde top her kaydırışta duvara veya sınıra kadar gider ve geçtiği açık kareleri boyar. Boyalı kareler yeniden geçilebilir. Tüm açık kareler boyanınca bölüm tamamlanır. 36 bölüm 5×5’ten 8×8’e büyür; sabit tohumlu düzenler durma noktası grafiği ve tam kaplama çözümüyle doğrulanır. Süre/hamle sınırı ve CM ödülü yoktur. `cp_maze_v1` tahta, bölüm ve tamamlanma bilgisini ortak yedeklere dahil eder; son 300 hamlelik geri alma geçmişi yalnızca bellektedir.

Kural kaynağı: [Maze Paint: Roll & Fill yayıncı açıklaması](https://play.google.com/store/apps/details?id=com.willowcy.maze). Görseller ve bölümler bu proje için oluşturuldu. Test: `node --test tools/test-maze-paint.cjs tools/test-maze-ui.cjs`.


## Oyun remaster sürümü

Son Hat dışındaki 11 oyunun mevcut oyunları ve kayıtları üzerinde görsel/etkileşim yenilemesi yapıldı:

- **2048:** Hedef göstergesi, boş kare ve birleşme geri bildirimi; sonuç kaydedilmeden önce son hamleyi düğme veya U ile geri al.
- **XOX:** Son hamle ve kazanan çizgi vurgusu; devam eden turda geri al, bot cevabını ve Ultimate zorunlu tahta bilgisini de birlikte geri getir.
- **Chess:** Tahtayı çevir, görünüşe uygun klavye yönleriyle oyna; alınan taşlar ve mevcut konumun taş değeri farkını izle.
- **Snake:** Birbirine bağlı yuvarlak gövde, altın elma/kombo süre göstergesi ve sıraya alınan yön geri bildirimi.
- **Minerva Owl:** Dört gökyüzü evresi; 12 puandan sonra ↕ ile işaretlenmiş bazı sütunlar hareket eder.
- **Wood Blocks:** Oyun başına bir geri alma, bırakmadan önce puan/temizleme tahmini, atölye görünümü.
- **Arena FPS / Vektör:** Dokunmatik ateş düğmesinde basılı tutarken sürükleyerek nişan al; yeniden doldurmada nişangâh solar. Arena çömelme doğruluğunu yansıtır; Vektör beyaz isabet/altın kafa vuruşu işareti gösterir.
- **Wood Turning:** İnce ayar düğmesi kesme hızını %28’e indirir; yüzey aşamasında gerçek zımpara ilerlemesi gösterilir.
- **Nuts & Bolts:** Tamamlanan renk sayısı ve çözüm arayan ipucu. İpucu araması sınırlıdır, her kullanıcı konumunda çözüm bulacağı garanti edilmez.
- **Maze Paint:** Yeni kareye giden yön ipucu, toplam 36 bölüm ve 25–36’da topu yol ortasında durduran halkalı kareler. İlk 24 düzen değişmedi.

Tema panelindeki Titreşim ayarı çerezde saklanır. Vibration API bulunan cihazlarda desenler kullanılır; iOS uygulaması native köprüyü kullanır. iOS tarayıcısında gizli switch tıklaması kaldırıldı; destek yoksa titreşim denenmez. Kapama veya sekmeyi gizleme bekleyen darbeleri iptal eder. Yeni geri alma geçmişleri bellektedir, sayfa yenilemesinde korunmaz; sonuç kaydedildikten sonra 2048/XOX/Blocks geri alma kapalıdır. CM ödül tavanları ve mevcut kayıt anahtarları korunur.

Doğrulama: `node --test tools/*.cjs`. VM testleri gerçek tarayıcı, cihaz titreşimi ve iki cihazlı multiplayer testinin yerine geçmez.


## Android / iPhone / iPad uygulaması

`native/android` ve `native/ios` canlı CasualPass web uygulamasını açan native kabuklardır. Oyun sürümleri webdeki `version.json` üzerinden güncellenir; kabuk sürümü ayrı tutulur. Android test APK derlemesi GitHub Actions’tadır; iOS projesi Xcode ile imzalanır. [Derleme, kurulum, veri taşıma ve gelecekte gamepad notları](native/README.md).


### Maze Paint animasyonu ve native titreşim 1.0.1

Maze Paint, her hamlede tahtayı yeniden kurmak yerine mevcut kareleri ve topu kullanır. Tek `requestAnimationFrame` saati, topun konumunu ve yalnızca ulaştığı karelerin boyanmasını birlikte ilerletir. Hızlı yön girişlerinde son yön sıraya alınır; bölüm bitişi top ulaşınca görünür. Azaltılmış hareket/efekt kapalı ayarı anlık geçiş kullanır.

Native kabuk 1.0.1 (2), iOS UIKit ve Android Vibrator köprülerini ekler. Gerçek native titreşim için uygulamayı bu sürüme bir kez güncellemek gerekir; sonraki web oyun güncellemeleri için tekrar derleme gerekmez. Eski kabuklarda web fallback kalır. [Native kurulum ve köprü ayrıntıları](native/README.md).


### Minerva Owl odak düzeltmesi

Gizli iOS switch tıklaması oyundan odağı alıp “Uçuş duraklatıldı” durumuna yol açabildiği için kaldırıldı. Native köprü veya gerçek Vibration API dışında titreşim yolu yoktur. Titreşim düğmesinde “Uygulama” yazıyorsa native köprü algılanmıştır. Ortak helper `v=11` ile yüklenir; bu, eski önbellekteki focus-stealing kodun kullanımını önler.


## Oyuncu tablosu ve aktif süre

Ana sayfadaki oyuncu tablosu toplam puan, aktif süre, oynanan oyun ve galibiyetleri gösterir. Puan, ortak oyun istatistiklerindeki `totalScore` değerlerinin toplamıdır; farklı oyunların puan ölçekleri aynı değildir. Puan/süre/oyun sayısı sıralaması ilk 50 hesabı getirir.

`casual-activity.js`, tüm oyunlarda ve dashboard’da aktif sayfa süresini `cp_activity_v1` çerezinde tutar. Gizli/odaksız sayfalar, hile açıkken geçen süre ve son girdiden 60 saniye sonrası sayılmaz. Tarihsel süre tahmin edilmez. Çerez temizlenirse yerel süre sıfırlanır; dışa aktarılan kayıt süreyi de içerir. Odak şartı aynı tarayıcıda birden fazla sekmenin birlikte süre yazmasını engeller.

Genel tablo için Supabase SQL Editor’da **`supabase/leaderboard.sql`** bir kez çalıştırılmalıdır. Uygulama bu migration'ı otomatik çalıştırmaz. Ardından hesabına giriş yapıp **Tabloya katıl / güncelle** düğmesiyle yalnızca kullanıcı adını ve dört sayısal istatistiği paylaş. Otomatik gönderim yoktur; e-posta, auth token ve kayıt JSON'u yayımlanmaz. Kullanıcı adı sunucuda doğrulanmış hesaptan türetilir. Doğrudan tablo erişimi kapalıdır; RPC yalnızca kendi hesabına yazar ve herkese ilk 50'nin özetini döndürür.

Tekrarlanan gönderimler toplamları artırmaz: sunucu her sütunda en yüksek toplamı tutar. Farklı cihazlar toplanmaz; cihazlar arası tam toplam için aynı dosya/bulut kaydını taşı. İstemci kaynaklı sayılar hileye dayanıklı bir yarışma sistemi değildir. Sunucu kurulmamışsa veya bağlantı yoksa açık durum mesajı ve yerel satır gösterilir; sahte oyuncu eklenmez.


## Market ve topluluk oyunları

`market.html` tüm 13 CasualPass oyununu ve topluluk oyunlarını içerir. Arama, oyun türü, CasualPass/Topluluk/Benim oyunlarım filtreleri; 24'erli topluluk sayfalaması vardır. Dashboard altı hızlı bağlantı tutar. Yerleşik katalog market HTML'indedir; yeni yerleşik oyun eklenirse dashboard `data-total-games` sayısını da güncelle.

Hesabına giriş yapan kullanıcı oyun adı, kısa açıklama, tür ve kendi sitesindeki herkese açık HTTPS bağlantısını paylaşabilir. Kart, bağlantıyı yeni sekmede `noopener noreferrer` ve `no-referrer` ile doğrudan açar. Topluluk oyunları CasualPass tarafından barındırılmaz; gömülmez, uzaktaki kodları önizleme için çekilmez. Dış oyunlarda CasualMoney veya CasualPass süre/puan takibi uygulanmaz. Başlık/açıklamalar metin olarak işlenir.

Supabase'de `supabase/market.sql` uygulanır. RLS açık tabloya doğrudan erişim yoktur. Yalnızca doğrulanmış kullanıcı kendi adına yayınlayabilir ve kendi ilanını yayından kaldırabilir; kullanıcı adı sunucuda hesap kimliğinden türetilir. Hesap başına en fazla 10 aktif ilan vardır. Aynı URL'yi tekrar paylaşmak kendi ilanını günceller; kaldırmak satırı silmez. Herkese açık liste yalnızca onaylanmış ve yayındaki ilanları döndürür. JavaScript/data/file/HTTP, kimlik bilgili, IP ve yerel/reserved alan adı bağlantıları istemcide ve sunucuda reddedilir. Yayınlanan URL ve oyun açıklaması herkese açık olur.


### Ana ekrana ekleme ve yönetici onayı

Market’te **Oyunu ana ekrana ekle / Ana ekrandan kaldır** ile en fazla 30 hızlı bağlantı seçilir. `cp_home_games_v1` çerezi yalnızca yerleşik oyun kimliklerini veya topluluk ilan UUID'lerini tutar; dış URL çerezden okunmaz. `home-screen.js` topluluk bağlantılarını her açılışta sunucudan yeniden doğrular ve yalnızca yayındaki/onaylı olanları açar. Mevcut altı oyun ilk kullanımda varsayılandır.

Yeni veya düzenlenen topluluk oyunları `pending` durumuna gider. Yalnızca yönetici `approved` yapınca genel listede ve ana ekran seçiminde görünür. Gönderen **Benim oyunlarım** filtresinde bekleme/reddedilme durumunu ve inceleme notunu görür. Onaylanan ilan düzenlenirse onayı sıfırlanır. İnceleme revizyonu, yöneticinin gördüğünden sonra değiştirilmiş içeriği yanlışlıkla onaylamasını engeller.

`supabase/market.sql` yeniden uygulanarak onay şeması ve RPC'ler kurulur; eski satırlar da varsayılan `pending` olur. Ardından **`supabase/market-admin-eymnyld.sql`** çalıştırılır: mevcut `eymnyld@accounts.casualpass.invalid` Auth kullanıcısının UUID'sini yönetici tablosuna ekler. Hesap yoksa açık hata verir; gelecekte bu adı alan birine otomatik yetki verilmez. Tarayıcı adı/çerez/metadata yönetici yetkisi sağlamaz. Diğer yöneticiler SQL Editor üzerinden gerçek Auth UUID'leri ile `casual_market_admins` tablosuna eklenebilir; istemcinin rol atama yetkisi yoktur.

Market içindeki **Yönetici paneli**, sunucu `market_is_admin` doğrulamasından sonra açılır. Onay bekleyen/onaylanan/reddedilen oyunlar incelenebilir; Onayla/Reddet ve isteğe bağlı not vardır. Yetki her sunucu çağrısında tekrar kontrol edilir.


### Kaydırmasız ana ekran

Ana ekran `dashboard.css` / `dashboard.js` ile ekran yüksekliğine sığan bir uygulama kabuğudur. Oyunlar/Sıralama/Hesap/Görünüş/Gelişim sekmeleri mevcut özellikleri korur. Sayfanın tamamı aşağı kaymaz; uzun hesap, tablo ve ayar içerikleri kendi sekmesinin içinde kaydırılabilir. Dosya yedeği Hesap sekmesindedir; eski `#save` ve `#save-title` bağlantıları da Hesap sekmesini açar. `#account-title` ve diğer mevcut bağlantılar doğru sekmeyi açar.

En fazla 30 oyun seçilebilir; oyun kartları masaüstünde 6, dar ekranda 4, kısa ekranlarda 3 veya 2 kartlık sayfalara ayrılır. “Grup başına” seçicisinden Otomatik, 2, 4, 6, 8, 12, 18 veya 30 oyun seçilebilir; `cp_home_page_size_v1` çerezi bu tercihi saklar. Önceki/Sonraki ile gezinilir. `cp_home_games_v1` değişmedi; mevcut seçimler korunur. Topluluk kimliği sorgu sınırı da 30'a çıkarıldı (`market.sql` güncel sürümü). Kart satır sayısı grup boyutuna göre değil ekrandaki gerçek oyun sayısına göre hesaplanır; bu yüzden 30 slot için seçilmiş 13 oyun paneli doldurur, altta boş satır kalmaz.


### Oyun kartı simgeleri

Ana ekran ve Market kartlarındaki simgeler tek bir çizgi stilinde SVG setinden gelir. `game-icons.js` içindeki `CasualGameIcons`, her oyun için 24×24 viewBox, `currentColor` kontur, 1.6 kalınlık ve yuvarlak uçlu/birleşimli çizimler üretir; `svg(id)` bilinmeyen kimliklerde ortak bağlantı simgesine (`FALLBACK`) düşer. Emoji ve CSS ile çizilen eski kart şekilleri kaldırıldı; JavaScript kapalıyken statik HTML de aynı satır içi SVG'yi gösterir, böylece ilk boyama ile çalışma zamanı görünümü aynıdır. Yeni simge eklemek yeterlidir; `node --test tools/test-game-icons.cjs` set ile oyun kataloğu ve kart HTML'i arasındaki tutarlılığı, stil bütünlüğünü ve emoji kalmadığını doğrular.
