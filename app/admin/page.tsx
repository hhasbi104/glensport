"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Booking = {
  id: number;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: "pending" | "confirmed" | "rejected" | "cancelled";
  total_price: number;
  notes: string | null;
  created_at: string;
  court_name: string;
  sport: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
};

const statusNames: Record<Booking["status"], string> = {
  pending: "Menunggu",
  confirmed: "Dikonfirmasi",
  rejected: "Ditolak",
  cancelled: "Dibatalkan",
};
function rupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
}

function dateLabel(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdminPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeWarning, setNoticeWarning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/bookings", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Pesanan gagal dimuat.");
      setBookings(data.bookings as Booking[]);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          if (active) router.replace("/login");
          return;
        }
        const session: { role?: string } = await response.json();
        if (active && session.role === "admin") setAuthorized(true);
        else if (active && session.role === "user") router.replace("/");
        else if (active) router.replace("/login");
      })
      .catch((caught: unknown) => {
        console.error("Failed to check admin session:", caught);
        if (active) setError("Sesi admin gagal diperiksa. Coba login kembali.");
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!authorized) return;
    void loadBookings();
    const controller = new AbortController();
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let alive = true;

    async function listen() {
      while (alive) {
        try {
          const response = await fetch("/api/admin/events", {
            signal: controller.signal,
            cache: "no-store",
          });
          if (!response.ok || !response.body) {
            const body = await response.text();
            throw new Error(body || "Koneksi pembaruan langsung gagal.");
          }
          setConnected(true);
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          while (alive) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split("\n\n");
            buffer = events.pop() ?? "";
            if (events.some((event) => event.includes("event: bookings_changed"))) {
              void loadBookings();
            }
          }
          setConnected(false);
        } catch {
          setConnected(false);
          if (!alive) break;
          await new Promise<void>((resolve) => {
            reconnectTimer = setTimeout(resolve, 3000);
          });
        }
      }
    }

    void listen();
    return () => {
      alive = false;
      controller.abort();
      clearTimeout(reconnectTimer);
    };
  }, [authorized, loadBookings]);

  function signOut() {
    void fetch("/api/auth/logout", { method: "POST" });
    setAuthorized(false);
    setBookings([]);
    setConnected(false);
    router.replace("/login");
  }

  async function updateStatus(booking: Booking, status: "confirmed" | "rejected" | "cancelled") {
    setUpdating(booking.id);
    setError("");
    setNotice("");
    setNoticeWarning(false);
    try {
      const response = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Status gagal diperbarui.");
      await loadBookings();
      if (status === "confirmed") {
        setNoticeWarning(data.notification?.status !== "sent");
        setNotice(data.notification?.status === "sent"
          ? "Booking dikonfirmasi dan pesan WhatsApp berhasil dikirim."
          : data.notification?.message || "Booking berhasil dikonfirmasi.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Terjadi kesalahan.");
    } finally {
      setUpdating(null);
    }
  }

  const pendingCount = bookings.filter((booking) => booking.status === "pending").length;
  const confirmedCount = bookings.filter((booking) => booking.status === "confirmed").length;

  if (checkingSession || !authorized) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f7f2] px-5">
        <p role={error ? "alert" : "status"} className="text-sm text-[#657168]">
          {error || "Memeriksa sesi admin..."}
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f7f2]">
      <header className="border-b border-[#e4e9e1] bg-white">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="grid h-9 w-9 place-items-center rounded-xl bg-[#b7f36b] font-black">G</Link>
            <div><p className="text-sm font-black">GlenSport <span className="font-medium text-[#879188]">/ Admin</span></p><p className="text-[11px] text-[#88938b]">Manajemen reservasi</p></div>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2 text-xs font-semibold text-[#6c796f]"><i className={`h-2 w-2 rounded-full ${connected ? "bg-[#68bd52]" : "bg-[#d5a657]"}`} />{connected ? "Live" : "Menghubungkan..."}</span>
            <button onClick={signOut} className="rounded-full border border-[#e2e7e0] px-4 py-2 text-xs font-bold text-[#59665d] hover:bg-[#f5f7f2]">Keluar</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-5 py-8 sm:px-8 sm:py-11">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#77906e]">RINGKASAN HARI INI</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Pesanan lapangan</h1>
            <p className="mt-2 text-sm text-[#78837b]">Pantau dan kelola permintaan booking yang masuk.</p>
          </div>
          <button onClick={() => void loadBookings()} disabled={loading} className="rounded-xl border border-[#dfe5dc] bg-white px-4 py-2.5 text-sm font-bold hover:border-[#95a594] disabled:opacity-60">↻ <span className="ml-1">{loading ? "Memuat..." : "Muat ulang"}</span></button>
        </div>

        {error && <p role="alert" className="mt-5 rounded-xl border border-[#f1d4ce] bg-[#fff4f1] px-4 py-3 text-sm text-[#a94332]">{error}</p>}
        {notice && <p role={noticeWarning ? "alert" : "status"} className={`mt-5 rounded-xl border px-4 py-3 text-sm ${noticeWarning ? "border-[#ead9b5] bg-[#fff8e9] text-[#815c20]" : "border-[#d9e8d2] bg-[#f0f7ed] text-[#3d693a]"}`}>{notice}</p>}

        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          {[
            { label: "Total reservasi", value: bookings.length, icon: "▤", tint: "bg-[#eaf2e8]" },
            { label: "Perlu konfirmasi", value: pendingCount, icon: "◷", tint: "bg-[#fff2dc]" },
            { label: "Terkonfirmasi", value: confirmedCount, icon: "✓", tint: "bg-[#e6f4df]" },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-[#e6ebe3] bg-white p-5">
              <div className="flex items-center justify-between"><span className="text-sm font-semibold text-[#768179]">{item.label}</span><span className={`grid h-9 w-9 place-items-center rounded-xl ${item.tint} text-lg`}>{item.icon}</span></div>
              <p className="mt-3 text-3xl font-black">{item.value}</p>
            </div>
          ))}
        </div>

        <section className="mt-7 overflow-hidden rounded-2xl border border-[#e6ebe3] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#edf0eb] px-5 py-4 sm:px-6">
            <div><h2 className="font-bold">Daftar pesanan</h2><p className="mt-1 text-xs text-[#89938b]">Pembaruan otomatis saat ada aktivitas booking baru.</p></div>
            <span className="rounded-full bg-[#f2f5ef] px-3 py-1.5 text-xs font-bold text-[#69776b]">{bookings.length} pesanan</span>
          </div>
          <div className="overflow-x-auto">
            <table className="admin-table w-full min-w-[980px] border-collapse">
              <thead><tr className="border-b border-[#edf0eb]"><th>Pemesan</th><th>Lapangan</th><th>Jadwal</th><th>Total</th><th>Status</th><th className="!text-right">Tindakan</th></tr></thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td><p className="text-sm font-bold">{booking.customer_name || "Pelanggan"}</p><p className="mt-1 text-xs text-[#818c84]">{booking.customer_phone || "—"}{booking.customer_email ? ` · ${booking.customer_email}` : ""}</p>{booking.notes && <p className="mt-1 max-w-[200px] truncate text-[11px] text-[#929b94]" title={booking.notes}>{booking.notes}</p>}</td>
                    <td><p className="text-sm font-semibold">{booking.court_name}</p><p className="mt-1 text-xs text-[#818c84]">{booking.sport}</p></td>
                    <td><p className="text-sm font-semibold">{dateLabel(booking.booking_date)}</p><p className="mt-1 text-xs text-[#818c84]">{String(booking.start_time).slice(0, 5)} – {String(booking.end_time).slice(0, 5)}</p></td>
                    <td className="text-sm font-semibold">{rupiah(booking.total_price)}</td>
                    <td><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${booking.status === "pending" ? "bg-[#fff2dc] text-[#94621d]" : booking.status === "confirmed" ? "bg-[#e8f4e3] text-[#41733b]" : booking.status === "rejected" ? "bg-[#fdecea] text-[#a54c43]" : "bg-[#edf0ed] text-[#6e7770]"}`}>{statusNames[booking.status]}</span></td>
                    <td className="!text-right">
                      {booking.status === "pending" ? <div className="flex justify-end gap-2"><button disabled={updating === booking.id} onClick={() => void updateStatus(booking, "rejected")} className="rounded-lg border border-[#eadbd8] px-3 py-2 text-xs font-bold text-[#a14d42] hover:bg-[#fff4f1] disabled:opacity-50">Tolak</button><button disabled={updating === booking.id} onClick={() => void updateStatus(booking, "confirmed")} className="rounded-lg bg-[#1c3e2d] px-3 py-2 text-xs font-bold text-white hover:bg-[#2e5940] disabled:opacity-50">Terima</button></div> : booking.status === "confirmed" ? <button disabled={updating === booking.id} onClick={() => void updateStatus(booking, "cancelled")} className="rounded-lg border border-[#e2e7e0] px-3 py-2 text-xs font-bold text-[#667168] hover:bg-[#f5f7f2] disabled:opacity-50">Batalkan</button> : <span className="text-xs text-[#a1aaa3]">—</span>}
                    </td>
                  </tr>
                ))}
                {!loading && bookings.length === 0 && <tr><td colSpan={6} className="!py-14 text-center"><span className="text-3xl">📋</span><p className="mt-3 text-sm font-semibold text-[#68756c]">Belum ada pesanan masuk</p><p className="mt-1 text-xs text-[#939d95]">Pesanan baru akan tampil di sini.</p></td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        <p className="mt-5 text-xs text-[#89938b]">Menampilkan maksimal 250 reservasi terbaru. Status menunggu dan dikonfirmasi menahan slot jadwal.</p>
      </div>
    </main>
  );
}
