"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [bypassLoading, setBypassLoading] = useState(false);
  const isDevelopment = process.env.NODE_ENV === "development";

  useEffect(() => {
    if (isDevelopment) return;
    let active = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const session = await response.json();
        if (active) router.replace(session.role === "admin" ? "/admin" : "/");
      })
      .catch((caught: unknown) => {
        console.error("Failed to check existing login session:", caught);
      });
    return () => {
      active = false;
    };
  }, [isDevelopment, router]);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Login gagal.");
      router.replace(data.redirectTo);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Login gagal. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  async function bypassAdmin() {
    setBypassLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/dev-login", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Auto-login admin gagal.");
      router.replace(data.redirectTo);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Auto-login admin gagal.");
    } finally {
      setBypassLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-[#f5f7f2] lg:grid-cols-[1fr_.9fr]">
      <section className="relative hidden overflow-hidden bg-[#193b2b] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="court-grid court-lines absolute inset-0 opacity-70" />
        <Link href="/" className="relative flex items-center gap-2 text-xl font-black">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#b7f36b] text-[#193b2b]">G</span>
          GlenSport.
        </Link>
        <div className="relative max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#b7f36b]">LET&apos;S PLAY</p>
          <h1 className="mt-4 text-6xl font-black leading-[1.05] tracking-tight">Masuk.<br />Atur permainan.</h1>
          <p className="mt-5 max-w-md text-base leading-7 text-white/65">Kelola reservasi lapangan atau lanjutkan rencana bermainmu.</p>
        </div>
        <p className="relative text-xs text-white/45">Futsal · Badminton · Tenis</p>
      </section>

      <section className="grid place-items-center px-5 py-12">
        <div className="w-full max-w-md rounded-3xl border border-[#e5eae2] bg-white p-7 soft-shadow sm:p-9">
          <Link href="/" className="text-sm font-bold text-[#55705c]">← Kembali ke GlenSport</Link>
          <div className="mt-8 grid h-12 w-12 place-items-center rounded-2xl bg-[#eaf4e5] text-xl">👋</div>
          <h2 className="mt-5 text-2xl font-black tracking-tight">Selamat datang</h2>
          <p className="mt-2 text-sm leading-6 text-[#768179]">Masuk dengan akun yang terdaftar untuk melanjutkan.</p>

          <form onSubmit={submitLogin} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#657168]">Email</label>
              <input id="email" type="email" autoComplete="email" required maxLength={190} value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-[#e0e6de] px-4 py-3 text-sm outline-none transition focus:border-[#62865a] focus:ring-2 focus:ring-[#eaf4e5]" placeholder="nama@email.com" />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#657168]">Password</label>
              <input id="password" type="password" autoComplete="current-password" required maxLength={256} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-[#e0e6de] px-4 py-3 text-sm outline-none transition focus:border-[#62865a] focus:ring-2 focus:ring-[#eaf4e5]" placeholder="Masukkan password" />
            </div>
            {error && <p role="alert" className="rounded-lg bg-[#fff1ee] px-3 py-2 text-sm text-[#a94332]">{error}</p>}
            <button type="submit" disabled={loading} className="flex w-full items-center justify-between rounded-xl bg-[#1c3e2d] px-4 py-3.5 text-sm font-bold text-white transition hover:bg-[#2e5940] disabled:opacity-60">
              <span>{loading ? "Memeriksa akun..." : "Login"}</span><span>↗</span>
            </button>
          </form>

          {isDevelopment && (
            <div className="mt-5 border-t border-[#edf0eb] pt-5">
              <p className="mb-3 text-xs leading-5 text-[#78837b]">Mode development/UAS: masuk dashboard tanpa akun database.</p>
              <button type="button" onClick={() => void bypassAdmin()} disabled={bypassLoading} className="w-full rounded-xl border border-[#dfe8d8] bg-[#f4f9ef] px-4 py-3 text-sm font-bold text-[#31583c] hover:bg-[#eaf4e5] disabled:opacity-60">
                {bypassLoading ? "Membuka dashboard..." : "Masuk langsung sebagai admin"}
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
