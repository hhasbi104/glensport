import { NextResponse } from "next/server";
import {
  endTimeFor,
  isPeakHour,
  isValidDate,
  isValidStartTime,
  minimumBookingDate,
} from "@/lib/booking";
import { getPool } from "@/lib/db";
import { publishBookingsChanged } from "@/lib/realtime";

export const runtime = "nodejs";

type CourtPrice = {
  id: number;
  price_off_peak: number;
  price_peak: number;
};

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const date = params.get("date");
  if (!isValidDate(date)) {
    return NextResponse.json({ error: "Tanggal tidak valid." }, { status: 400 });
  }

  try {
    const result = await getPool().query(
      `SELECT court_id, start_time, end_time
       FROM bookings
       WHERE booking_date = $1 AND status IN ('pending', 'confirmed')
       ORDER BY court_id, start_time`,
      [date],
    );
    return NextResponse.json({ bookings: result.rows });
  } catch (error) {
    console.error("Failed to load booking availability:", error);
    return NextResponse.json({ error: "Jadwal tidak dapat dimuat." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }

  const courtId = Number(body.courtId);
  const bookingDate = body.date;
  const startTime = body.startTime;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";

  if (
    !Number.isSafeInteger(courtId) ||
    courtId < 1 ||
    !isValidDate(bookingDate) ||
    bookingDate < minimumBookingDate() ||
    !isValidStartTime(startTime) ||
    name.length < 2 ||
    name.length > 120 ||
    !/^[+0-9()\-\s]{8,32}$/.test(phone) ||
    (email !== "" && (email.length > 190 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) ||
    notes.length > 500
  ) {
    return NextResponse.json(
      { error: "Data reservasi tidak valid. Periksa kembali isian dan waktu." },
      { status: 400 },
    );
  }

  if (bookingDate === minimumBookingDate()) {
    const [hour, minute] = startTime.split(":").map(Number);
    const now = new Date();
    if (hour < now.getHours() || (hour === now.getHours() && minute <= now.getMinutes())) {
      return NextResponse.json({ error: "Jam yang dipilih sudah berlalu." }, { status: 400 });
    }
  }

  const endTime = endTimeFor(startTime);
  const connection = await getPool().connect();
  try {
    await connection.query("BEGIN");

    const courtResult = await connection.query<CourtPrice>(
      "SELECT id, price_off_peak, price_peak FROM courts WHERE id = $1 AND is_active = TRUE FOR UPDATE",
      [courtId],
    );
    const court = courtResult.rows[0];
    if (!court) {
      await connection.query("ROLLBACK");
      return NextResponse.json({ error: "Lapangan tidak tersedia." }, { status: 404 });
    }

    const conflicts = await connection.query(
      `SELECT id FROM bookings
       WHERE court_id = $1 AND booking_date = $2
         AND status IN ('pending', 'confirmed')
         AND start_time < $3 AND end_time > $4
       LIMIT 1`,
      [courtId, bookingDate, endTime, startTime],
    );
    if ((conflicts.rowCount ?? 0) > 0) {
      await connection.query("ROLLBACK");
      return NextResponse.json(
        { error: "Slot baru saja dipesan. Silakan pilih jam lain." },
        { status: 409 },
      );
    }

    let userId: number;
    if (email) {
      const userResult = await connection.query<{ id: number }>(
        `INSERT INTO users (name, email, phone) VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone
         RETURNING id`,
        [name, email, phone],
      );
      userId = userResult.rows[0].id;
    } else {
      const userResult = await connection.query<{ id: number }>(
        "INSERT INTO users (name, phone) VALUES ($1, $2) RETURNING id",
        [name, phone],
      );
      userId = userResult.rows[0].id;
    }

    const totalPrice = isPeakHour(startTime) ? court.price_peak : court.price_off_peak;
    const result = await connection.query<{ id: number }>(
      `INSERT INTO bookings
         (user_id, court_id, booking_date, start_time, end_time, total_price, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [userId, courtId, bookingDate, startTime, endTime, totalPrice, notes || null],
    );
    await connection.query("COMMIT");
    publishBookingsChanged();
    return NextResponse.json(
      { bookingId: result.rows[0].id, totalPrice, status: "pending" },
      { status: 201 },
    );
  } catch (error) {
    await connection.query("ROLLBACK");
    console.error("Failed to create booking:", error);
    return NextResponse.json({ error: "Reservasi gagal diproses." }, { status: 500 });
  } finally {
    connection.release();
  }
}
