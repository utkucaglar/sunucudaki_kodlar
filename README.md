# YOK Akademik İşbirlikçi Bulucu

## Proje Amacı

Bu proje, YÖK Akademik Arama platformu üzerinden akademisyenlerin profil bilgilerini ve işbirlikçilerini kolayca bulmanızı sağlar. Kullanıcı, bir akademisyen ismiyle arama yapar; sistem, ilgili profil(ler)i ve varsa işbirlikçilerini otomatik olarak toplar ve kullanıcıya sunar.

## Özellikler

- **Akademisyen Arama:** İsimle arama yaparak YÖK Akademik’teki akademisyen profillerini bulur.
- **Çoklu Sonuç Desteği:** Birden fazla profil bulunduğunda seçim yapılabilir.
- **İşbirlikçi Analizi:** Seçilen akademisyenin işbirlikçileri otomatik olarak toplanır ve listelenir.
- **Profil ve Fotoğraf Kaydı:** Her arama için özel bir oturum klasörü oluşturulur, profil ve işbirlikçi fotoğrafları kaydedilir.
- **Modern ve Kullanıcı Dostu Arayüz:** Next.js, TailwindCSS ve modern React bileşenleriyle responsive arayüz.
- **Tema Desteği:** Karanlık/açık tema geçişi.
- **Gelişmiş Arama:** Şu an ilk 20 sonuç gösteriliyor, ileride sayfalama (paging) desteği eklenecek.

## Klasör Yapısı

```
.
├── app/                        # Next.js uygulama dosyaları
│   ├── api/                    # API route'ları (arama ve işbirlikçi toplama)
│   ├── components/             # Sayfa içi bileşenler
│   ├── globals.css             # Global stiller
│   ├── layout.tsx              # Ana layout
│   └── page.tsx                # Ana arama sayfası
├── components/                 # Ortak UI bileşenleri (Button, Card, ThemeToggle, vb.)
├── hooks/                      # React custom hook'ları
├── lib/                        # Yardımcı fonksiyonlar
├── public/
│   └── collaborator-sessions/  # Her arama için oluşturulan oturum klasörleri ve görseller
├── scripts/                    # Python scraping scriptleri
│   ├── scrape_yok.py           # Ana profil ve işbirlikçi scraping
│   ├── scrape_main_profile.py  # Sadece ana profil scraping
│   └── scrape_collaborators.py # Sadece işbirlikçi scraping
├── styles/                     # Ekstra stiller
├── package.json                # Proje bağımlılıkları ve scriptler
├── tailwind.config.ts          # TailwindCSS yapılandırması
├── tsconfig.json               # TypeScript yapılandırması
└── .gitignore                  # Git için hariç tutulan dosyalar
```

## Kurulum

### Gereksinimler

- Node.js (18+ önerilir)
- pnpm (veya npm/yarn)
- Python 3.x
- Google Chrome (veya Chromium)
- ChromeDriver (otomatik indirilir)
- pip ile: selenium, webdriver-manager, pillow, requests, vb.

### Adımlar

1. **Depoyu klonlayın:**
   ```sh
   git clone https://github.com/utkucaglar/YOK_Akademik_Isbirlikci-Bulucu.git
   cd YOK_Akademik_Isbirlikci-Bulucu
   ```

2. **Node.js bağımlılıklarını yükleyin:**
   ```sh
   pnpm install
   # veya
   npm install
   ```

3. **Python bağımlılıklarını yükleyin:**
   ```sh
   pip install selenium webdriver-manager pillow requests
   ```

4. **Geliştirme sunucusunu başlatın:**
   ```sh
   pnpm dev
   # veya
   npm run dev
   ```

5. **Scraping scriptlerini çalıştırmak için:**
   - Uygulama arayüzünden arama yapıldığında scriptler otomatik çalışır.
   - Manuel başlatmak için:
     ```sh
     python ./scripts/scrape_yok.py "Akademisyen Adı" <sessionId>
     ```

## Kullanım

- Ana sayfada akademisyen ismini girin ve arama yapın.
- Eğer birden fazla sonuç varsa, seçim yaparak devam edin.
- Seçilen akademisyenin işbirlikçileri otomatik olarak listelenir.
- Her arama için `public/collaborator-sessions/` altında bir oturum klasörü oluşur ve ilgili veriler burada saklanır.

## Teknik Detaylar

- **Backend:** Next.js API route'ları üzerinden Python scriptleri tetiklenir.
- **Scraping:** Python (Selenium) ile YÖK Akademik Arama sayfası gezilir, profil ve işbirlikçi bilgileri çekilir.
- **Frontend:** React, Next.js, TailwindCSS, Radix UI bileşenleri.
- **Veri Saklama:** Her arama için benzersiz bir sessionId ile klasör açılır, JSON ve görseller burada tutulur.
- **Tema:** Karanlık/açık tema desteği.

## Geliştirme Notları

- Şu an arama sonuçlarında ilk 20 kişi gösteriliyor, ileride sayfalama (paging) eklenecek.
- Python scriptleri Windows ve Linux uyumludur.
- Hatalar ve loglar terminalde gösterilir.

## Katkı ve Lisans

- Katkıda bulunmak için fork'layıp PR gönderebilirsiniz.
- Lisans: [MIT](LICENSE) (Varsa ekleyin) 