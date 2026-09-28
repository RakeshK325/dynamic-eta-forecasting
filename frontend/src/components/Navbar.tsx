"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function Navbar() {
  const pathname = usePathname();
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");
  const [apiVersion, setApiVersion] = useState<string>("");

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
    { href: "/", label: "Control Room Dashboard" },
    { href: "/passenger", label: "Passenger ETA Lookup" },
    { href: "/station", label: "Station Arrivals Board" },
  ];

  return (
    <header className="border-b border-slate-200 bg-white shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Project Title */}
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-2xl">🚆</span>
              <div>
                <span className="font-bold text-lg text-slate-900 tracking-tight">
                  Dynamic ETA Engine
                </span>
                <span className="hidden sm:inline-block ml-2 px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 rounded">
                  MVP v{apiVersion || "0.1.0"}
                </span>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="flex space-x-1 sm:space-x-4">
            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/" || pathname.startsWith("/trains")
                  : pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Backend Status Badge */}
          <div className="hidden md:flex items-center space-x-2 text-xs">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full ${
                backendStatus === "online"
                  ? "bg-emerald-500 animate-pulse"
                  : backendStatus === "checking"
                  ? "bg-amber-400"
                  : "bg-rose-500"
              }`}
            />
            <span className="text-slate-500 font-mono">
              FastAPI:{" "}
              <strong
                className={
                  backendStatus === "online"
                    ? "text-emerald-700"
                    : backendStatus === "checking"
                    ? "text-amber-700"
                    : "text-rose-700"
                }
              >
                {backendStatus.toUpperCase()}
              </strong>
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
