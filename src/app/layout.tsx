import type { Metadata } from "next";
import { Inter, Playfair_Display, Parisienne } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const parisienne = Parisienne({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-parisienne",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Diana's OS — Luxury With a Pulse",
  description:
    "Diana's whole business on one screen — how she's doing, who to call, and what needs attention.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} ${parisienne.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
