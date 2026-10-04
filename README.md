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

## Çerez tabanlı profil ve CasualMoney

CasualPass'ta sunucu hesabı, e-posta girişi ya da bulut senkronizasyonu kullanılmaz. Oturum, kullanıcı profili, CasualMoney, Wood Turning ilerlemesi, satın alınan temalar, oyun istatistikleri ve yüksek skorlar yalnızca birinci taraf tarayıcı çerezlerinde saklanır.

- Oturumu başlatmak günde bir kez **15 CM** verir.
- Günlük ödül günde bir kez **20 CM** verir.
- Wood Turning tamamlanan işin puanına göre CasualMoney kazandırır.
- Minerva Owl'da her 2 sütun 1 CM kazandırır (uçuş başına en fazla 40 CM, yeniden doğuş çarpanı uygulanır).
- Wood Blocks'ta her 50 puan 1 CM kazandırır (oyun başına en fazla 40 CM, yeniden doğuş çarpanı uygulanır). `Çam` varsayılan ahşaptır; `Ceviz` (90 CM), `Kiraz` (180 CM) ve `Abanoz` (360 CM) CasualMoney ile açılır.
- Minerva varsayılan baykuştur; `Kar Baykuşu` (80 CM), `Peçeli Baykuş` (150 CM), `Puhu` (260 CM), `Gece Baykuşu` (420 CM) ve `Altın Baykuş` (750 CM) CasualMoney ile açılır.
- `Liquid` varsayılan temadır; `Paper` (30 CM), `Neon` (180 CM) ve `Retro` (300 CM) temaları CasualMoney ile açılır.
- Çerezleri silmek profil, bakiye ve ilerlemeyi de siler. Bu bilerek seçilmiş, yalnızca-çerez tasarımının sonucudur.

Çerezlerdeki veriler kullanıcı tarafından değiştirilebilir. Bu nedenle CasualMoney gerçek para, rekabetçi skor veya güvenlik gerektiren satın alma akışları için uygun değildir.

## Yerelde çalıştırma

Herhangi bir bağımlılık ya da build komutu gerekmez:

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Ardından `http://127.0.0.1:4173/` adresini aç.

## GitHub Pages

Repository ayarlarında **Pages → Deploy from a branch** seçeneğinden `main` dalını ve kök dizini seç. Tüm oyun bağlantıları görecelidir; repo alt yolu altında da çalışır.

## License

MIT
