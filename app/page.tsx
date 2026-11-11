"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Sport = "Futsal" | "Badminton" | "Tenis";
type Court = {
  id: number;
  name: string;
  sport: Sport;
  description: string;
  price_off_peak: number;
  price_peak: number;
};
type ReservedSlot = { court_id: number; start_time: string; end_time: string };

const defaultCourts: Court[] = [
  { id: 1, name: "Arena Futsal A", sport: "Futsal", description: "Rumput sintetis premium · 5 lawan 5", price_off_peak: 150000, price_peak: 220000 },
  { id: 2, name: "Arena Futsal B", sport: "Futsal", description: "Lapangan indoor · ruang ganti tersedia", price_off_peak: 130000, price_peak: 200000 },
  { id: 3, name: "Badminton Court 1", sport: "Badminton", description: "Lantai vinyl · pencahayaan turnamen", price_off_peak: 60000, price_peak: 90000 },
  { id: 4, name: "Badminton Court 2", sport: "Badminton", description: "Lantai kayu · shuttlecock tersedia", price_off_peak: 55000, price_peak: 85000 },
  { id: 5, name: "Tennis Court 1", sport: "Tenis", description: "Lapangan hard court outdoor", price_off_peak: 100000, price_peak: 160000 },
  { id: 6, name: "Tennis Court 2", sport: "Tenis", description: "Lapangan sintetis · penyewaan raket tersedia", price_off_peak: 90000, price_peak: 150000 },
];

const sports: { name: Sport; icon: string; tagline: string }[] = [
  { name: "Futsal", icon: "⚽", tagline: "Main bareng, menang bareng" },
  { name: "Badminton", icon: "🏸", tagline: "Smash sampai puas" },
  { name: "Tenis", icon: "🎾", tagline: "Serve up your best" },
];

const heroPhotos = [
  "https://images.unsplash.com/photo-1521412644187-c49fa049e84d?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1400&q=80",
];

const slots = Array.from({ length: 15 }, (_, index) => {
  const hour = index + 7;
  return {
    start: `${String(hour).padStart(2, "0")}:00`,
    end: `${String(hour + 1).padStart(2, "0")}:00`,
  };
});

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

function rupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function displayTime(value: string) {
  return value.slice(0, 5);
}

export default function HomePage() {
  const [sport, setSport] = useState<Sport>("Futsal");
  const [courts, setCourts] = useState<Court[]>(defaultCourts);
  const [selectedCourt, setSelectedCourt] = useState<number | null>(defaultCourts[0].id);
  const [courtLoadError, setCourtLoadError] = useState("");
  const [date, setDate] = useState(localDate);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [reserved, setReserved] = useState<ReservedSlot[]>([]);
  const [loadingCourts, setLoadingCourts] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadCourts = useCallback(async () => {
    setLoadingCourts(true);
    try {
      const response = await fetch("/api/courts");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Lapangan gagal dimuat.");
      if (!Array.isArray(data.courts) || data.courts.length === 0) {
        setCourtLoadError("Daftar lapangan default ditampilkan. Pastikan database sudah diisi dengan data lapangan.");
        return;
      }
      const items = data.courts.filter(
        (item: Court) =>
          Number.isSafeInteger(Number(item.id)) &&
          sports.some((category) => category.name === item.sport) &&
          typeof item.name === "string" &&
          Number.isFinite(Number(item.price_off_peak)) &&
          Number.isFinite(Number(item.price_peak)),
      ).map((item: Court) => ({
        ...item,
        id: Number(item.id),
        price_off_peak: Number(item.price_off_peak),
        price_peak: Number(item.price_peak),
      }));
      if (items.length === 0) {
        setCourtLoadError("Data lapangan dari database tidak valid. Daftar lapangan default tetap ditampilkan.");
        return;
      }
      setCourts(items);
      setCourtLoadError("");
    } catch (error) {
      setCourtLoadError(
        `${error instanceof Error ? error.message : "Lapangan gagal dimuat."} Daftar default tetap tersedia; pemesanan memerlukan koneksi database.`,
      );
    } finally {
      setLoadingCourts(false);
    }
  }, []);

  const visibleCourts = courts.filter((item) => item.sport === sport);

  useEffect(() => {
    void loadCourts();
  }, [loadCourts]);

  useEffect(() => {
    if (!visibleCourts.length) {
      setSelectedCourt(null);
      return;
    }
    if (!visibleCourts.some((item) => item.id === selectedCourt)) {
      setSelectedCourt(visibleCourts[0].id);
      setSelectedSlot("");
    }
  }, [sport, courts, selectedCourt]);

  useEffect(() => {
    let active = true;
    setLoadingSlots(true);
    fetch(`/api/bookings?date=${encodeURIComponent(date)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Jadwal gagal dimuat.");
        if (active) setReserved(data.bookings as ReservedSlot[]);
      })
      .catch((error: unknown) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : "Jadwal gagal dimuat.");
          setIsError(true);
        }
      })
      .finally(() => {
        if (active) setLoadingSlots(false);
      });
    return () => {
      active = false;
    };
  }, [date]);

  const court = visibleCourts.find((item) => item.id === selectedCourt) ?? null;
  const chosenSlot = slots.find((item) => item.start === selectedSlot);
  const isPeak = selectedSlot >= "17:00" && selectedSlot < "21:00";
  const price = court ? (isPeak ? court.price_peak : court.price_off_peak) : 0;
  const minimumDate = useMemo(() => localDate(), []);
  const today = date === minimumDate;
  const isReserved = (start: string) =>
    reserved.some(
      (booking) =>
        booking.court_id === selectedCourt &&
        start < displayTime(booking.end_time) &&
        slots.find((slot) => slot.start === start)!.end > displayTime(booking.start_time),
    );

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!court || !chosenSlot) {
      setMessage("Pilih lapangan dan jam bermain terlebih dahulu.");
      setIsError(true);
      return;
    }
    const form = event.currentTarget;
    const formData = new FormData(form);
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courtId: court.id,
          date,
          startTime: chosenSlot.start,
          name: formData.get("name"),
          phone: formData.get("phone"),
          email: formData.get("email"),
          notes: formData.get("notes"),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Reservasi gagal dibuat.");
      setIsError(false);
      setMessage(`Reservasi #${data.bookingId} terkirim! Pengelola akan segera mengonfirmasi.`);
      setSelectedSlot("");
      form.reset();
      const availability = await fetch(`/api/bookings?date=${encodeURIComponent(date)}`);
      const availabilityData = await availability.json();
      if (availability.ok) setReserved(availabilityData.bookings as ReservedSlot[]);
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Terjadi kesalahan.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2 text-xl font-black tracking-tight">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#b7f36b] text-lg">G</span>
          GlenSport<span className="text-[#829087]">.</span>
        </Link>
        <div className="flex items-center gap-3">
          <a href="#booking" className="hidden text-sm font-semibold text-[#56635b] sm:block">
            Cara pesan
          </a>
          <Link
            href="/login"
            className="rounded-full border border-[#dfe5dc] bg-white px-4 py-2.5 text-sm font-semibold transition hover:border-[#1d4832]"
          >
            Masuk pengelola <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </nav>

      <section className="mx-auto grid max-w-7xl gap-10 px-5 pb-12 pt-6 sm:px-8 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:pb-20 lg:pt-12">
        <div className="relative z-10">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#dfe5dc] bg-white px-3 py-2 text-xs font-bold uppercase tracking-[.13em] text-[#506253]">
            <span className="h-2 w-2 rounded-full bg-[#7bc947]" /> Tempat main dimulai di sini
          </div>
          <h1 className="max-w-3xl text-5xl font-black leading-[1.02] tracking-[-.055em] sm:text-6xl lg:text-[76px]">
            Waktunya
            <br />
            <span className="text-[#728078]">turun ke</span>{" "}
            <span className="relative inline-block">
              lapangan<span className="absolute -bottom-1 left-0 -z-10 h-4 w-full rounded-full bg-[#b7f36b] sm:h-5" />
            </span>
            .
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-[#6e7a72] sm:text-lg">
            Cari lapangan terbaik, pilih waktu yang pas, lalu fokus ke permainan. Semuanya beres dalam beberapa klik.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a href="#booking" className="rounded-full bg-[#1c3e2d] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#2e5940]">
              Pesan lapangan <span className="ml-2">↓</span>
            </a>
            <span className="text-sm text-[#7b867e]">Futsal · Badminton · Tenis</span>
          </div>
          <div className="mt-10 flex items-center gap-4 border-t border-[#e1e6de] pt-6">
            <div className="flex -space-x-2">
              {["A", "D", "R", "K"].map((item, index) => (
                <span key={item} className={`grid h-9 w-9 place-items-center rounded-full border-2 border-[#f5f7f2] text-xs font-bold text-white ${["bg-[#5c8c68]", "bg-[#d58e61]", "bg-[#53647f]", "bg-[#8c7296]"][index]}`}>
                  {item}
                </span>
              ))}
            </div>
            <p className="text-sm text-[#69756d]"><strong className="text-[#17231d]">Komunitas aktif</strong> main tiap minggu</p>
          </div>
        </div>

        <div className="relative min-h-[310px] overflow-hidden rounded-[30px] bg-[#193b2b] p-5 text-white sm:min-h-[410px] sm:p-8">
          <div className="hero-photo-track absolute inset-0 flex" aria-hidden="true">
            {[...heroPhotos, ...heroPhotos].map((photo, index) => (
              <div
                key={`${photo}-${index}`}
                className="hero-photo h-full"
                style={{ backgroundImage: `url("${photo}")` }}
              />
            ))}
          </div>
          <div className="absolute inset-0 bg-gradient-to-br from-[#10281f]/75 via-[#193b2b]/45 to-[#10281f]/80" />
          <div className="court-grid court-lines absolute inset-0 opacity-40" />
          <div className="absolute -right-10 -top-20 h-56 w-56 rounded-full bg-[#b7f36b]/10 blur-2xl" />
          <div className="relative z-10 flex h-full min-h-[270px] flex-col justify-between sm:min-h-[345px]">
            <div className="flex items-start justify-between">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-wide">BOOK YOUR GAME</span>
              <span className="text-2xl">↗</span>
            </div>
            <div>
              <div className="mb-3 text-5xl sm:text-6xl">🏃🏻‍♂️</div>
              <p className="text-xs font-bold uppercase tracking-[.2em] text-[#b7f36b]">Your next match</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Starts right here.</h2>
            </div>
            <div className="flex items-center justify-between border-t border-white/20 pt-4 text-sm">
              <span className="text-white/70">Pilih jadwal. Ajak teman. Gas.</span>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#b7f36b] text-lg text-[#193b2b]">↗</span>
            </div>
          </div>
        </div>
      </section>

      <section id="booking" className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mb-9 flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[.18em] text-[#77906e]">Booking mudah</p>
              <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Atur permainanmu.</h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-[#77827a]">Pilih olahraga, tentukan jadwal, dan kirim permintaan reservasi. Pengelola akan mengonfirmasinya.</p>
          </div>

          <div className="grid gap-7 lg:grid-cols-[1.2fr_.8fr]">
            <section className="rounded-3xl border border-[#e7ebe4] bg-[#fbfcfa] p-5 sm:p-7">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">01 <span className="ml-2 text-[#17231d]">Pilih olahraga</span></h3>
                <span className="text-xs font-semibold text-[#9aa39c]">LANGKAH 1/3</span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3">
                {sports.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => {
                      setSport(item.name);
                      setSelectedCourt(courts.find((court) => court.sport === item.name)?.id ?? null);
                      setSelectedSlot("");
                      setMessage("");
                    }}
                    className={`rounded-2xl border p-4 text-left transition ${sport === item.name ? "border-[#31583c] bg-[#eaf4e5] ring-1 ring-[#31583c]" : "border-[#e8ece6] bg-white hover:border-[#aab8a7]"}`}
                  >
                    <span className="text-2xl">{item.icon}</span>
                    <span className="mt-3 block text-sm font-bold">{item.name}</span>
                    <span className="mt-1 hidden text-[11px] text-[#7e8981] sm:block">{item.tagline}</span>
                  </button>
                ))}
              </div>

              <div className="mt-8 flex items-center justify-between">
                <h3 className="text-lg font-bold">02 <span className="ml-2">Pilih lapangan</span></h3>
                {loadingCourts && <span className="text-xs text-[#8b968d]">Memuat...</span>}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {visibleCourts.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => { setSelectedCourt(item.id); setSelectedSlot(""); }}
                    className={`rounded-2xl border p-4 text-left transition ${selectedCourt === item.id ? "border-[#31583c] bg-white ring-1 ring-[#31583c]" : "border-[#e8ece6] bg-white hover:border-[#aab8a7]"}`}
                  >
                    <span className="flex items-start justify-between">
                      <span className={`grid h-10 w-10 place-items-center rounded-xl text-lg ${index % 2 ? "bg-[#f3eddf]" : "bg-[#eaf2e8]"}`}>{item.sport === "Futsal" ? "⚽" : item.sport === "Badminton" ? "🏸" : "🎾"}</span>
                      <span className="rounded-full bg-[#f2f5ef] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#6d7d6c]">Tersedia</span>
                    </span>
                    <span className="mt-3 block text-sm font-bold">{item.name}</span>
                    <span className="mt-1 block text-xs text-[#7b867e]">{item.description}</span>
                    <span className="mt-3 block text-xs font-semibold text-[#405847]">Mulai {rupiah(item.price_off_peak)} / jam</span>
                  </button>
                ))}
                {courtLoadError && (
                  <p role="status" className="col-span-full rounded-xl bg-[#fff7e8] p-4 text-sm text-[#86612d]">{courtLoadError}</p>
                )}
                {!loadingCourts && visibleCourts.length === 0 && (
                  <p className="col-span-full rounded-xl bg-[#f5f7f2] p-4 text-sm text-[#6e7a72]">Belum ada lapangan untuk olahraga ini.</p>
                )}
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-bold">03 <span className="ml-2">Pilih tanggal & jam</span></h3>
                <label className="flex items-center gap-2 rounded-xl border border-[#e5e9e2] bg-white px-3 py-2 text-sm">
                  <span aria-hidden="true">▦</span>
                  <input aria-label="Tanggal booking" type="date" min={minimumDate} value={date} onChange={(event) => { setDate(event.target.value); setSelectedSlot(""); }} className="max-w-[145px] bg-transparent text-sm outline-none" />
                </label>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {slots.map((slot) => {
                  const blocked = isReserved(slot.start) || (today && slot.start <= new Date().toTimeString().slice(0, 5));
                  return (
                    <button
                      key={slot.start}
                      type="button"
                      disabled={blocked || loadingSlots}
                      onClick={() => setSelectedSlot(slot.start)}
                      className={`min-w-[78px] rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${blocked ? "cursor-not-allowed border-[#eff1ed] bg-[#f4f5f2] text-[#b0b7b1] line-through" : selectedSlot === slot.start ? "border-[#31583c] bg-[#1c3e2d] text-white" : "border-[#e8ece6] bg-white hover:border-[#85a17e]"}`}
                    >
                      {slot.start}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-[#818c84]">
                <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-white ring-1 ring-[#dce2da]" />Tersedia</span>
                <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-[#1c3e2d]" />Pilihanmu</span>
                <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-[#e9ece7]" />Tidak tersedia</span>
                <span className="font-semibold text-[#ac8151]">Peak hour: 17.00–21.00</span>
              </div>
            </section>

            <aside className="h-fit rounded-3xl bg-[#193b2b] p-5 text-white soft-shadow sm:p-7">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Detail reservasi</h3>
                <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold tracking-wider text-[#c8e9ae]">RINGKASAN</span>
              </div>
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[.06] p-4">
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="text-xs text-white/55">Lapangan</p>
                    <p className="mt-1 font-semibold">{court?.name ?? "Pilih lapangan"}</p>
                  </div>
                  <span className="text-2xl">{sport === "Futsal" ? "⚽" : sport === "Badminton" ? "🏸" : "🎾"}</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
                  <div><p className="text-xs text-white/55">Tanggal</p><p className="mt-1 text-sm font-semibold">{new Date(`${date}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</p></div>
                  <div><p className="text-xs text-white/55">Waktu</p><p className="mt-1 text-sm font-semibold">{chosenSlot ? `${chosenSlot.start} – ${chosenSlot.end}` : "Pilih jam"}</p></div>
                </div>
              </div>
              {chosenSlot && <div className="mt-4 flex items-center justify-between text-sm"><span className="text-white/65">{isPeak ? "Peak hour" : "Off-peak"} · 1 jam</span><strong>{rupiah(price)}</strong></div>}
              <div className="mt-5 border-t border-white/15 pt-4">
                <p className="mb-3 text-sm font-bold">Data pemesan</p>
                <form onSubmit={submitBooking} className="space-y-3">
                  <input required name="name" minLength={2} maxLength={120} placeholder="Nama lengkap" className="w-full rounded-xl border border-white/10 bg-white/[.08] px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#b7f36b]" />
                  <input required name="phone" type="tel" minLength={8} maxLength={32} placeholder="Nomor WhatsApp" className="w-full rounded-xl border border-white/10 bg-white/[.08] px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#b7f36b]" />
                  <input name="email" type="email" maxLength={190} placeholder="Email (opsional)" className="w-full rounded-xl border border-white/10 bg-white/[.08] px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#b7f36b]" />
                  <textarea name="notes" maxLength={500} rows={2} placeholder="Catatan tambahan (opsional)" className="w-full resize-none rounded-xl border border-white/10 bg-white/[.08] px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#b7f36b]" />
                  {message && <p role="status" className={`rounded-lg px-3 py-2 text-xs leading-5 ${isError ? "bg-[#6a3933] text-[#ffe0d8]" : "bg-[#d9f6c2] text-[#23432c]"}`}>{message}</p>}
                  <button type="submit" disabled={submitting || !court || !chosenSlot} className="flex w-full items-center justify-between rounded-xl bg-[#b7f36b] px-4 py-3.5 text-sm font-extrabold text-[#193b2b] transition hover:bg-[#c7f88b] disabled:cursor-not-allowed disabled:opacity-50">
                    <span>{submitting ? "Mengirim..." : "Kirim permintaan"}</span><span className="text-lg">↗</span>
                  </button>
                </form>
                <p className="mt-3 text-center text-[10px] leading-4 text-white/45">Reservasi berstatus menunggu sampai dikonfirmasi pengelola.</p>
              </div>
            </aside>
          </div>
        </div>
      </section>
      <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-7 text-xs text-[#7b867e] sm:px-8">
        <span>© {new Date().getFullYear()} GlenSport. Mainnya jadi lebih gampang.</span>
        <span>Jam operasional 07.00 – 22.00</span>
      </footer>
    </main>
  );
}
