import sys
import os
import base64
import re
import urllib.request
import json
import argparse
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

# Argparse ekle
parser = argparse.ArgumentParser()
parser.add_argument('name')
parser.add_argument('session_id')
parser.add_argument('--field', type=str, default=None)
parser.add_argument('--specialties', type=str, default=None)
parser.add_argument('--email', type=str, default=None)
args = parser.parse_args()

target_name = args.name
session_id = args.session_id
selected_field = args.field
selected_specialties = [s.strip() for s in args.specialties.split(',')] if args.specialties else []
target_email = args.email

# --- YENİ KLASÖR YAPISI ---
SESSION_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "collaborator-sessions", session_id)
print(f"[DEBUG] SESSION_DIR: {SESSION_DIR}", flush=True)

# Session directory'yi oluştur
os.makedirs(SESSION_DIR, exist_ok=True)

BASE = "https://akademik.yok.gov.tr/"
DEFAULT_PHOTO_URL = "/default_photo.jpg"

options = webdriver.ChromeOptions()
options.add_argument("--headless")
options.add_argument("--disable-gpu")
options.add_argument("user-agent=Mozilla/5.0")
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")
options.add_argument("--disable-extensions")
options.add_argument("--remote-debugging-port=9222")
options.add_argument("--disable-background-timer-throttling")
options.add_argument("--disable-backgrounding-occluded-windows")
options.add_argument("--disable-renderer-backgrounding")
options.add_argument("--disable-software-rasterizer")
options.add_argument("--disable-background-timer-throttling")
options.add_argument("--disable-backgrounding-occluded-windows")
options.add_argument("--disable-features=TranslateUI")
options.add_argument("--disable-ipc-flooding-protection")
prefs = {
    "profile.managed_default_content_settings.images": 2,
    "profile.managed_default_content_settings.stylesheets": 2,
    "profile.managed_default_content_settings.fonts": 2,
}
options.add_experimental_option("prefs", prefs)
options.binary_location = "/usr/bin/google-chrome"

print("[DEBUG] WebDriver başlatılıyor...", flush=True)
driver = webdriver.Chrome(
    service=Service(ChromeDriverManager().install()),
    options=options
)
driver.set_window_size(1920, 1080)

main_profile_info = ""

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
        # Her durumda normal arama yap (email varsa da)
        kutu = driver.find_element(By.ID, "aramaTerim")
        kutu.send_keys(target_name)
        driver.find_element(By.ID, "searchButton").click()
        
        if target_email:
            print(f"[DEBUG] '{target_name}' için normal arama yapıldı. Email '{target_email}' ile eşleşme aranacak.", flush=True)
        else:
            print(f"[DEBUG] '{target_name}' için normal arama yapıldı.", flush=True)
    except Exception as e:
        print(f"[ERROR] Arama kutusu veya butonu bulunamadı: {e}", flush=True)
    except Exception as e:
        print(f"[ERROR] 'Akademisyenler' sekmesi bulunamadı: {e}", flush=True)
    # Tüm profil satırlarını çek (tüm sayfalarda, tekrarları önle)
    profiles = []
    profile_urls = set()
    page_num = 1
    # --- id sayaç değişkeni ekle ---
    profile_id_counter = 1
        except Exception as e:
            print(f"[ERROR] Profil satırları yüklenemedi: {e}", flush=True)
            break
        profile_rows = driver.find_elements(By.CSS_SELECTOR, "tr[id^='authorInfo_']")
        print(f"[INFO] {page_num}. sayfada {len(profile_rows)} profil bulundu.", flush=True)
        if len(profile_rows) == 0:
            print("[INFO] Profil bulunamadı, döngü bitiyor.", flush=True)
            break
        for row in profile_rows:
            try:
                info_td = row.find_element(By.XPATH, "./td[h6]")
                # Sadece green_label ve blue_label'ı hızlıca çek
                all_links = info_td.find_elements(By.CSS_SELECTOR, 'a.anahtarKelime')
                green_label = all_links[0].text.strip() if len(all_links) > 0 else ''
                blue_label = all_links[1].text.strip() if len(all_links) > 1 else ''
                # Eğer field ve specialties parametreleri varsa, filtre uygula
                if selected_field and green_label != selected_field:
                    continue
                if selected_specialties and blue_label not in selected_specialties:
                    continue
                # Eşleşiyorsa, detayları scrape et
                link = row.find_element(By.CSS_SELECTOR, "a")
                link_text = link.text.strip()
                url = link.get_attribute("href")
                if url in profile_urls:
                    print(f"[SKIP] Profil zaten eklenmiş: {url}", flush=True)
                    continue
                # Email araması için lightweight mode - detaylı bilgileri atla
                if target_email:
                    # Sadece temel bilgileri al
                    profiles.append({
                        "id": profile_id_counter,
                        "name": name,
                        "title": title,
                        "url": url,
                        "info": "",  # Lightweight mode
                        "photoUrl": "",  # Lightweight mode
                        "header": "",  # Lightweight mode
                        "green_label": "",  # Lightweight mode
                        "blue_label": "",  # Lightweight mode
                        "keywords": "",  # Lightweight mode
                        "email": email
                    })
                    profile_id_counter += 1
                    profile_urls.add(url)
                    print(f"[ADD] Lightweight profil eklendi: {name} - {email}", flush=True)
                    continue
                info = info_td.text.strip() if info_td else ""
                img = row.find_element(By.CSS_SELECTOR, "img")
                img_src = img.get_attribute("src") if img else None
                if not img_src:
                    img_src = DEFAULT_PHOTO_URL
                info_lines = info.splitlines()
                if len(info_lines) > 1:
                    title = info_lines[0].strip()
                    name = info_lines[1].strip()
                else:
                    title = link_text
                    name = link_text
                header = info_lines[2].strip() if len(info_lines) > 2 else ''
                label_text = f"{green_label}   {blue_label}"
                keywords_text = info_td.text.replace(label_text, '').strip()
                keywords_text = keywords_text.lstrip(';:,. \u000b\n\t')
                lines = [l.strip() for l in keywords_text.split('\n') if l.strip()]
                if lines:
                    keywords_line = lines[-1]
                    if header.strip() == keywords_line or header.strip() in keywords_line:
                        keywords_str = ""
                    else:
                        keywords = [k.strip() for k in keywords_line.split(';') if k.strip()]
                        keywords_str = " ; ".join(keywords) if keywords else ""
                else:
                    keywords_str = ""
                email = ''
                try:
                    email_link = row.find_element(By.CSS_SELECTOR, "a[href^='mailto']")
                    email = email_link.text.strip().replace('[at]', '@')
                except Exception:
                    email = ''
                # --- id ekle ---
                profiles.append({
                    "id": profile_id_counter,
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
                profile_id_counter += 1
                profile_urls.add(url)
                print(f"[ADD] Profil eklendi: {name} - {url}", flush=True)
                
                # Email araması için lightweight mode
                if target_email:
                    # Sadece name, email ve url al - detaylı bilgi almayacağız
                    lightweight_profile = {
                        "id": profile_id_counter,
                        "name": name,
                        "url": url,
                        "email": email
                    }
                    
                    # Email eşleşmesi kontrolü
                    if email.lower() == target_email.lower():
                        print(f"[EMAIL_FOUND] Email eşleşmesi bulundu: {name} - {email}", flush=True)
                        # Sadece eşleşen profili kaydet
                        with open(os.path.join(SESSION_DIR, "main_profile.json"), "w", encoding="utf-8") as f:
                            json.dump([lightweight_profile], f, ensure_ascii=False, indent=2)
                        
                        # Collaborators başlat
                        import subprocess
                        collab_script = os.path.join(os.path.dirname(__file__), "scrape_collaborators.py")
                        subprocess.Popen([
                            "/var/www/akademik-tinder/venv/bin/python", collab_script,
                            name, session_id, url
                        ], cwd=os.path.dirname(__file__))
                        
                        print(f"[COLLABORATORS] İşbirlikçi scraping başlatıldı: {name}", flush=True)
    # API server için done marker oluştur
                        sys.exit(0)
                    
                    # Email eşleşmiyorsa devam et, bu profili ekleme
                    continue
                # Email varsa her 20 profilde kontrol et
                if target_email and len(profiles) % 20 == 0:
                    print(f"[EMAIL_CHECK] {len(profiles)} profil toplandı, email kontrolü yapılıyor...", flush=True)
                    
                    # Email uyuşan profil var mı kontrol et
                    matching_profile = None
                    for profile in profiles:
                        if profile.get('email', '').lower() == target_email.lower():
                            matching_profile = profile
                            break
                    
                    if matching_profile:
                        print(f"[EMAIL_FOUND] Email eşleşmesi bulundu: {matching_profile['name']} - {matching_profile['email']}", flush=True)
                        
                        # JSON'a kaydet
                        with open(os.path.join(SESSION_DIR, "main_profile.json"), "w", encoding="utf-8") as f:
                            json.dump(profiles, f, ensure_ascii=False, indent=2)
                        
                        # main_done.txt oluştur
                        with open(os.path.join(SESSION_DIR, "main_done.txt"), "w") as f:
                            f.write("completed")
                        
                        # Collaborators scriptini başlat
                        import subprocess
                        collab_script = os.path.join(os.path.dirname(__file__), "scrape_collaborators.py")
                        
                        # Windows'ta CMD penceresini gizle
                        startupinfo = None
                        if os.name == 'nt':  # Windows
                            startupinfo = subprocess.STARTUPINFO()
                            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                            startupinfo.wShowWindow = 0  # SW_HIDE = 0
                        
                        subprocess.Popen([
                            "python", collab_script, 
                            matching_profile['name'], 
                            session_id, 
                            matching_profile['url']
                        ], cwd=os.path.dirname(__file__), startupinfo=startupinfo)
                        
                        print(f"[COLLABORATORS] İşbirlikçi scraping başlatıldı: {matching_profile['name']}", flush=True)
    # API server için done marker oluştur
    done_path = os.path.join(SESSION_DIR, "main_done.txt")
    with open(done_path, "w") as f:
        f.write("completed")
                        driver.quit()
                        sys.exit(0)
                
        
        print(f"[INFO] Şu ana kadar {len(profiles)} profil toplandı.", flush=True)
        
        # (100 if target_email else 20) kişi limitine ulaşıldıysa ana döngüden çık
        if len(profiles) >= (100 if target_email else 20):
            print(f"[LIMIT] (100 if target_email else 20) kişi limitine ulaşıldı. Scraping tamamlandı.", flush=True)
            break
        # Her sayfa sonunda incremental olarak dosyaya yaz
        try:
            with open(os.path.join(SESSION_DIR, "main_profile.json"), "w", encoding="utf-8") as f:
                json.dump(profiles, f, ensure_ascii=False, indent=2)
            print(f"[INFO] main_profile.json dosyası güncellendi ({len(profiles)} profil).", flush=True)
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
    print(f"[INFO] Toplam {len(profiles)} profil toplandı (maksimum 20). JSON'a yazılıyor...", flush=True)

    # Email araması yapıldıysa ve email bulunamadıysa
    if target_email:
        email_found = any(profile.get("email", "").lower() == target_email.lower() for profile in profiles)
        if not email_found:
            print(f"[EMAIL_NOT_FOUND] Email '{target_email}' bulunamadı. Lütfen daha spesifik bir isim girin.", flush=True)
            # Email bulunamadı mesajını JSON dosyasına da ekle
        else:
            # Email bulundu, collaborators başlat
            matching_profile = next(p for p in profiles if p.get("email", "").lower() == target_email.lower())
            print(f"[EMAIL_FOUND] Email eşleşmesi bulundu: {matching_profile['name']} - {matching_profile['email']}", flush=True)
            
            # Collaborators scriptini başlat
            import subprocess
            collab_script = os.path.join(os.path.dirname(__file__), "scrape_collaborators.py")
            
            subprocess.Popen([
                "/var/www/akademik-tinder/venv/bin/python", collab_script,
                matching_profile['name'],
                session_id,
                matching_profile['url']
            ], cwd=os.path.dirname(__file__))
            
            print(f"[COLLABORATORS] İşbirlikçi scraping başlatıldı: {matching_profile['name']}", flush=True)
            # Email bulundu, normal işlem devam etmesin
            sys.exit(0)
            result = {"profiles": profiles, "email_found": False, "message": f"Email '{target_email}' bulunamadı. Lütfen daha spesifik bir isim girin."}
            with open(os.path.join(SESSION_DIR, "main_profile.json"), "w", encoding="utf-8") as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
    with open(os.path.join(SESSION_DIR, "main_profile.json"), "w", encoding="utf-8") as f:
        json.dump(profiles, f, ensure_ascii=False, indent=2)
    print("[INFO] main_profile.json dosyası yazıldı.", flush=True)
    # Scraping tamamlandı sinyali (main_done.txt)
    if profiles:
        done_path = os.path.join(SESSION_DIR, "main_done.txt")
        with open(done_path, "w") as f:
            f.write("done")
            f.flush()
            os.fsync(f.fileno())
        if hasattr(os, "sync"):
            os.sync()

finally:
    driver.quit()
    print("[DEBUG] WebDriver kapatıldı.", flush=True)
    # API server için done marker
    done_path = os.path.join(SESSION_DIR, "main_done.txt")
    with open(done_path, "w") as f:
        f.write("completed")
