import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { execSync, spawn } from "child_process";

function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "İsim gereklidir" }, { status: 400 });
    }
    const sessionId = generateSessionId();
    const scriptsDir = path.join(process.cwd(), "scripts");
    // 1. Ana profil scraping (bloklayıcı)
    const mainProfileScript = path.join(scriptsDir, "scrape_main_profile.py");
    try {
      execSync(`python "${mainProfileScript}" "${name.trim()}" "${sessionId}"`, { stdio: "inherit" });
    } catch (err) {
      return NextResponse.json({ error: "Ana profil scraping scripti çalıştırılırken hata oluştu." }, { status: 500 });
    }
    // 2. İşbirlikçi scraping (arka planda)
    // const collabScript = path.join(scriptsDir, "scrape_collaborators.py");
    // spawn("python", [collabScript, name.trim(), sessionId], { detached: true, stdio: "ignore" }).unref();
    // 3. Ana profil bilgisini oku
    const mainProfilePath = path.join(process.cwd(), "public", "collaborator-sessions", sessionId, "main_profile.json");
    if (!fs.existsSync(mainProfilePath)) {
      return NextResponse.json({ error: "Ana profil sonucu bulunamadı." }, { status: 404 });
    }
    const mainProfile = JSON.parse(fs.readFileSync(mainProfilePath, "utf-8"));
    // 4. Yanıtı döndür
    if (mainProfile.profiles && mainProfile.profiles.length > 1) {
      // Çoklu profil sonucu varsa, hepsini gönder
      return NextResponse.json({
        sessionId,
        profiles: mainProfile.profiles
      });
    } else if (mainProfile.profiles && mainProfile.profiles.length === 1) {
      // Tek profil varsa, işbirlikçi scraping'i başlat
      const collabScript = path.join(scriptsDir, "scrape_collaborators.py");
      const profile = mainProfile.profiles[0];
      const args = [collabScript, name.trim(), sessionId];
      if (profile.profileUrl) args.push(profile.profileUrl);
      spawn("python", args, { detached: true, stdio: "ignore" }).unref();

      return NextResponse.json({
        sessionId,
        mainProfile: profile
      });
    } else {
      return NextResponse.json({ error: "Profil bulunamadı." }, { status: 404 });
    }
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Arama sırasında hata oluştu" }, { status: 500 });
  }
}
