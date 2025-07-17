import sys
import os
import base64
import re
import urllib.request
import json
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

def save_base64_image(data_url: str, filename: str):
    header, b64data = data_url.split(",", 1)
    img_data = base64.b64decode(b64data)
    with open(filename, "wb") as f:
        f.write(img_data)

def sanitize_filename(name: str) -> str:
    return re.sub(r'[^A-Za-z0-9ĞÜŞİÖÇğüşiöç ]+', '_', name).strip().replace(" ", "_")

# --- YÖK AKADEMİK KUTUCUK AYRIŞTIRICI (SON HAL) ---
def parse_labels_and_keywords(line):
    parts = [p.strip() for p in line.split(';')]
    left = parts[0] if parts else ''
    rest_keywords = [p.strip() for p in parts[1:] if p.strip()]
    left_parts = re.split(r'\s{2,}|\t+', left)
    green_label = left_parts[0].strip() if len(left_parts) > 0 else '-'
    blue_label = left_parts[1].strip() if len(left_parts) > 1 else '-'
    keywords = []
    if len(left_parts) > 2:
        keywords += [p.strip() for p in left_parts[2:] if p.strip()]
    keywords += rest_keywords
    if not keywords:
        keywords = ['-']
    return green_label, blue_label, keywords

if len(sys.argv) < 3:
    print("Kullanım: python scrape_main_profile.py <isim> <sessionId>", flush=True)
    sys.exit(1)

target_name = sys.argv[1]
session_id = sys.argv[2]

# --- YENİ KLASÖR YAPISI ---
SESSION_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "collaborator-sessions", session_id)
PROFILE_PICS_DIR = os.path.join(SESSION_DIR, "profile_pictures")
os.makedirs(PROFILE_PICS_DIR, exist_ok=True)

BASE = "https://akademik.yok.gov.tr/"
DEFAULT_URL = BASE + "AkademikArama/authorimages/photo_m.jpg"
default_photo_filename = os.path.join(PROFILE_PICS_DIR, "default_photo.jpg")
urllib.request.urlretrieve(DEFAULT_URL, default_photo_filename)

options = webdriver.ChromeOptions()
options.add_argument("--headless=new")
options.add_argument("--disable-gpu")
options.add_argument("user-agent=Mozilla/5.0")
prefs = {
    "profile.managed_default_content_settings.images": 2,
    "profile.managed_default_content_settings.stylesheets": 2,
    "profile.managed_default_content_settings.fonts": 2,
}
options.add_experimental_option("prefs", prefs)

print("[DEBUG] WebDriver başlatılıyor...", flush=True)
driver = webdriver.Chrome(
    service=Service(ChromeDriverManager().install()),
    options=options
)
driver.set_window_size(1920, 1080)

main_profile_info = ""
main_photo_file = f"profile_main.jpg"
main_photo_path = os.path.join(PROFILE_PICS_DIR, main_photo_file)

try:
    print("[DEBUG] Akademik Arama sayfası açılıyor...", flush=True)
    driver.get(BASE + "AkademikArama/")
    WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.ID, "aramaTerim"))
    )
    try:
        btn = WebDriverWait(driver, 5).until(
            EC.element_to_be_clickable((By.XPATH, "//button[contains(text(),'Tümünü Kabul Et')]"))
        )
        btn.click()
        print("[DEBUG] Çerez onaylandı.", flush=True)
    except Exception as e:
        print(f"[DEBUG] Çerez butonu bulunamadı: {e}", flush=True)
    try:
        kutu = driver.find_element(By.ID, "aramaTerim")
        kutu.send_keys(target_name)
        driver.find_element(By.ID, "searchButton").click()
        print(f"[DEBUG] '{target_name}' için arama yapıldı.", flush=True)
    except Exception as e:
        print(f"[ERROR] Arama kutusu veya butonu bulunamadı: {e}", flush=True)
        driver.quit()
        sys.exit(1)
    try:
        WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.LINK_TEXT, "Akademisyenler"))
        ).click()
        print("[DEBUG] 'Akademisyenler' sekmesine geçildi.", flush=True)
    except Exception as e:
        print(f"[ERROR] 'Akademisyenler' sekmesi bulunamadı: {e}", flush=True)
        driver.quit()
        sys.exit(1)
    # Tüm profil satırlarını çek (tüm sayfalarda, tekrarları önle)
    profiles = []
    profile_urls = set()
    page_num = 1
    while True:
        print(f"[INFO] {page_num}. sayfa yükleniyor...", flush=True)
        try:
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "tr[id^='authorInfo_']"))
            )
        except Exception as e:
            print(f"[ERROR] Profil satırları yüklenemedi: {e}", flush=True)
            break
        profile_rows = driver.find_elements(By.CSS_SELECTOR, "tr[id^='authorInfo_']")
        print(f"[INFO] {page_num}. sayfada {len(profile_rows)} profil bulundu.", flush=True)
        for row in profile_rows:
            try:
                link = row.find_element(By.CSS_SELECTOR, "a")
                link_text = link.text.strip()
                url = link.get_attribute("href")
                if url in profile_urls:
                    print(f"[SKIP] Profil zaten eklenmiş: {url}", flush=True)
                    continue
                info_td = row.find_element(By.XPATH, "./td[h6]")
                info = info_td.text.strip() if info_td else ""
                img = row.find_element(By.CSS_SELECTOR, "img")
                img_src = img.get_attribute("src") if img else None
                # Doğru isim ve ünvan ayrımı
                info_lines = info.splitlines()
                if len(info_lines) > 1:
                    title = info_lines[0].strip()
                    name = info_lines[1].strip()
                else:
                    title = link_text
                    name = link_text

                header = info_lines[2].strip() if len(info_lines) > 2 else ''
                all_links = info_td.find_elements(By.CSS_SELECTOR, 'a.anahtarKelime')
                green_label = all_links[0].text.strip() if len(all_links) > 0 else ''
                blue_label = all_links[1].text.strip() if len(all_links) > 1 else ''
                # Anahtar kelimeleri hem linkli hem düz metin olarak al
                # info_td.text: "Mühendislik Temel Alanı   Bilgisayar Bilimleri ve Mühendisliği Görüntü İşleme ; Yapay Öğrenme ; Algoritmalar ve Hesaplama Kuramı"
                label_text = f"{green_label}   {blue_label}"
                keywords_text = info_td.text.replace(label_text, '').strip()
                # Başta veya sonda gereksiz karakterler varsa temizle
                keywords_text = keywords_text.lstrip(';:,. \u000b\n\t')
                # Satırlara böl, sadece son satırı anahtar kelime olarak al
                lines = [l.strip() for l in keywords_text.split('\n') if l.strip()]
                if lines:
                    keywords_line = lines[-1]
                    # Eğer anahtar kelime satırı header ile aynıysa veya header'ı içeriyorsa boş bırak
                    if header.strip() == keywords_line or header.strip() in keywords_line:
                        keywords_str = ""
                    else:
                        keywords = [k.strip() for k in keywords_line.split(';') if k.strip()]
                        keywords_str = " ; ".join(keywords) if keywords else ""
                else:
                    keywords_str = ""
                # Email bilgisini çek
                email = ''
                try:
                    email_link = row.find_element(By.CSS_SELECTOR, "a[href^='mailto']")
                    email = email_link.text.strip().replace('[at]', '@')
                except Exception:
                    email = ''
                profiles.append({
                    "name": name,
                    "title": title,
                    "url": url,
                    "info": info,
                    "photoUrl": img_src,
                    "header": header,
                    "green_label": green_label,
                    "blue_label": blue_label,
                    "keywords": keywords_str,
                    "email": email
                })
                profile_urls.add(url)
                print(f"[ADD] Profil eklendi: {name} - {url}", flush=True)
            except Exception as e:
                print(f"[ERROR] Profil satırı işlenemedi: {e}", flush=True)
        print(f"[INFO] Şu ana kadar {len(profiles)} profil toplandı.", flush=True)
        # Her sayfa sonunda incremental olarak dosyaya yaz
        try:
            with open(os.path.join(SESSION_DIR, "main_profile.json"), "w", encoding="utf-8") as f:
                json.dump(profiles, f, ensure_ascii=False, indent=2)
            print(f"[INFO] main_profile.json dosyası güncellendi ({len(profiles)} profil).", flush=True)
        except Exception as e:
            print(f"[ERROR] main_profile.json yazılamadı: {e}", flush=True)
        # Pagination: aktif sayfa <li> elementinden sonra gelen <a>'ya tıkla
        try:
            pagination = driver.find_element(By.CSS_SELECTOR, "ul.pagination")
            active_li = pagination.find_element(By.CSS_SELECTOR, "li.active")
            all_lis = pagination.find_elements(By.TAG_NAME, "li")
            active_index = all_lis.index(active_li)
            if active_index == len(all_lis) - 1:
                print("[INFO] Son sayfaya gelindi, döngü bitiyor.", flush=True)
                break
            next_li = all_lis[active_index + 1]
            next_a = next_li.find_element(By.TAG_NAME, "a")
            print(f"[INFO] {page_num+1}. sayfaya geçiliyor...", flush=True)
            next_a.click()
            page_num += 1
            WebDriverWait(driver, 10).until(EC.staleness_of(profile_rows[0]))
        except Exception as e:
            print(f"[INFO] Sonraki sayfa bulunamadı veya tıklanamadı: {e}", flush=True)
            break
    print(f"[INFO] Toplam {len(profiles)} profil toplandı. JSON'a yazılıyor...", flush=True)
    with open(os.path.join(SESSION_DIR, "main_profile.json"), "w", encoding="utf-8") as f:
        json.dump(profiles, f, ensure_ascii=False, indent=2)
    print("[INFO] main_profile.json dosyası yazıldı.", flush=True)
finally:
    driver.quit()
    print("[DEBUG] WebDriver kapatıldı.", flush=True) 