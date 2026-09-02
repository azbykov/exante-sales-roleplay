import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import "./globals.css";

/** The font from the design. */
const instrument = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-instrument",
});

export const metadata: Metadata = {
  title: "EXANTE — Sales Simulator",
  description: "Role-play practice with a client, and a debrief at the end",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={instrument.variable}>
      <body>{children}</body>
    </html>
  );
}
