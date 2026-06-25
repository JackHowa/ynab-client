import { NextRequest, NextResponse } from "next/server";
import { clearSession } from "@/lib/session";

export const runtime = "nodejs";

// POST /api/auth/logout — drop the session cookie and return home.
export async function POST(req: NextRequest) {
  await clearSession();
  return NextResponse.redirect(new URL("/", req.nextUrl.origin), {
    status: 303,
  });
}
