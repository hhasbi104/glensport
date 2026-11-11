import { NextResponse } from "next/server";
import { createSessionToken } from "@/lib/admin-auth";
import { getPool } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

export const runtime = "nodejs";

type UserRow = {
  id: number;
  email: string;
  password_hash: string | null;
  role: "admin" | "user";
};

function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set("courtly_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (
    email.length > 190 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    password.length < 1 ||
    password.length > 256
  ) {
    return NextResponse.json({ error: "Email atau password tidak valid." }, { status: 400 });
  }

  try {
    const result = await getPool().query<UserRow>(
      "SELECT id, email, password_hash, role FROM users WHERE email = $1 LIMIT 1",
      [email],
    );
    const user = result.rows[0];
    if (!user || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ error: "Email atau password salah." }, { status: 401 });
    }

    const token = createSessionToken({
      sub: String(user.id),
      email: user.email,
      role: user.role,
    });
    const response = NextResponse.json({
      role: user.role,
      redirectTo: user.role === "admin" ? "/admin" : "/",
    });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    console.error("Login failed:", error);
    return NextResponse.json(
      {
        error:
          "Login gagal diproses. Periksa koneksi PostgreSQL dan pastikan tabel serta akun admin sudah tersedia.",
      },
      { status: 500 },
    );
  }
}
