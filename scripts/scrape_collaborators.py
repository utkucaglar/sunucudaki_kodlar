import sys
import os
import base64
import re
import urllib.request
import json
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import NoSuchElementException
from webdriver_manager.chrome import ChromeDriverManager

def save_base64_image(data_url: str, filename: str):
    header, b64data = data_url.split(",", 1)
    img_data = base64.b64decode(b64data)
    with open(filename, "wb") as f:
        f.write(img_data)

def sanitize_filename(name: str) -> str:
    return re.sub(r'[^A-Za-z0-9ĞÜŞİÖÇğüşiöç ]+', '_', name).strip().replace(" ", "_")

# --- YÖK AKADEMİK KUTUCUK AYRIŞTIRICI (main_profile ile aynı) ---
def parse_labels_and_keywords(line):
    parts = [p.strip() for p in line.split(';')]
    left = parts[0] if parts else ''
    rest_keywords = [p.strip() for p in parts[1:] if p.strip()]
    left_parts = re.split(r'\s{2,}|\t+', left)
    green_label = left_parts[0].strip() if len(left_parts) > 0 else ''
    blue_label = left_parts[1].strip() if len(left_parts) > 1 else ''
    keywords = []
    if len(left_parts) > 2:
        keywords += [p.strip() for p in left_parts[2:] if p.strip()]
    keywords += rest_keywords
    if not keywords:
        keywords = ['-']
    return green_label, blue_label, keywords

if len(sys.argv) < 3:
    print("Kullanım: python scrape_collaborators.py <isim> <sessionId> [profil_url]")
    sys.exit(1)

target_name = sys.argv[1]
session_id = sys.argv[2]
profile_url = sys.argv[3] if len(sys.argv) > 3 else None

# --- YENİ KLASÖR YAPISI ---
SESSION_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "collaborator-sessions", session_id)
PROFILE_PICS_DIR = os.path.join(SESSION_DIR, "profile_pictures")
os.makedirs(PROFILE_PICS_DIR, exist_ok=True)

BASE = "https://akademik.yok.gov.tr/"
DEFAULT_URL = BASE + "AkademikArama/authorimages/photo_m.jpg"
default_photo_filename = os.path.join(PROFILE_PICS_DIR, "default_photo.jpg")
urllib.request.urlretrieve(DEFAULT_URL, default_photo_filename)

collaborators_json_path = os.path.join(SESSION_DIR, "collaborators.json")

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

driver = webdriver.Chrome(
    service=Service(ChromeDriverManager().install()),
    options=options
)
driver.set_window_size(1920, 1080)

collaborators = []

try:
    # Önce profil sayfasına git
    if profile_url:
        # Doğrudan seçilen profilin URL'sine git
        driver.get(profile_url)
    else:
        driver.get(BASE + "AkademikArama/")
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, "aramaTerim"))
        )
        try:
            btn = WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable((By.XPATH, "//button[contains(text(),'Tümünü Kabul Et')]"))
            )
            btn.click()
        except:
            pass
        kutu = driver.find_element(By.ID, "aramaTerim")
        kutu.send_keys(target_name)
        driver.find_element(By.ID, "searchButton").click()
        WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.LINK_TEXT, "Akademisyenler"))
        ).click()
        WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, "tr[id^='authorInfo_'] a"))
        ).click()

    # Sonra işbirlikçiler sekmesine geç
    WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.XPATH, "//a[@href='viewAuthorGraphs.jsp']"))
    ).click()
    WebDriverWait(driver, 10).until(
        lambda d: len(d.find_elements(By.CSS_SELECTOR, "svg g")) > 2
    )
    script = """
const gs = document.querySelectorAll('svg g');
const results = [];
for (let i = 2; i < gs.length; i++) {
    const name = gs[i].querySelector('text')?.textContent.trim() || '';
    gs[i].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const href = document.getElementById('pageUrl')?.href || '';
    results.push({ name, href });
}
return results;
"""
    isimler_ve_linkler = driver.execute_script(script)
    for idx, obj in enumerate(isimler_ve_linkler, start=1):
        isim = obj['name']
        href = obj['href']
        dest_file = f"collab_{idx}_{sanitize_filename(isim)}.jpg"
        dest_path = os.path.join(PROFILE_PICS_DIR, dest_file)
        info = ""
        deleted = False
        title = ''
        header = ''
        green_label = ''
        blue_label = ''
        keywords_str = ''
        if not href:
            # Profil linki yok, varsayılan fotoğrafla atlanıyor.
            try:
                import shutil
                shutil.copy(default_photo_filename, dest_path)
            except Exception:
                urllib.request.urlretrieve(DEFAULT_URL, dest_path)
            deleted = True
        else:
            driver.get(href)
            tds = driver.find_elements(By.XPATH, "//td[h6]")
            if not tds:
                try:
                    import shutil
                    shutil.copy(default_photo_filename, dest_path)
                except Exception:
                    urllib.request.urlretrieve(DEFAULT_URL, dest_path)
                deleted = True
            else:
                info = tds[0].text
                info_lines = info.splitlines()
                if len(info_lines) > 1:
                    title = info_lines[0].strip()
                    name = info_lines[1].strip()
                else:
                    title = isim
                    name = isim
                header = info_lines[2].strip() if len(info_lines) > 2 else ''
                # Label ve keywordleri ayıkla (HTML span class ile)
                green_label = ''
                blue_label = ''
                keywords_str = ''
                try:
                    green_span = tds[0].find_element(By.CSS_SELECTOR, 'span.label-success')
                    green_label = green_span.text.strip()
                except Exception:
                    pass
                try:
                    blue_span = tds[0].find_element(By.CSS_SELECTOR, 'span.label-primary')
                    blue_label = blue_span.text.strip()
                    # keywords: blue_label'dan hemen sonraki düz metni td'nin innerHTML'inden ayıkla
                    td_html = tds[0].get_attribute('innerHTML')
                    import re
                    # Blue label'dan hemen sonra gelen düz metni bul
                    if isinstance(td_html, str):
                        m = re.search(r'<span[^>]*label-primary[^>]*>.*?</span>([^<]*)', td_html)
                        if m:
                            kw = m.group(1).strip()
                            if kw:
                                keywords_str = kw
                except Exception:
                    pass
                # info alanı sadece header olacak (header alanı kaldırıldı)
                info = info_lines[2].strip() if len(info_lines) > 2 else ''
                # --- EMAIL SCRAPING ---
                email = ''
                try:
                    email_link = tds[0].find_element(By.CSS_SELECTOR, "a[href^='mailto']")
                    email = email_link.text.strip().replace('[at]', '@')
                except Exception:
                    email = ''
                try:
                    img = driver.find_element(By.CSS_SELECTOR, "img.img-circle")
                    src = img.get_attribute("src")
                    if src and src.startswith("data:image"):
                        save_base64_image(src, dest_path)
                    elif src:
                        urllib.request.urlretrieve(src, dest_path)
                    else:
                        urllib.request.urlretrieve(DEFAULT_URL, dest_path)
                except NoSuchElementException:
                    try:
                        import shutil
                        shutil.copy(default_photo_filename, dest_path)
                    except Exception:
                        urllib.request.urlretrieve(DEFAULT_URL, dest_path)
        collaborators.append({
            "id": idx,
            "name": isim,
            "title": title,
            "info": info,
            "green_label": green_label,
            "blue_label": blue_label,
            "keywords": keywords_str,
            "photo": dest_file,
            "status": "completed",
            "deleted": deleted,
            "url": href if not deleted else "",
            "email": email
        })
        # Her işbirlikçi sonrası JSON'u güncelle
        with open(collaborators_json_path, "w", encoding="utf-8") as f:
            json.dump(collaborators, f, ensure_ascii=False, indent=2)
        time.sleep(0.5)  # Progressive loading için kısa bekleme
    # --- DONE dosyasını sadece işbirlikçi varsa ve scraping bittiyse oluştur ---
    if collaborators:
        done_path = os.path.join(SESSION_DIR, "collaborators_done.txt")
        with open(done_path, "w") as f:
            f.write("done")
finally:
    driver.quit() 