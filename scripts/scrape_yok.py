import time
import base64
import re
import shutil
import urllib.request
import os
import json
import sys
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

# Next.js projesinin public/profile-pics klasörü
# NEXT_PUBLIC_PICS = os.path.join(os.path.dirname(__file__), "..", "public", "profile-pics")
# os.makedirs(NEXT_PUBLIC_PICS, exist_ok=True)

# Eski fotoğrafları temizle
# for f in os.listdir(NEXT_PUBLIC_PICS):
#     file_path = os.path.join(NEXT_PUBLIC_PICS, f)
#     if os.path.isfile(file_path):
#         os.remove(file_path)

# Terminalden isim sor
if len(sys.argv) > 2:
    target_name = sys.argv[1]
    session_id = sys.argv[2]
else:
    print("Kullanım: python scrape_yok.py <isim> <sessionId>")
    sys.exit(1)

# --- YENİ KLASÖR YAPISI ---
SESSION_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "collaborator-sessions", session_id)
PROFILE_PICS_DIR = os.path.join(SESSION_DIR, "profile_pictures")
os.makedirs(PROFILE_PICS_DIR, exist_ok=True)

BASE = "https://akademik.yok.gov.tr/"
DEFAULT_URL = BASE + "AkademikArama/authorimages/photo_m.jpg"
default_photo_filename = os.path.join(PROFILE_PICS_DIR, "default_photo.jpg")
urllib.request.urlretrieve(DEFAULT_URL, default_photo_filename)
print(f"🖼️ Varsayılan fotoğraf indirildi: {default_photo_filename}")

service = Service(ChromeDriverManager().install(), log_path="NUL")
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
main_photo_file = "main_photo.jpg"
main_photo_path = os.path.join(PROFILE_PICS_DIR, main_photo_file)
collaborators = []

try:
    driver.get(BASE + "AkademikArama/")
    WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.ID, "aramaTerim"))
    )
    print("🌐 Ana sayfa açıldı.")

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
    print(f"🔍 “{target_name}” arandı.")

    WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.LINK_TEXT, "Akademisyenler"))
    ).click()

    WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.CSS_SELECTOR, "tr[id^='authorInfo_'] a"))
    ).click()
    print("📄 Ana profil açıldı.")

    profile_td = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.XPATH, "//td[h6]"))
    )
    print("\n📝 Aranan akademisyenin bilgileri:")
    print(profile_td.text)
    main_profile_info = profile_td.text

    img = driver.find_element(By.CSS_SELECTOR, "img.img-circle")
    src = img.get_attribute("src")
    if src and src.startswith("data:image"):
        save_base64_image(src, main_photo_path)
    elif src:
        urllib.request.urlretrieve(src, main_photo_path)
    else:
        shutil.copy(default_photo_filename, main_photo_path)
    print(f"🖼️ Ana fotoğraf kaydedildi: {main_photo_path}")

    WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.XPATH, "//a[@href='viewAuthorGraphs.jsp']"))
    ).click()
    print("\n👥 İşbirlikçiler grafiği açıldı.")

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
    print(f"\n🔗 Toplam işbirlikçi: {len(isimler_ve_linkler)}")

    for idx, obj in enumerate(isimler_ve_linkler, start=1):
        isim = obj['name']
        href = obj['href']
        print(f"\n---\n🔎 {idx}. İşbirlikçi: {isim}")
        dest_file = f"collab_{idx}_{sanitize_filename(isim)}.jpg"
        dest_path = os.path.join(PROFILE_PICS_DIR, dest_file)
        info = ""

        if not href:
            print("⚠️ Profil linki yok, varsayılan fotoğrafla atlanıyor.")
            shutil.copy(default_photo_filename, dest_path)
            print(f"🖼️ Varsayılan kopyalandı: {dest_path}")
        else:
            driver.get(href)
            tds = driver.find_elements(By.XPATH, "//td[h6]")
            if not tds:
                print("⚠️ Profil silinmiş, varsayılan fotoğrafla atlanıyor.")
                shutil.copy(default_photo_filename, dest_path)
                print(f"🖼️ Varsayılan kopyalandı: {dest_path}")
            else:
                info = tds[0].text
                try:
                    img = driver.find_element(By.CSS_SELECTOR, "img.img-circle")
                    src = img.get_attribute("src")
                    if src and src.startswith("data:image"):
                        save_base64_image(src, dest_path)
                    elif src:
                        urllib.request.urlretrieve(src, dest_path)
                    else:
                        shutil.copy(default_photo_filename, dest_path)
                    print(f"🖼️ Fotoğraf kaydedildi: {dest_path}")
                except NoSuchElementException:
                    shutil.copy(default_photo_filename, dest_path)
                    print(f"⚠️ Fotoğraf bulunamadı, varsayılan kopyalandı: {dest_path}")
        collaborators.append({
            "id": idx,
            "name": isim,
            "info": info,
            "photo": dest_file,
            "status": "completed"
        })

finally:
    print("\n🛑 Tarayıcı 7 saniye içinde kapanacak.")
    time.sleep(7)
    driver.quit()

# Sonuçları JSON olarak kaydet
result = {
    "mainProfile": {
        "name": target_name,
        "info": main_profile_info,
        "photo": main_photo_file
    },
    "collaborators": collaborators
}
with open(os.path.join(SESSION_DIR, "result.json"), "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)
print(f"\n✅ Sonuçlar {os.path.join(SESSION_DIR, 'result.json')} dosyasına kaydedildi.") 