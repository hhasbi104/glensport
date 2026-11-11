import { isAdminAuthorized } from "@/lib/admin-auth";
import { subscribeToBookingEvents } from "@/lib/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAdminAuthorized(request)) {
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
