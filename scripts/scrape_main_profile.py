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

if len(sys.argv) < 3:
    print("Kullanım: python scrape_main_profile.py <isim> <sessionId>")
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

driver = webdriver.Chrome(
    service=Service(ChromeDriverManager().install()),
    options=options
)
driver.set_window_size(1920, 1080)

main_profile_info = ""
main_photo_file = f"profile_main.jpg"
main_photo_path = os.path.join(PROFILE_PICS_DIR, main_photo_file)

try:
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
    # Tüm profil satırlarını çek
    profile_rows = driver.find_elements(By.CSS_SELECTOR, "tr[id^='authorInfo_']")
    profiles = []
    for row in profile_rows:
        try:
            link = row.find_element(By.CSS_SELECTOR, "a")
            name = link.text.strip()
            url = link.get_attribute("href")
            info_td = row.find_element(By.XPATH, "./td[h6]")
            info = info_td.text.strip() if info_td else ""
            # Fotoğrafı al
            img = row.find_element(By.CSS_SELECTOR, "img")
            img_src = img.get_attribute("src") if img else None
            # Eğer name boşsa info'dan çek
            if not name and info:
                lines = info.splitlines()
                if len(lines) > 1:
                    name = lines[1].strip()
            profiles.append({
                "name": name,
                "url": url,
                "info": info,
                "photoUrl": img_src
            })
        except Exception as e:
            continue
    if len(profiles) == 1:
        # Sadece bir profil varsa, mevcut davranış
        main_profile_url = profiles[0]["url"]
        profiles[0]["photo"] = "main_photo.jpg"
        # Profili aç ve detayları çek
        driver.get(main_profile_url)
        profile_td = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.XPATH, "//td[h6]"))
        )
        main_profile_info = profile_td.text
        # Detay sayfasındaki ismi çek
        try:
            name_elem = driver.find_element(By.CSS_SELECTOR, "div.card-header h5")
            real_name = name_elem.text.strip()
        except Exception:
            real_name = profiles[0]["name"]  # Yedek olarak listeden gelen ismi kullan
        img = driver.find_element(By.CSS_SELECTOR, "img.img-circle")
        src = img.get_attribute("src")
        if src and src.startswith("data:image"):
            save_base64_image(src, main_photo_path)
        elif src:
            urllib.request.urlretrieve(src, main_photo_path)
        else:
            urllib.request.urlretrieve(DEFAULT_URL, main_photo_path)
        result = {
            "profiles": [{
                "name": real_name,
                "info": main_profile_info,
                "photo": main_photo_file,
                "url": main_profile_url
            }]
        }
    else:
        # Birden fazla profil varsa, sadece temel bilgileri döndür
        result = {"profiles": profiles}
finally:
    driver.quit()

with open(os.path.join(SESSION_DIR, "main_profile.json"), "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2) 