# CasualPass 🎮

CasualPass, GitHub Pages üzerinde doğrudan çalışabilen reklamsız ve bağımlılıksız mini oyun koleksiyonudur. Ana sayfa sade bir dashboard olarak oyunları tek ekranda sunar:

- **Wood Turning:** Hedef formu şekillendir, zımparala, boya ve CasualMoney kazan.
- **Snake:** Yemi kapıp rekorunu uzat.
- **2048:** Taşları birleştirip en yüksek skora ulaş.
- **XOX:** Yerel rakibe veya bota karşı üçlüyü kur.
- **Chess:** CasualFish motoruna karşı hamleni hesapla.
- **Son Hat (Beta):** Last War tarzı zombi koşusu. Şerit seç, kapılardan geçip birliğini büyüt, sandıkları vurup silah ve helikopter kap, boss’u durdur. Ganimetle üssünde bina kur, madenlerden altın/demir/yiyecek topla, kahraman çağırıp üç kişilik takım kur. Koşu başına en fazla 40 CM (8 altın = 1 CM).
- **Minerva Owl:** Minerva'nın baykuşuyla mermer sütunların arasından süzül; CasualMoney ile yeni baykuşlar aç.
- **Wood Blocks:** Ahşap blokları 9×9 tahtaya yerleştir; dolu satır, sütun ve 3×3 kareleri sil, CasualMoney ile yeni ahşaplar aç.
- **Vektör:** 5'e 5 taktik kahraman nişancı. Saldırıda çekirdeği bir bölgeye kur, savunmada engelle ya da çöz. Dört harita var: Liman, Kumsaray (çöl kalesi), Üçyol (A/B/C üç bölgeli teknopark) ve Buzul (kar yağışlı kutup üssü); menüden seçilir ya da rastgele gelir. Satın alma evresinde krediyle silah, kalkan ve yetenek al; sekiz ajanın (Kor, Sis, Ok, Kale, Rüzgâr, Ayaz, Fay, Nöbet) C/Q/E yetenekleri ve X nihai yeteneği var (duman, kör edici, ateş, keşif oku, tuzak teli, buz duvarı, sarsıntı, fay hattı, taret, alarm, tipi, fırlatma bıçakları…). Durarak ateş etmek isabetlidir, uzun taramada namlu kalıba göre kayar. Botlarla ya da oda koduyla arkadaşlarınla oynanır; boş yerleri botlar doldurur.
- **Arena FPS:** Üç boyutlu, çok oyunculu nişancı. Botlara karşı tek başına oyna ya da oda açıp 6 haneli kodu arkadaşlarına gönder; WebRTC ile tarayıcıdan tarayıcıya bağlanılır. Dört silah, el bombası, kayma/çömelme, çalılıkta saklanma, radar, skor tablosu ve dokunmatik kontroller vardır.

## Çerez tabanlı profil ve CasualMoney

CasualPass'ta sunucu hesabı, e-posta girişi ya da bulut senkronizasyonu kullanılmaz. Oturum, kullanıcı profili, CasualMoney, Wood Turning ilerlemesi, satın alınan temalar, oyun istatistikleri ve yüksek skorlar yalnızca birinci taraf tarayıcı çerezlerinde saklanır.

- Oturumu başlatmak günde bir kez **15 CM** verir.
- Günlük ödül günde bir kez **20 CM** verir.
- Wood Turning tamamlanan işin puanına göre CasualMoney kazandırır.
- Minerva Owl'da her 2 sütun 1 CM kazandırır (uçuş başına en fazla 40 CM, yeniden doğuş çarpanı uygulanır).
- Wood Blocks'ta her 50 puan 1 CM kazandırır (oyun başına en fazla 40 CM, yeniden doğuş çarpanı uygulanır). `Çam` varsayılan ahşaptır; `Ceviz` (90 CM), `Kiraz` (180 CM) ve `Abanoz` (360 CM) CasualMoney ile açılır.
- Minerva varsayılan baykuştur; `Kar Baykuşu` (80 CM), `Peçeli Baykuş` (150 CM), `Puhu` (260 CM), `Gece Baykuşu` (420 CM) ve `Altın Baykuş` (750 CM) CasualMoney ile açılır.
- Arena FPS'te her öldürme 2 CM, maç birinciliği +6 CM kazandırır (maç başına en fazla 40 CM, yeniden doğuş çarpanı uygulanır). `Standart` varsayılan silah kaplamasıdır; `Çöl` (100 CM), `Orman` (180 CM), `Kutup` (260 CM), `Kızıl` (420 CM) ve `Altın` (800 CM) CasualMoney ile açılır.
- Vektör'de her öldürme ve kazanılan her raunt 1 CM, maç zaferi +10 CM kazandırır (maç başına en fazla 40 CM). Silahlarda Arena FPS'te açılan kaplamalar kullanılır.
- `Liquid` varsayılan temadır; `Paper` (30 CM), `Neon` (180 CM) ve `Retro` (300 CM) temaları CasualMoney ile açılır.
- Çerezleri silmek profil, bakiye ve ilerlemeyi de siler. Bu bilerek seçilmiş, yalnızca-çerez tasarımının sonucudur.

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
