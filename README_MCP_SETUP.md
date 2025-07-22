# 🎯 YÖK Akademik MCP + Agenta Entegrasyon Rehberi

Bu rehber, YÖK Akademik projesini MCP (Model Context Protocol) üzerinden Smithery ve Agenta ile nasıl entegre edeceğinizi göstermektedir.

## 🚀 Kurulum Adımları

### 1. Dependencies'leri Kurun
```bash
npm install
```

### 2. Next.js Dev Server'ı Başlatın
```bash
npm run dev
# Veya
next dev
```
API'lar `http://localhost:3000` adresinde çalışacak.

### 3. MCP Server'ı Test Edin
```bash
npm run mcp-server
# Veya direkt
node mcp-server.js
```

## 🛠️ MCP Tools

### `akademisyen_ara`
Akademisyen arar ve tek profil bulursa otomatik işbirlikçileri getirir.

**Parametreler:**
- `name` (zorunlu): Akademisyen adı soyadı  
- `email` (opsiyonel): Email adresi
- `fieldId` (opsiyonel): Alan ID'si
- `specialtyIds` (opsiyonel): Uzmanlık ID'leri ["all"] veya belirli ID'ler

**Örnek:**
```json
{
  "name": "Nurettin Şenyer",
  "email": "nurettin.senyer@samsun.edu.tr",
  "fieldId": 8,
  "specialtyIds": ["all"]
}
```

### `isbirlikci_bul`
Seçilen akademisyen için işbirlikçileri bulur.

**Parametreler:**
- `sessionId` (zorunlu): akademisyen_ara'dan dönen session ID
- `profileId` (zorunlu): Seçilen profilin ID'si

**Örnek:**
```json
{
  "sessionId": "session_1753174105671_pc1i5mlvk",
  "profileId": 21
}
```

## 📋 Sistem Akışı

1. **Tek Profil Bulunursa:**
   - `akademisyen_ara` → Profil + İşbirlikçiler otomatik getirilir ✅

2. **Çoklu Profil Bulunursa:**
   - `akademisyen_ara` → Profil listesi gösterilir
   - Kullanıcı seçim yapar
   - `isbirlikci_bul` → Seçilen profilin işbirlikçileri getirilir ✅

## 🔧 Smithery Entegrasyonu

### Smithery'ye MCP Server Ekleme

1. **Smithery CLI'ı kurun:**
```bash
npm install -g @smithery/cli
```

2. **MCP Server'ı register edin:**
```bash
smithery add ./smithery.json
```

3. **Server'ı başlatın:**
```bash
smithery run yok-akademik
```

## 🤖 Agenta (Masta Agent) Entegrasyonu

### Agent Kurulum

1. **Agenta'ya gidin:** https://cloud.agenta.ai veya local Agenta instance
2. **Yeni Agent oluşturun**
3. **MCP Integration'ı etkinleştirin**
4. **YÖK Akademik MCP Server'ı bağlayın**

### Agent Konfigürasyonu

```json
{
  "name": "YÖK Akademik Assistant",
  "description": "Akademisyen arama ve işbirlikçi bulma asistanı",
  "mcp_servers": ["yok-akademik"],
  "tools": ["akademisyen_ara", "isbirlikci_bul"],
  "system_prompt": "Sen YÖK akademik sisteminde araştırmacı bulma konusunda uzman bir asistansın. Kullanıcılar akademisyen ararken ve işbirlikçilerini bulurken sana yardım edeceksin. Sonuçları net ve organize şekilde sunacaksın."
}
```

## 💬 Örnek Konuşma Akışı

**Kullanıcı:** "Nurettin Şenyer isimli akademisyeni ara"

**Agent:** `akademisyen_ara` tool'unu çağırır:
```json
{"name": "Nurettin Şenyer"}
```

**İki Senaryo:**

### Senaryo 1: Tek Profil
```
✅ Akademisyen Bulundu ve İşbirlikçiler Getirildi

📝 Profil: Nurettin Şenyer
🏛️ Kurum: Samsun Üniversitesi
📧 Email: nurettin.senyer@samsun.edu.tr
📊 Toplam İşbirlikçi: 15

🤝 İşbirlikçiler:
1. Dr. Ahmet Yılmaz - İstanbul Teknik Üniversitesi
2. Prof. Dr. Elif Kaya - Boğaziçi Üniversitesi
...
```

### Senaryo 2: Çoklu Profil
```
🔍 3 Akademisyen Profili Bulundu

1. Nurettin Şenyer
   🏛️ Kurum: Samsun Üniversitesi  
   📧 Email: nurettin.senyer@samsun.edu.tr
   🆔 Profile ID: 21

2. Nurettin Şenyer
   🏛️ Kurum: Ankara Üniversitesi
   📧 Email: nsenyer@ankara.edu.tr  
   🆔 Profile ID: 45
```

**Kullanıcı:** "1. profili seç"

**Agent:** `isbirlikci_bul` tool'unu çağırır ve işbirlikçileri getirir.

## 🧪 Test Komutları

```bash
# Next.js dev server başlat
npm run dev

# MCP server test
npm run mcp-server

# Tool test (başka terminal)
echo '{"method": "tools/list"}' | npm run mcp-server

# API test
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"name": "test akademisyen"}'
```

## 🎉 Sonuç

Artık YÖK Akademik sisteminiz:
- ✅ MCP protokolü ile çalışıyor
- ✅ Smithery ile entegre
- ✅ Agenta ile konuşabiliyor
- ✅ Akıllı akademisyen arama yapıyor
- ✅ Otomatik işbirlikçi bulabiliyor

**İyi çalışmalar! 🚀** 