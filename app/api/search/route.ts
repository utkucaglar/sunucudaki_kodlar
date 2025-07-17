import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { execSync, spawn } from "child_process";

function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export async function POST(request: NextRequest) {
  try {
    const { name, email, field } = await request.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "İsim gereklidir" }, { status: 400 });
    }
    const sessionId = generateSessionId();
    const scriptsDir = path.join(process.cwd(), "scripts");
    // 1. Ana profil scraping (arka planda başlat)
    const mainProfileScript = path.join(scriptsDir, "scrape_main_profile.py");
    const pythonProc = spawn("python", [mainProfileScript, name.trim(), sessionId], { detached: true, stdio: "ignore" });
    pythonProc.unref();
    // 2. Ana profil bilgisini incremental olarak oku (polling)
    const mainProfilePath = path.join(process.cwd(), "public", "collaborator-sessions", sessionId, "main_profile.json");
    let profiles = [];
    let waited = 0;
    const maxWaitMs = (email && email.trim().length > 0) ? 60000 : 30000; // E-posta aramasında 60 saniye, diğerlerinde 30 saniye
    const pollInterval = 500; // 0.5 saniye
    while (waited < maxWaitMs) {
      if (fs.existsSync(mainProfilePath)) {
        try {
          const mainProfile = JSON.parse(fs.readFileSync(mainProfilePath, "utf-8"));
          if (Array.isArray(mainProfile)) {
            profiles = mainProfile;
          } else if (mainProfile.profiles) {
            profiles = mainProfile.profiles;
          }
          // E-posta ile arama: tam eşleşen profil varsa hemen dön
          if (email && email.trim().length > 0) {
            const emailLower = email.trim().toLowerCase();
            const exactProfile = profiles.find((p: any) => (p.email || "").toLowerCase() === emailLower);
            if (exactProfile) {
              return NextResponse.json({
                sessionId,
                mainProfile: exactProfile,
                profiles: [exactProfile],
                directCollaborators: true
              });
            }
          }
          if (profiles.length >= 20) {
            break;
          }
        } catch (e) { /* dosya yazılırken okunamazsa, bir sonraki döngüde tekrar dene */ }
      }
      await new Promise(r => setTimeout(r, pollInterval));
      waited += pollInterval;
    }
    // E-posta ile arama: 60 saniye sonunda hala tam eşleşme yoksa özel hata dön
    if (email && email.trim().length > 0) {
      return NextResponse.json({ error: "Aradığınız profil bulunamadı, lütfen daha spesifik bir arama yapın." }, { status: 404 });
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
