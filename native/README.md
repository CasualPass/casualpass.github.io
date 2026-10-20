# CasualPass Android ve iOS kabukları

Android WebView ve iOS/iPadOS WKWebView aynı `https://casualpass.github.io/` uygulamasını açar. Oyun kodu APK/IPA içine paketlenmez. İlk açılış internet gerektirir; sonrasında web service worker’ının kaydettiği içerik çevrimdışı kullanılabilir. Native cihazlarda çevrimdışı davranış ayrıca doğrulanmalıdır.

## İki bağımsız sürüm

- **Web sürümü:** `version.json` ve `sw.js`; yayın öncesi `python3 tools/build-sw.py`. Main’e alınan web değişikliği GitHub Pages’te yayınlandıktan sonra iki kabuk da aynı güncelleme mekanizmasını kullanır. Yeni oyun veya oyun düzeltmesi için APK/IPA yeniden derlemek gerekmez. Oyun ortasında yenileme ertelenir.
- **Kabuk sürümü:** Android `versionCode`/`versionName`, iOS `CURRENT_PROJECT_VERSION`/`MARKETING_VERSION`; başlangıç `1 / 1.0.0`. İzin, native köprü, SDK/işletim sistemi veya kabuk davranışı değişirse yeni uygulama paketi gerekir.
- PWA kurulum seçeneği mevcut manifest üzerinden kullanılmaya devam eder. PWA, Android ve iOS kabuğunun yerel kayıt/oturum depoları ayrı olabilir; taşıma için hesapla bulut aktarımı veya JSON dosyası kullanılır. Otomatik hesap/kayıt birleştirme yoktur.

## Android

- Android 8+ (API 26), compile/target SDK 35; Java 17, Gradle 8.11.1, Android Gradle Plugin 8.9.2.
- `android/` klasörünü Android Studio ile aç veya SDK/JDK hazır ortamda `cd native/android && ./gradlew :app:assembleDebug` çalıştır.
- `.github/workflows/android-app.yml` native Android dosyaları pushlandığında test APK’sını derler. Actions → Android app → `CasualPass-Android-debug` artifact’i içindeki `app-debug.apk` telefona kurulabilir.
- Bu **debug imzalı test APK’sıdır**; Google Play’e yüklenmek üzere üretim anahtarıyla imzalanmış paket değildir. CI’ın geçici debug anahtarı yeni build’de değişebilir; iki farklı debug APK arasında yerinde yükseltme garantisi yoktur. Uygulamayı kaldırmak yerel veriyi siler, önce yedek al. Normal web güncellemeleri APK kurulumunu gerektirmez.
- Üretim dağıtımı için sabit ve özel imzalama anahtarı ile release/AAB hazırlanmalıdır. Anahtarlar repoya konmaz. Telefonun USB/debug bilgileri bu projede saklanmaz.

## iPhone ve iPad

- iOS/iPadOS 16+, SwiftUI + WKWebView; iPhone ve iPad, yatay/dikey ekran desteği.
- `ios/CasualPass.xcodeproj` projesini Xcode’da aç, `CasualPass` scheme’ini seç. Simülatör build’i imzasız derlenebilir.
- Gerçek cihaz veya TestFlight/App Store için Xcode Signing & Capabilities altında kendi Apple geliştirme takımını seç; Archive → Distribute App ile imzala. Apple hesabı ve sertifikası bu projeye eklenmez.
- İmzasız `.app.zip` cihazına doğrudan kurulabilecek IPA değildir. Simülatör paketi de yalnızca uyumlu Xcode simülatöründe çalışır.
- Derleme: `xcodebuild -project native/ios/CasualPass.xcodeproj -scheme CasualPass -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath /tmp/casualpass-ios CODE_SIGNING_ALLOWED=NO build`.

## Web ve native sınırı

- Kabuk içi gezinme yalnızca `https://casualpass.github.io` kaynağına izin verir; diğer HTTPS/mailto bağlantıları sistem uygulamasına açılır. HTTP/özel şema gezinmesi ve sertifika hatası atlatma yoktur.
- JavaScript ve DOM storage açık, veri deposu kalıcıdır. Android sistem yedeği kapalıdır; kullanıcı hesabı/bulut kaydı veya JSON dosyasıyla taşır.
- Bulut yükleme ve kayıt dosyası doğrulama onayları native dialog olarak gösterilir. Dosya seçimi kullanıcı tarafından yapılır; geniş depolama izni yoktur.
- JSON dışa aktarma için Android origin/main-frame sınırlandırılmış WebMessageListener, iOS app-bound WKScriptMessageHandlerWithReply kullanır. Köprü yalnızca kullanıcıya kayıt paylaşma/kaydetme ekranı açar; keyfi dosya veya cihaz API’si sunmaz. Geriye dönük uyum için eski kabuklarda köprü yoksa web paylaşım/indirme yolu kalır.
- Android köprüsü için güncel Android System WebView gerekir. Dosya alma WebView/WKWebView’in kullanıcı dosya seçicisini kullanır.

## Gelecekte gamepad

Gamepad henüz eklenmedi. Oyunlar webde kaldığı için ortak web giriş katmanına `navigator.getGamepads()` ve bağlantı olayları eklenebilir; standart tarayıcı API’siyle çalışan eşleme webden güncellenir. Hangi kontrolcünün Android WebView/WKWebView’e aktarıldığı gerçek cihazlarda test edilmelidir. Native `GameController`/Android input köprüsü gerekirse bu kabuk değişikliği olur ve yeni uygulama paketi ister. Mevcut kabuklar gamepad olaylarını elle tüketmez.


## 1.0.1 — Native titreşim

Kabuk sürümü 1.0.1 (build 2), web sürümünden ayrıdır. iOS ana frame ve yalnızca `https://casualpass.github.io` kaynağından gelen `casualpassHaptic` mesajlarını UIKit selection/impact/notification feedback’e yönlendirir. Android aynı origin/frame kısıtlı `CasualPassHaptics` WebMessageListener ve VIBRATE izni ile sabit desenleri çalar. Yalnızca tap/move/success/win/fail/cancel adları kabul edilir, rastgele API veya süre çalıştırılmaz. Uygulama arka plandayken çalmaz; kısa darbeler frekans sınırlıdır.

Web helper köprü varsa onu tercih eder; eski kabuklarda mevcut web fallback sürer. Native köprüyü almak için 1.0.0’dan 1.0.1’e bir kez yeniden kurulum/güncelleme gerekir. Sonraki oyun ve animasyon değişiklikleri webden gelir. Cihazda titreşim motoru ve sistem izinleri/ayarları sonucu etkiler; build başarısı hissedilen titreşim testi değildir.

Web düzeltmesi: eski iOS DOM/switch titreşim denemesi kaldırılmıştır. 1.0.1 native köprü varken gerçek API kullanılır; iOS Safari’de destek yoksa titreşim çalınmaz. Dashboard “Titreşim · Uygulama” etiketiyle köprünün algılandığını gösterir. Bu web düzeltmesi yeni native rebuild gerektirmez.
