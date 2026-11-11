import { NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { getPool } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const sessionCookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("courtly_session="))
    ?.slice("courtly_session=".length);
  if (!isAdminAuthorized(request.headers.get("x-admin-key"), sessionCookie ?? null)) {
    return NextResponse.json({ error: "Akses admin tidak diizinkan." }, { status: 401 });
  }

  try {
    const result = await getPool().query(
      `SELECT b.id, b.booking_date, b.start_time, b.end_time, b.status,
              b.total_price, b.notes, b.created_at, c.name AS court_name,
              c.sport, u.name AS customer_name, u.phone AS customer_phone,
              u.email AS customer_email
       FROM bookings b
       JOIN courts c ON c.id = b.court_id
       LEFT JOIN users u ON u.id = b.user_id
       ORDER BY b.created_at DESC
       LIMIT 250`,
    );
    return NextResponse.json({ bookings: result.rows });
  } catch (error) {
    console.error("Failed to load admin bookings:", error);
    return NextResponse.json({ error: "Daftar pesanan gagal dimuat." }, { status: 500 });
  }
}
