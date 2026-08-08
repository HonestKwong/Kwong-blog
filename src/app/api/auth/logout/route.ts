import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/core/auth/session";

export const runtime = "nodejs";

export function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
