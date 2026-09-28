import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Dynamic Train ETA Forecasting Engine",
  description:
    "Real-time machine learning and heuristic ETA forecasting system for Indian Railways routes.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans antialiased">
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
        <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
          <p>
            Dynamic Train ETA Forecasting MVP &bull; Synthetic Simulator & ML Evaluation Pipeline &bull; Backend Source of Truth: FastAPI on port 8000
          </p>
        </footer>
      </body>
    </html>
  );
}
