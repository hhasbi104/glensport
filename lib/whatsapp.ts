type BookingConfirmation = {
  id: number;
  customerName: string;
  customerPhone: string | null;
  courtName: string;
  sport: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  totalPrice: number;
};

export type WhatsAppResult =
  | { status: "sent" }
  | { status: "skipped" | "failed"; message: string };

function whatsappPhoneNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  const international = digits.startsWith("62")
    ? digits
    : digits.startsWith("0")
      ? `62${digits.slice(1)}`
      : `62${digits}`;
  return /^\d{8,15}$/.test(international) ? international : null;
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function confirmationMessage(booking: BookingConfirmation): string {
  const total = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(booking.totalPrice);

  return `Halo ${booking.customerName}, booking lapangan ${booking.courtName} (${booking.sport}) pada ${dateLabel(booking.bookingDate)} pukul ${booking.startTime}-${booking.endTime} telah dikonfirmasi. Total pembayaran: ${total}.`;
}

function openWaEndpoint(baseUrl: string, sessionId: string): URL {
  const base = new URL(baseUrl);
  if (
    (base.protocol !== "https:" && base.protocol !== "http:") ||
    base.username ||
    base.password ||
    base.pathname !== "/" ||
    base.search ||
    base.hash
  ) {
    throw new Error("OPENWA_BASE_URL tidak valid.");
  }
  if (process.env.NODE_ENV === "production" && base.protocol !== "https:") {
    throw new Error("OPENWA_BASE_URL harus menggunakan HTTPS di production.");
  }

  return new URL(
    `/api/sessions/${encodeURIComponent(sessionId)}/messages/send-text`,
    base.origin,
  );
}

export async function sendBookingConfirmation(
  booking: BookingConfirmation,
): Promise<WhatsAppResult> {
  if (!booking.customerPhone) {
    return { status: "skipped", message: "Nomor WhatsApp pelanggan tidak tersedia." };
  }

  const recipient = whatsappPhoneNumber(booking.customerPhone);
  if (!recipient) {
    return { status: "skipped", message: "Format nomor WhatsApp pelanggan tidak valid." };
  }

  const baseUrl = process.env.OPENWA_BASE_URL?.trim();
  const sessionId = process.env.OPENWA_SESSION_ID?.trim();
  const apiKey = process.env.OPENWA_API_KEY?.trim();
  const missingConfiguration = [
    ["OPENWA_BASE_URL", baseUrl],
    ["OPENWA_SESSION_ID", sessionId],
    ["OPENWA_API_KEY", apiKey],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (!baseUrl || !sessionId || !apiKey) {
    return {
      status: "skipped",
      message: `OpenWA belum dikonfigurasi. Isi ${missingConfiguration.join(", ")} di environment aplikasi.`,
    };
  }

  try {
    const response = await fetch(openWaEndpoint(baseUrl, sessionId), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
        "Idempotency-Key": `courtly-booking-${booking.id}`,
      },
      body: JSON.stringify({
        chatId: `${recipient}@c.us`,
        text: confirmationMessage(booking),
      }),
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.error("OpenWA confirmation request failed:", response.status);
      return {
        status: "failed",
        message: response.status === 401 || response.status === 403
          ? "Booking berhasil dikonfirmasi, tetapi API key OpenWA tidak valid atau tidak memiliki akses ke session."
          : response.status === 409
            ? "Booking berhasil dikonfirmasi, tetapi session WhatsApp OpenWA belum siap atau belum terhubung."
            : response.status === 400
              ? "Booking berhasil dikonfirmasi, tetapi session OpenWA belum aktif atau data pesan ditolak."
              : "Booking berhasil dikonfirmasi, tetapi pesan WhatsApp gagal dikirim. Periksa status session dan konfigurasi OpenWA.",
      };
    }

    return { status: "sent" };
  } catch (error) {
    console.error("OpenWA confirmation request failed:", error);
    return {
      status: "failed",
      message:
        "Booking berhasil dikonfirmasi, tetapi pesan WhatsApp gagal dikirim. Periksa koneksi OpenWA.",
    };
  }
}
