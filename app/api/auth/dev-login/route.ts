import { NextResponse } from "next/server";
import { createSessionToken } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Bypass hanya tersedia dalam mode development." }, { status: 404 });
  }

  const response = NextResponse.json({ redirectTo: "/admin" });
  response.cookies.set(
    "courtly_session",
    createSessionToken({
      sub: "development-admin",
      email: "admin@courtly.local",
      role: "admin",
    }),
    {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    },
  );
  return response;
}
