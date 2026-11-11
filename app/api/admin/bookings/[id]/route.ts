import { NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { getPool } from "@/lib/db";
import { publishBookingsChanged } from "@/lib/realtime";
import { sendBookingConfirmation } from "@/lib/whatsapp";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Akses admin tidak diizinkan." }, { status: 401 });
  }

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) {
    return NextResponse.json({ error: "ID pesanan tidak valid." }, { status: 400 });
  }

  let body: { status?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }
  const nextStatus = body.status;
  if (nextStatus !== "confirmed" && nextStatus !== "rejected" && nextStatus !== "cancelled") {
    return NextResponse.json({ error: "Status tujuan tidak valid." }, { status: 400 });
  }

  const connection = await getPool().connect();
  try {
    await connection.query("BEGIN");
    const result = await connection.query(
      `SELECT b.status, to_char(b.booking_date, 'YYYY-MM-DD') AS booking_date,
              to_char(b.start_time, 'HH24:MI') AS start_time,
              to_char(b.end_time, 'HH24:MI') AS end_time,
              b.total_price, c.name AS court_name, c.sport,
              u.name AS customer_name, u.phone AS customer_phone
       FROM bookings b
       JOIN courts c ON c.id = b.court_id
       LEFT JOIN users u ON u.id = b.user_id
       WHERE b.id = $1 FOR UPDATE OF b`,
      [id],
    );
    const booking = result.rows[0];
    const currentStatus = booking?.status as string | undefined;
    if (!booking) {
      await connection.query("ROLLBACK");
      return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });
    }

    const allowed =
      (currentStatus === "pending" && (nextStatus === "confirmed" || nextStatus === "rejected")) ||
      (currentStatus === "confirmed" && nextStatus === "cancelled");
    if (!allowed) {
      await connection.query("ROLLBACK");
      return NextResponse.json(
        { error: "Perubahan status ini tidak diizinkan." },
        { status: 409 },
      );
    }

    await connection.query("UPDATE bookings SET status = $1 WHERE id = $2", [nextStatus, id]);
    await connection.query("COMMIT");
    publishBookingsChanged();

    const notification = nextStatus === "confirmed"
      ? await sendBookingConfirmation({
          customerName: String(booking.customer_name || "Pelanggan"),
          customerPhone: booking.customer_phone ? String(booking.customer_phone) : null,
          courtName: String(booking.court_name),
          sport: String(booking.sport),
          bookingDate: String(booking.booking_date),
          startTime: String(booking.start_time),
          endTime: String(booking.end_time),
          totalPrice: Number(booking.total_price),
        })
      : undefined;

    return NextResponse.json({ id, status: nextStatus, notification });
  } catch (error) {
    await connection.query("ROLLBACK");
    console.error("Failed to update booking status:", error);
    return NextResponse.json({ error: "Status pesanan gagal diperbarui." }, { status: 500 });
  } finally {
    connection.release();
  }
}
