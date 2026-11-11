import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { isSport } from "@/lib/booking";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const sport = new URL(request.url).searchParams.get("sport");
  if (sport && !isSport(sport)) {
    return NextResponse.json({ error: "Jenis olahraga tidak valid." }, { status: 400 });
  }

  try {
    const pool = getPool();
    const result = sport
      ? await pool.query(
          "SELECT id, name, sport, description, price_off_peak, price_peak FROM courts WHERE is_active = TRUE AND sport = $1 ORDER BY id",
          [sport],
        )
      : await pool.query(
          "SELECT id, name, sport, description, price_off_peak, price_peak FROM courts WHERE is_active = TRUE ORDER BY sport, id",
        );
    return NextResponse.json({ courts: result.rows });
  } catch (error) {
    console.error("Failed to load courts:", error);
    return NextResponse.json({ error: "Lapangan gagal dimuat." }, { status: 500 });
  }
}
