export type BookingEvent = { type: "bookings_changed" };
type Listener = (event: BookingEvent) => void;

declare global {
  var bookingEventListeners: Set<Listener> | undefined;
}

const listeners = (globalThis.bookingEventListeners ??= new Set<Listener>());

export function subscribeToBookingEvents(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function publishBookingsChanged(): void {
  for (const listener of listeners) listener({ type: "bookings_changed" });
}
