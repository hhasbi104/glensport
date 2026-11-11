import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    email: session.email,
    role: session.role,
  });
}
