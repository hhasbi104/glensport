import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GlenSport — Pesan Lapangan Olahraga",
  description: "Temukan dan pesan lapangan olahraga favoritmu dengan mudah.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
