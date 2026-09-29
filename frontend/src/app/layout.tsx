import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Dynamic ETA - Railway Operations Intelligence",
  description:
    "Real-time operational telemetry, baseline heuristic ETAs, and chained XGBoost forecasts for Indian Railways.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-[#F5F7F8] text-[#172026] antialiased selection:bg-blue-100 selection:text-blue-900">
        <Navbar />
        <main className="flex-1 max-w-[1560px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
          {children}
        </main>
        <footer className="border-t border-[#D9DEE3] bg-[#FFFFFF] py-3 text-center text-xs text-[#8A949C]">
          <p>
            Dynamic Train ETA Forecasting &bull; Railway Operations Intelligence &bull; Production Control Room Interface
          </p>
        </footer>
      </body>
    </html>
  );
}
