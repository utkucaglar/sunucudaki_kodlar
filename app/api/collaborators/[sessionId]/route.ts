import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";

export async function GET(request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await context.params;
    const collabPath = path.join(process.cwd(), "public", "collaborator-sessions", sessionId, "collaborators.json");
    const donePath = path.join(process.cwd(), "public", "collaborator-sessions", sessionId, "collaborators_done.txt");
    if (!fs.existsSync(collabPath)) {
      return NextResponse.json({ collaborators: [], completed: false });
    }
    const collaborators = JSON.parse(fs.readFileSync(collabPath, "utf-8"));
    const completed = fs.existsSync(donePath);
    return NextResponse.json({ collaborators, completed });
  } catch (error) {
    console.error("Collaborators fetch error:", error);
    return NextResponse.json({ error: "İşbirlikçi bilgileri alınırken hata oluştu" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { profileId } = await request.json();
    const { sessionId } = await params;
    if (!profileId || !sessionId) {
      return NextResponse.json({ error: "profileId ve sessionId gereklidir" }, { status: 400 });
    }
    // main_profile.json'dan ilgili profili bul
    const sessionDir = path.join(process.cwd(), "public", "collaborator-sessions", sessionId);
    const mainProfilePath = path.join(sessionDir, "main_profile.json");
    if (!fs.existsSync(mainProfilePath)) {
      return NextResponse.json({ error: "main_profile.json bulunamadı" }, { status: 404 });
    }
    const profiles = JSON.parse(fs.readFileSync(mainProfilePath, "utf-8"));
    const selectedProfile = profiles.find((p: any) => p.id === profileId || p.id === Number(profileId));
    if (!selectedProfile) {
      return NextResponse.json({ error: "Seçilen profil bulunamadı" }, { status: 404 });
    }
    // Python scriptini başlat
    const scriptsDir = path.join(process.cwd(), "scripts");
    const collabScript = path.join(scriptsDir, "scrape_collaborators.py");
    const pythonArgs = [collabScript, selectedProfile.name, sessionId, selectedProfile.url];
    const pythonProc = spawn("python", pythonArgs, { 
      detached: true, 
      stdio: "ignore",
      windowsHide: true  // Windows'ta CMD penceresini gizle
    });
    pythonProc.unref();
    // collaborators.json dosyasını bekle (polling)
    const collabPath = path.join(sessionDir, "collaborators.json");
    const donePath = path.join(sessionDir, "collaborators_done.txt");
    let collaborators = [];
    let waited = 0;
    const maxWaitMs = 240000; // 4 dakika
    const pollInterval = 500;
    while (waited < maxWaitMs) {
      if (fs.existsSync(collabPath) && fs.existsSync(donePath)) {
        try {
          collaborators = JSON.parse(fs.readFileSync(collabPath, "utf-8"));
          break;
        } catch (e) { /* dosya yazılırken okunamazsa, bir sonraki döngüde tekrar dene */ }
      }
      await new Promise(r => setTimeout(r, pollInterval));
      waited += pollInterval;
    }
    if (collaborators.length > 0) {
      return NextResponse.json({ sessionId, profile: selectedProfile, collaborators });
    } else {
      return NextResponse.json({ error: "İşbirlikçiler bulunamadı veya zaman aşımı." }, { status: 404 });
    }
  } catch (error) {
    console.error("Collaborator search error:", error);
    return NextResponse.json({ error: "İşbirlikçi arama sırasında hata oluştu" }, { status: 500 });
  }
}
