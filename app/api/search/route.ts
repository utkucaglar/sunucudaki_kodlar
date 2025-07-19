import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { execSync, spawn } from "child_process";

function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export async function POST(request: NextRequest) {
  try {
    const { name, email, field, specialties } = await request.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "İsim gereklidir" }, { status: 400 });
    }
    const sessionId = generateSessionId();
    const scriptsDir = path.join(process.cwd(), "scripts");
    // 1. Ana profil scraping (arka planda başlat)
    const mainProfileScript = path.join(scriptsDir, "scrape_main_profile.py");
    const pythonArgs = [mainProfileScript, name.trim(), sessionId];
    if (field) pythonArgs.push('--field', field);
    if (specialties && Array.isArray(specialties) && specialties.length > 0) {
      pythonArgs.push('--specialties', specialties.join(','));
    }
    const pythonProc = spawn("python", pythonArgs, { detached: true, stdio: "ignore" });
    // PID'i session klasörüne kaydet
    const sessionDir = path.join(process.cwd(), "public", "collaborator-sessions", sessionId);
    const pidPath = path.join(sessionDir, "scraper.pid");
    fs.mkdirSync(sessionDir, { recursive: true });
    if (pythonProc.pid !== undefined) {
      fs.writeFileSync(pidPath, pythonProc.pid.toString(), "utf-8");
    }
    pythonProc.unref();
    // 2. Ana profil bilgisini incremental olarak oku (polling)
    const mainProfilePath = path.join(process.cwd(), "public", "collaborator-sessions", sessionId, "main_profile.json");
    let profiles: any[] = [];
    let resolved = false;
    const maxWaitMs = (email && email.trim().length > 0) ? 60000 : 30000; // E-posta aramasında 60 saniye, diğerlerinde 30 saniye
    const startTime = Date.now();
    
    if (email && email.trim().length > 0) {
      let waited = 0;
      const pollInterval = 500;
      while (waited < maxWaitMs) {
        if (fs.existsSync(mainProfilePath)) {
          try {
            const mainProfile = JSON.parse(fs.readFileSync(mainProfilePath, "utf-8"));
            if (Array.isArray(mainProfile)) {
              profiles = mainProfile;
            } else if (mainProfile.profiles) {
              profiles = mainProfile.profiles;
            }
            const emailLower = email.trim().toLowerCase();
            const exactProfile = profiles.find((p: any) => (p.email || "").toLowerCase() === emailLower);
            if (exactProfile) {
              // PID dosyasını oku ve scraping'i durdur
              if (fs.existsSync(pidPath)) {
                const pid = parseInt(fs.readFileSync(pidPath, "utf-8"));
                try { process.kill(pid); } catch (e) { /* zaten bitmiş olabilir */ }
              }
              return NextResponse.json({
                sessionId,
                mainProfile: exactProfile,
                profiles: [exactProfile],
                directCollaborators: true
              });
            }
          } catch (e) { /* dosya yazılırken okunamazsa, bir sonraki döngüde tekrar dene */ }
        }
        await new Promise(r => setTimeout(r, pollInterval));
        waited += pollInterval;
      }
      // Timeout durumunda da scraping'i durdur
      if (fs.existsSync(pidPath)) {
        const pid = parseInt(fs.readFileSync(pidPath, "utf-8"));
        try { process.kill(pid); } catch (e) { /* zaten bitmiş olabilir */ }
      }
      return NextResponse.json({ error: "Aradığınız profil bulunamadı, lütfen daha spesifik bir arama yapın." }, { status: 404 });
    }
    // E-posta ile arama değilse polling ile devam et
    let waited = 0;
    const pollInterval = 500;
    while (waited < maxWaitMs) {
      if (fs.existsSync(mainProfilePath)) {
        try {
          const mainProfile = JSON.parse(fs.readFileSync(mainProfilePath, "utf-8"));
          if (Array.isArray(mainProfile)) {
            profiles = mainProfile;
          } else if (mainProfile.profiles) {
            profiles = mainProfile.profiles;
          }
          if (profiles.length >= 1) {
            break;
          }
        } catch (e) { /* dosya yazılırken okunamazsa, bir sonraki döngüde tekrar dene */ }
      }
      await new Promise(r => setTimeout(r, pollInterval));
      waited += pollInterval;
    }
    if (profiles.length >= 1) {
      return NextResponse.json({
        sessionId,
        profiles
      });
    } else {
      return NextResponse.json({ error: "Profil bulunamadı veya zaman aşımı." }, { status: 404 });
    }
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Arama sırasında hata oluştu" }, { status: 500 });
  }
}
