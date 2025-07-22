import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export async function GET(request: NextRequest) {
  // /api/session-done/[sessionId] gibi bir route için:
  const sessionId = request.nextUrl.pathname.split("/").pop() || "";
  const donePath = path.join(process.cwd(), "public", "collaborator-sessions", sessionId, "main_done.txt");
  const done = fs.existsSync(donePath);
  return NextResponse.json({ done });
} 