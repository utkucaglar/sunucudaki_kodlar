from fastapi import FastAPI, Request
import httpx
from typing import Optional, List, Dict, Any
import uvicorn
import os
import re
import json
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from concurrent.futures import ThreadPoolExecutor
import asyncio

app = FastAPI(title="YÖK Akademik MCP", version="0.1.0")

@app.get("/")
async def root():
    return {"message": "YÖK Akademik MCP Server", "status": "running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/tools")
async def list_tools():
    return {
        "tools": [
            {
                "name": "search_researcher",
                "description": "Search for researchers in YÖK Akademik",
                "endpoint": "/search_researcher"
            },
            {
                "name": "get_collaborators", 
                "description": "Get collaborators for a researcher",
                "endpoint": "/get_collaborators"
            }
        ]
    }

def scrape_main_profile(name: str, email: Optional[str] = None, field_id: Optional[str] = None, specialty_ids: Optional[List[str]] = None) -> Dict[str, Any]:
    if not name:
        return {"error": "Name parameter is required"}
    
    BASE = "https://akademik.yok.gov.tr/"
    options = webdriver.ChromeOptions()
    options.add_argument("--headless")
    options.add_argument("--disable-gpu")
    options.add_argument("user-agent=Mozilla/5.0")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-extensions")
    options.add_argument("--remote-debugging-port=9222")
    options.add_argument("--disable-software-rasterizer")
    options.add_argument("--window-size=1920,1080")
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    driver.set_window_size(1920, 1080)
    try:
        driver.get(BASE + "AkademikArama/")
        WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.ID, "aramaTerim")))
        try:
            btn = WebDriverWait(driver, 5).until(EC.element_to_be_clickable((By.XPATH, "//button[contains(text(),'Tümünü Kabul Et')]")))
            btn.click()
        except Exception:
            pass
        kutu = driver.find_element(By.ID, "aramaTerim")
        kutu.send_keys(name)
        driver.find_element(By.ID, "searchButton").click()
        WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.LINK_TEXT, "Akademisyenler"))).click()
        WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.CSS_SELECTOR, "tr[id^='authorInfo_']")))
        profile_rows = driver.find_elements(By.CSS_SELECTOR, "tr[id^='authorInfo_']")
        results = []
        for row in profile_rows[:5]:
            try:
                info_td = row.find_element(By.XPATH, "./td[h6]")
                link = row.find_element(By.CSS_SELECTOR, "a")
                link_text = link.text.strip()
                url = link.get_attribute("href")
                info = info_td.text.strip() if info_td else ""
                img = row.find_element(By.CSS_SELECTOR, "img")
                img_src = img.get_attribute("src") if img else None
                if not img_src:
                    img_src = "/default_photo.jpg"
                info_lines = info.splitlines()
                if len(info_lines) > 1:
                    title = info_lines[0].strip()
                    name_ = info_lines[1].strip()
                else:
                    title = link_text
                    name_ = link_text
                header = info_lines[2].strip() if len(info_lines) > 2 else ''
                email = ''
                try:
                    email_link = row.find_element(By.CSS_SELECTOR, "a[href^='mailto']")
                    email = email_link.text.strip().replace('[at]', '@')
                except Exception:
                    email = ''
                results.append({
                    "name": name_,
                    "title": title,
                    "url": url,
                    "info": info,
                    "photoUrl": img_src,
                    "header": header,
                    "email": email
                })
            except Exception as e:
                continue
        return {"results": results}
    finally:
        driver.quit()

def scrape_collaborators(name: str) -> Dict[str, Any]:
    BASE = "https://akademik.yok.gov.tr/"
    options = webdriver.ChromeOptions()
    options.add_argument("--headless")
    options.add_argument("--disable-gpu")
    options.add_argument("user-agent=Mozilla/5.0")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-extensions")
    options.add_argument("--remote-debugging-port=9222")
    options.add_argument("--disable-software-rasterizer")
    options.add_argument("--window-size=1920,1080")
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    driver.set_window_size(1920, 1080)
    try:
        driver.get(BASE + "AkademikArama/")
        WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.ID, "aramaTerim")))
        try:
            btn = WebDriverWait(driver, 5).until(EC.element_to_be_clickable((By.XPATH, "//button[contains(text(),'Tümünü Kabul Et')]")))
            btn.click()
        except Exception:
            pass
        kutu = driver.find_element(By.ID, "aramaTerim")
        kutu.send_keys(name)
        driver.find_element(By.ID, "searchButton").click()
        WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.LINK_TEXT, "Akademisyenler"))).click()
        WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.CSS_SELECTOR, "tr[id^='authorInfo_'] a"))).click()
        WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.XPATH, "//a[@href='viewAuthorGraphs.jsp']"))).click()
        WebDriverWait(driver, 10).until(lambda d: len(d.find_elements(By.CSS_SELECTOR, "svg g")) > 2)
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
        collaborators = []
        for idx, obj in enumerate(isimler_ve_linkler, start=1):
            isim = obj['name']
            href = obj['href']
            collaborators.append({"id": idx, "name": isim, "url": href})
        return {"collaborators": collaborators}
    finally:
        driver.quit()

@app.post("/search_researcher")
async def search_researcher_api(request: Request):
    data = await request.json()
    loop = asyncio.get_event_loop()
    with ThreadPoolExecutor() as pool:
        result = await loop.run_in_executor(pool, scrape_main_profile, data.get("name"), data.get("email"), data.get("field_id"), data.get("specialty_ids"))
    return result

@app.post("/get_collaborators")
async def get_collaborators_api(request: Request):
    data = await request.json()
    loop = asyncio.get_event_loop()
    with ThreadPoolExecutor() as pool:
        result = await loop.run_in_executor(pool, scrape_collaborators, data.get("name"))
    return result

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000) 