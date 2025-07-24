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

BASE = "https://akademik.yok.gov.tr/"
DEFAULT_PHOTO_URL = "/default_photo.jpg"
collaborators_json_path = os.path.join(os.path.dirname(__file__), "..", "public", "collaborator-sessions", session_id, "collaborators.json")

options = webdriver.ChromeOptions()
options.add_argument("--headless=new")
options.add_argument("--disable-gpu")
options.add_argument("user-agent=Mozilla/5.0")
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")
options.add_argument("--disable-setuid-sandbox")
options.add_argument("--remote-debugging-port=9222")
options.add_argument("--disable-extensions")
options.binary_location = "/snap/bin/chromium"
options.add_argument("--disable-software-rasterizer")
options.add_argument("--disable-background-networking")
options.add_argument("--disable-default-apps")
options.add_argument("--disable-sync")
options.add_argument("--no-first-run")
options.add_argument("--disable-web-security")
options.add_argument("--window-size=1920,1080")
prefs = {
    "profile.managed_default_content_settings.images": 2,
    "profile.managed_default_content_settings.stylesheets": 2,
    "profile.managed_default_content_settings.fonts": 2,
}
options.add_experimental_option("prefs", prefs)

driver = webdriver.Chrome(
    service=Service("/usr/local/bin/chromedriver"),
    options=options
)
driver.set_window_size(1920, 1080)

collaborators = []

try:
    # Önce profil sayfasına git
    if profile_url:
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
        info = ""
        deleted = False
        title = ''
        header = ''
        green_label = ''
        blue_label = ''
        keywords_str = ''
        photo_url = ''
        email = ''  # <-- burada email'i başta boş string olarak tanımla
        if not href:
            photo_url = DEFAULT_PHOTO_URL
            deleted = True
        else:
            driver.get(href)
            tds = driver.find_elements(By.XPATH, "//td[h6]")
            if not tds:
                photo_url = DEFAULT_PHOTO_URL
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
                    td_html = tds[0].get_attribute('innerHTML')
                    import re
                    if isinstance(td_html, str):
                        m = re.search(r'<span[^>]*label-primary[^>]*>.*?</span>([^<]*)', td_html)
                        if m:
                            kw = m.group(1).strip()
                            if kw:
                                keywords_str = kw
                except Exception:
                    pass
                info = info_lines[2].strip() if len(info_lines) > 2 else ''
                try:
                    email_link = tds[0].find_element(By.CSS_SELECTOR, "a[href^='mailto']")
                    email = email_link.text.strip().replace('[at]', '@')
                except Exception:
                    email = ''
                try:
                    img = driver.find_element(By.CSS_SELECTOR, "img.img-circle")
                    photo_url = img.get_attribute("src")
                except Exception:
                    try:
                        img = driver.find_element(By.CSS_SELECTOR, "img#imgPicture")
                        photo_url = img.get_attribute("src")
                    except Exception:
                        photo_url = DEFAULT_PHOTO_URL
        collaborators.append({
            "id": idx,
            "name": isim,
            "title": title,
            "info": info,
            "green_label": green_label,
            "blue_label": blue_label,
            "keywords": keywords_str,
            "photoUrl": photo_url,
            "status": "completed",
            "deleted": deleted,
            "url": href if not deleted else "",
            "email": email
        })
        with open(collaborators_json_path, "w", encoding="utf-8") as f:
            json.dump(collaborators, f, ensure_ascii=False, indent=2)
            f.flush()
            os.fsync(f.fileno())
        time.sleep(0.5)  # Progressive loading için kısa bekleme
    # --- DONE dosyasını sadece işbirlikçi varsa ve scraping bittiyse oluştur ---
    if collaborators:
        # Dosya sistemini tamamen senkronize et (Linux/Unix)
        if hasattr(os, "sync"):
            os.sync()
        done_path = os.path.join(os.path.dirname(__file__), "..", "public", "collaborator-sessions", session_id, "collaborators_done.txt")
        with open(done_path, "w") as f:
            f.write("done")
            f.flush()
            os.fsync(f.fileno())
finally:
    driver.quit() 