# 🤖 Agenta Entegrasyon Rehberi

## ✅ Test Sonuçları
- MCP Server: **Çalışıyor**
- Tools: **2 adet hazır** (`akademisyen_ara`, `isbirlikci_bul`)
- JSON-RPC: **Aktif**
- Schema: **Doğru formatta**

## 🎯 Agenta Kurulum

### 1. Agenta Cloud (Önerilen)
1. https://cloud.agenta.ai adresine gidin
2. Yeni hesap oluşturun/giriş yapın
3. "New Agent" oluşturun

### 2. Agent Konfigürasyonu

```json
{
  "name": "YÖK Akademik Asistanı",
  "description": "Akademisyen arama ve işbirlikçi bulma uzmanı",
  "system_prompt": "Sen YÖK akademik sisteminde araştırmacı bulma konusunda uzman bir asistansın. Kullanıcı akademisyen adı verdiğinde 'akademisyen_ara' tool'unu kullan. Eğer birden fazla profil çıkarsa, kullanıcıya listele ve seçim yaptır, sonra 'isbirlikci_bul' tool'unu sessionId ve profileId ile çağır. Sonuçları düzenli ve güzel formatta sun.",
  "temperature": 0.7,
  "max_tokens": 2000
}
```

### 3. MCP Server Bağlama

**Seçenek A: Smithery üzerinden**
```bash
# 1. Smithery login
npx @smithery/cli login

# 2. Server deploy
npx @smithery/cli dev mcp-server.js

# 3. Agenta'da MCP Integration
# - Server: yok-akademik
# - URL: Smithery tarafından verilen URL
```

**Seçenek B: Direct Integration**
```bash
# 1. MCP Server'ı port 8080'de çalıştır
node mcp-server.js

# 2. Agenta'da Custom MCP Server
# - URL: ws://localhost:8080 veya http://localhost:8080
# - Tools: akademisyen_ara, isbirlikci_bul
```

### 4. Tools Aktif Etme

Agenta agent settings'de:
- ✅ `akademisyen_ara` - Enable
- ✅ `isbirlikci_bul` - Enable

## 💬 Test Konuşması

### Senaryo 1: Tek Profil
**Kullanıcı:** "Nurettin Şenyer isimli akademisyeni ara"

**Agent Akışı:**
1. `akademisyen_ara` tool çağrısı: `{"name": "Nurettin Şenyer"}`
2. API response: Tek profil + işbirlikçiler
3. Agent: Güzel formatta sonuç sunar

### Senaryo 2: Çoklu Profil
**Kullanıcı:** "Ahmet Yılmaz isimli akademisyeni ara"

**Agent Akışı:**
1. `akademisyen_ara` tool: `{"name": "Ahmet Yılmaz"}`
2. API: 3 farklı profil döner
3. Agent: Profilleri listeler, seçim ister
4. Kullanıcı: "2. profili seç"
5. `isbirlikci_bul` tool: `{"sessionId": "session_xyz", "profileId": 45}`
6. Agent: İşbirlikçileri güzel formatta sunar

## 🔧 Troubleshooting

### Problem: API bağlantı hatası
**Çözüm:** Next.js dev server'ı çalıştırın
```bash
npm run dev
```

### Problem: MCP tools görünmüyor
**Çözüm:** MCP server'ı restart edin
```bash
node mcp-server.js
```

### Problem: Smithery API key hatası
**Çözüm:** 
1. https://smithery.ai/account/api-keys adresinden key alın
2. `npx @smithery/cli login` ile giriş yapın

## 🎉 Başarı Kriterleri

✅ Agent akademisyen adı alıp arama yapabiliyor
✅ Tek profilde otomatik işbirlikçi getirebiliyor  
✅ Çoklu profilde seçim yaptırabiliyor
✅ Sonuçları düzenli format 