import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";

export async function GET(request: NextRequest, context: { params: { sessionId: string } }) {
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

export async function POST(request: NextRequest, context: { params: { sessionId: string } }) {
  try {
    const { sessionId } = await context.params;
    const { name, profileUrl, photoUrl } = await request.json();
    if (!name || !sessionId) {
      return NextResponse.json({ error: "İsim ve sessionId gereklidir" }, { status: 400 });
    }

    // --- PROFİL FOTOĞRAFINI İNDİR VE KAYDET ---
    if (photoUrl) {
      const dir = path.join(process.cwd(), "public", "collaborator-sessions", sessionId, "profile_pictures");
      fs.mkdirSync(dir, { recursive: true });
      const dest = path.join(dir, "profile_main.jpg");
      try {
        console.log("Gelen photoUrl:", photoUrl.slice(0, 100));
        if (photoUrl.startsWith("data:image")) {
          const base64Data = photoUrl.split(",")[1];
          fs.writeFileSync(dest, Buffer.from(base64Data, "base64"));
        } else if (photoUrl.startsWith("http")) {
          const res = await fetch(photoUrl);
          const buffer = Buffer.from(await res.arrayBuffer());
          fs.writeFileSync(dest, buffer);
        } else {
          console.log("Bilinmeyen foto formatı:", photoUrl.slice(0, 30));
        }
      } catch (e) {
        console.error("Profil fotoğrafı kaydedilemedi:", e);
      }
    }

    const scriptsDir = path.join(process.cwd(), "scripts");
    const collabScript = path.join(scriptsDir, "scrape_collaborators.py");
    const args = [collabScript, name.trim(), sessionId];
    if (profileUrl) args.push(profileUrl);
    spawn("python", args, { detached: true, stdio: "ignore" }).unref();
    return NextResponse.json({ status: "started" });
  } catch (error) {
    console.error("Collaborator scraping POST error:", error);
    return NextResponse.json({ error: "İşbirlikçi scraping başlatılamadı" }, { status: 500 });
  }
}
