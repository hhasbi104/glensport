import { isAdminAuthorized } from "@/lib/admin-auth";
import { subscribeToBookingEvents } from "@/lib/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const sessionCookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("courtly_session="))
    ?.slice("courtly_session=".length);
  if (!isAdminAuthorized(request.headers.get("x-admin-key"), sessionCookie ?? null)) {
    return new Response("Akses admin tidak diizinkan.", { status: 401 });
  }

  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let heartbeat: ReturnType<typeof setInterval>;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (payload: string) => controller.enqueue(encoder.encode(payload));
      unsubscribe = subscribeToBookingEvents((event) => {
        send(`event: ${event.type}\ndata: {}\n\n`);
      });
      heartbeat = setInterval(() => send(": keep-alive\n\n"), 25_000);
      send("event: connected\ndata: {}\n\n");
    },
    cancel() {
      clearInterval(heartbeat);
      unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
