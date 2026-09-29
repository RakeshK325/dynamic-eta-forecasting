"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function Navbar() {
  const pathname = usePathname();
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");
  const [apiVersion, setApiVersion] = useState<string>("");
  const [clockTime, setClockTime] = useState<string>("");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClockTime(
        now.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function checkHealth() {
      try {
        const res = await api.getHealth();
        if (isMounted) {
          setBackendStatus(res.status === "ok" ? "online" : "offline");
          setApiVersion(res.version || "0.1.0");
        }
      } catch {
        if (isMounted) {
          setBackendStatus("offline");
        }
      }
    }

    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const navItems = [
    { href: "/", label: "Control Room", shortLabel: "Control Room" },
    { href: "/passenger", label: "Passenger Lookup", shortLabel: "Passenger" },
    { href: "/station", label: "Station Board", shortLabel: "Station" },
    { href: "/model-performance", label: "Model Evaluation", shortLabel: "Metrics" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/90 bg-white/95 backdrop-blur-md shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 gap-3">
          {/* Logo & Operational System Tag */}
          <div className="flex items-center space-x-3 shrink-0">
            <Link href="/" className="flex items-center space-x-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-base shadow-xs group-hover:bg-blue-600 transition-colors">
                🚆
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-extrabold text-base sm:text-lg text-slate-900 tracking-tight">
                    Dynamic ETA
                  </span>
                  <span className="hidden sm:inline-block px-1.5 py-0.2 text-[10px] font-bold bg-blue-100 text-blue-800 rounded border border-blue-200 uppercase tracking-wider">
                    v{apiVersion || "1.0"}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-medium tracking-wider uppercase -mt-0.5 hidden sm:block">
                  Railway Operational Intelligence
                </div>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto py-1 scrollbar-none">
            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/" || pathname.startsWith("/trains")
                  : pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-150 ${
                    isActive
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
                  }`}
                >
                  <span className="sm:hidden">{item.shortLabel}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Status Block: Live Clock & Backend Telemetry */}
          <div className="hidden lg:flex items-center space-x-4 shrink-0 pl-2 border-l border-slate-200">
            {/* Real-time Clock */}
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                IST Clock
              </div>
              <div className="text-xs font-mono font-bold text-slate-800 tracking-tight">
                {clockTime || "--:--:--"}
              </div>
            </div>

            {/* Backend Status Dot */}
            <div className="flex items-center space-x-1.5 text-xs bg-slate-50 border border-slate-200 px-2 py-1 rounded-md">
              <span
                className={`w-2 h-2 rounded-full ${
                  backendStatus === "online"
                    ? "bg-emerald-500 animate-pulse"
                    : backendStatus === "checking"
                    ? "bg-amber-400"
                    : "bg-rose-500"
                }`}
              />
              <span className="text-slate-600 font-mono text-[11px] font-semibold">
                FastAPI:{" "}
                <span
                  className={
                    backendStatus === "online"
                      ? "text-emerald-700 font-bold"
                      : backendStatus === "checking"
                      ? "text-amber-700 font-bold"
                      : "text-rose-700 font-bold"
                  }
                >
                  {backendStatus.toUpperCase()}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
