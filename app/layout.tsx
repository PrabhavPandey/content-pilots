import type { Metadata } from "next";
import { Poppins, Roboto, Inconsolata, Playfair_Display } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-roboto",
});

const inconsolata = Inconsolata({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inconsolata",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
});

export const metadata: Metadata = {
  title: "TAL Pilot Tracker",
  description: "UGC & Influencer Marketing Pilot Dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className={`${poppins.variable} ${roboto.variable} ${inconsolata.variable} ${playfair.variable} min-h-full`}
        style={{ fontFamily: "var(--font-roboto), sans-serif", background: "var(--bg-page)", color: "var(--text-primary)" }}>
        {children}
      </body>
    </html>
  );
}
