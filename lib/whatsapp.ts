type BookingConfirmation = {
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

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME;
  const apiVersion = process.env.WHATSAPP_GRAPH_API_VERSION;
  const missingConfiguration = [
    ["WHATSAPP_PHONE_NUMBER_ID", phoneNumberId],
    ["WHATSAPP_ACCESS_TOKEN", accessToken],
    ["WHATSAPP_TEMPLATE_NAME", templateName],
    ["WHATSAPP_GRAPH_API_VERSION", apiVersion],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missingConfiguration.length > 0) {
    return {
      status: "skipped",
      message: `WhatsApp belum dikonfigurasi. Isi ${missingConfiguration.join(", ")} di .env.local, lalu restart server.`,
    };
  }

  const parameters = [
    booking.customerName,
    `${booking.courtName} (${booking.sport})`,
    dateLabel(booking.bookingDate),
    `${booking.startTime}-${booking.endTime}`,
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(booking.totalPrice),
  ];

  try {
    const response = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipient,
          type: "template",
          template: {
            name: templateName,
            language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "id" },
            components: [
              {
                type: "body",
                parameters: parameters.map((text) => ({ type: "text", text })),
              },
            ],
          },
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!response.ok) {
      console.error("WhatsApp confirmation request failed:", response.status);
      return {
        status: "failed",
        message: "Booking berhasil dikonfirmasi, tetapi pesan WhatsApp gagal dikirim.",
      };
    }

    return { status: "sent" };
  } catch (error) {
    console.error("WhatsApp confirmation request failed:", error);
    return {
      status: "failed",
      message: "Booking berhasil dikonfirmasi, tetapi pesan WhatsApp gagal dikirim.",
    };
  }
}