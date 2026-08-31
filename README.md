# CasualPass 🎮

CasualPass, GitHub Pages üzerinde doğrudan çalışabilen reklamsız ve bağımlılıksız mini oyun koleksiyonudur. Ana sayfa sade bir dashboard olarak beş oyunu tek ekranda sunar:

- **Wood Turning:** Hedef formu şekillendir, zımparala, boya ve CasualMoney kazan.
- **Snake:** Yemi kapıp rekorunu uzat.
- **2048:** Taşları birleştirip en yüksek skora ulaş.
- **XOX:** Yerel rakibe veya bota karşı üçlüyü kur.
- **Chess:** CasualFish motoruna karşı hamleni hesapla.

## Çerez tabanlı profil ve CasualMoney

CasualPass'ta sunucu hesabı, e-posta girişi ya da bulut senkronizasyonu kullanılmaz. Oturum, kullanıcı profili, CasualMoney, Wood Turning ilerlemesi, satın alınan temalar, oyun istatistikleri ve yüksek skorlar yalnızca birinci taraf tarayıcı çerezlerinde saklanır.

- Oturumu başlatmak günde bir kez **15 CM** verir.
- Günlük ödül günde bir kez **20 CM** verir.
- Wood Turning tamamlanan işin puanına göre CasualMoney kazandırır.
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
