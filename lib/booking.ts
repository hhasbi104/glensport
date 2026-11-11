export const SPORTS = ["Futsal", "Badminton", "Tenis"] as const;
export type Sport = (typeof SPORTS)[number];

export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "rejected",
  "cancelled",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export function isSport(value: unknown): value is Sport {
  return typeof value === "string" && SPORTS.includes(value as Sport);
}

export function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isValidStartTime(value: unknown): value is string {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):00$/.test(value)) {
    return false;
  }
  const hour = Number(value.slice(0, 2));
  return hour >= 7 && hour <= 21;
}

export function endTimeFor(startTime: string): string {
  return `${String(Number(startTime.slice(0, 2)) + 1).padStart(2, "0")}:00`;
}

export function isPeakHour(startTime: string): boolean {
  const hour = Number(startTime.slice(0, 2));
  return hour >= 17 && hour < 21;
}

export function minimumBookingDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}
