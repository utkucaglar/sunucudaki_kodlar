# start-app.ps1

Write-Host "Scraping başlatılıyor..." -ForegroundColor Cyan
python ./scripts/scrape_yok.py

Write-Host "Next.js başlatılıyor..." -ForegroundColor Cyan
pnpm dev 