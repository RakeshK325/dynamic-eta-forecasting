"use client";

import { formatTime } from "@/lib/api";

interface UncertaintyRangeBarProps {
  mlEta: string | null | undefined;
  lowerBound: string | null | undefined;
  upperBound: string | null | undefined;
  marginMinutes?: number | null;
  segmentsAhead?: number | null;
  variant?: "table" | "card" | "inline";
  theme?: "light" | "dark";
  showHorizonLabel?: boolean;
}

/**
 * UncertaintyRangeBar Component
 *
 * Visually communicates prediction uncertainty window [Lower Bound | ML ETA | Upper Bound].
 * Accurately demonstrates how prediction uncertainty widens as lookahead horizon increases
 * (short-horizon predictions have narrower ranges; longer-horizon predictions have wider ranges).
 *
 * Explicitly labeled as heuristic prediction uncertainty, NOT a calibrated confidence interval.
 * Uses backend-provided bounds and margins as the source of truth.
 */
export default function UncertaintyRangeBar({
  mlEta,
  lowerBound,
  upperBound,
  marginMinutes,
  segmentsAhead = 1,
  variant = "table",
  theme = "light",
  showHorizonLabel = true,
}: UncertaintyRangeBarProps) {
  if (!mlEta) {
    return <span className={`text-xs font-mono ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}>--:--</span>;
  }

  const segs = Math.max(1, segmentsAhead || 1);
  const margin = marginMinutes ?? 5.0 * Math.sqrt(segs);

  // Proportional bar width representing the uncertainty window size
  // Segment 1 (5m margin) ~ 28% width, Segment 6 (12.2m margin) ~ 92% width
  const visualSpanPercent = Math.min(100, Math.max(28, 22 + segs * 12));

  // Horizon descriptive classification
  const horizonBadge =
    segs === 1
      ? {
          text: "Narrow Window (Next Stop)",
          lightColor: "text-emerald-700 bg-emerald-50 border-emerald-200",
          darkColor: "text-emerald-300 bg-emerald-950/60 border-emerald-800",
          barColor: "bg-emerald-500/80",
        }
      : segs <= 3
      ? {
          text: "Moderate Horizon",
          lightColor: "text-blue-700 bg-blue-50 border-blue-200",
          darkColor: "text-blue-300 bg-blue-950/60 border-blue-800",
          barColor: "bg-blue-500/80",
        }
      : {
          text: "Wide Window (Distant Horizon)",
          lightColor: "text-amber-800 bg-amber-50 border-amber-200",
          darkColor: "text-amber-300 bg-amber-950/60 border-amber-800",
          barColor: "bg-amber-500/80",
        };

  const lowerTime = lowerBound ? formatTime(lowerBound) : "--:--";
  const mlTime = formatTime(mlEta);
  const upperTime = upperBound ? formatTime(upperBound) : "--:--";

  // ---------------------------------------------------------------------------
  // VARIANT: CARD (Featured box in Passenger View and Highlights)
  // ---------------------------------------------------------------------------
  if (variant === "card") {
    return (
      <div className="bg-linear-to-b from-blue-500/10 via-slate-50 to-indigo-50/50 p-4 sm:p-5 rounded-2xl border-2 border-blue-500/30 space-y-4">
        {/* Header with Uncertainty Disclaimer */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 pb-1 border-b border-blue-200/50">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center space-x-1.5">
              <span>🎯</span>
              <span>Expected Arrival Window</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Prediction uncertainty range &bull; Widens with lookahead distance
            </p>
          </div>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${horizonBadge.lightColor}`}>
            {horizonBadge.text} (&plusmn;{margin.toFixed(1)}m)
          </span>
        </div>

        {/* 3 Prominent Arrival Timestamps */}
        <div className="grid grid-cols-3 gap-2 text-center pt-1">
          {/* Lower Bound */}
          <div className="p-2.5 bg-white/90 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Lower Bound
            </div>
            <div className="text-sm sm:text-base font-bold font-mono text-slate-700 mt-0.5">
              {lowerTime}
            </div>
            <div className="text-[9px] text-slate-400">Earliest expected</div>
          </div>

          {/* ML ETA (Highlighted Center) */}
          <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs ring-2 ring-blue-300 transform sm:scale-105 transition-transform">
            <div className="text-[10px] font-bold uppercase tracking-wider text-blue-100 flex items-center justify-center space-x-1">
              <span>★</span>
              <span>ML ETA</span>
            </div>
            <div className="text-base sm:text-xl font-extrabold font-mono text-white mt-0.5 tracking-tight">
              {mlTime}
            </div>
            <div className="text-[9px] text-blue-100">Most probable</div>
          </div>

          {/* Upper Bound */}
          <div className="p-2.5 bg-white/90 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Upper Bound
            </div>
            <div className="text-sm sm:text-base font-bold font-mono text-slate-700 mt-0.5">
              {upperTime}
            </div>
            <div className="text-[9px] text-slate-400">Latest expected</div>
          </div>
        </div>

        {/* Visual Uncertainty Range Track */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between text-[11px] font-mono text-slate-500">
            <span>&larr; Lower ({lowerTime})</span>
            <span className="font-sans text-[10px] text-blue-700 font-semibold">
              Span: {(margin * 2).toFixed(0)} min uncertainty window
            </span>
            <span>Upper ({upperTime}) &rarr;</span>
          </div>

          {/* The Visual Horizon Bar */}
          <div className="relative w-full h-4 bg-slate-200/80 rounded-full flex items-center justify-center p-0.5 border border-slate-300/80">
            {/* Range Span Capsule (widens proportionally with segments ahead) */}
            <div
              className="h-full bg-linear-to-r from-blue-300 via-blue-500 to-indigo-400 rounded-full flex items-center justify-between px-1.5 transition-all duration-500 shadow-xs"
              style={{ width: `${visualSpanPercent}%` }}
              title={`Uncertainty window: ${lowerTime} to ${upperTime} (±${margin.toFixed(1)}m, ${segs} stop${segs > 1 ? "s" : ""} ahead)`}
            >
              {/* Left Bound Marker */}
              <div className="w-1.5 h-1.5 rounded-full bg-white ring-1 ring-blue-700" title={`Lower bound: ${lowerTime}`} />

              {/* Center ML ETA Pin */}
              <div className="w-2.5 h-2.5 rounded-full bg-white ring-2 ring-blue-900 shadow-sm" title={`ML ETA: ${mlTime}`} />

              {/* Right Bound Marker */}
              <div className="w-1.5 h-1.5 rounded-full bg-white ring-1 ring-blue-700" title={`Upper bound: ${upperTime}`} />
            </div>
          </div>

          {/* Clarification Disclaimer */}
          <div className="text-[10px] text-slate-400 text-center italic">
            * Uncalibrated heuristic prediction uncertainty window based on route distance and multi-station horizon.
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VARIANT: TABLE ROW (Compact, comparative representation for station tables)
  // ---------------------------------------------------------------------------
  const isDark = theme === "dark";

  return (
    <div className="space-y-1.5 py-0.5 min-w-[210px] max-w-[260px]">
      {/* 3 Explicit Numerical Timestamps */}
      <div className="flex items-center justify-between text-xs font-mono">
        <span
          className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}
          title={`Lower bound (earliest expected): ${lowerTime}`}
        >
          {lowerTime}
        </span>
        <span
          className={`font-bold px-1.5 py-0.2 rounded text-xs ${
            isDark
              ? "text-amber-300 bg-amber-400/10 border border-amber-400/30 drop-shadow-[0_0_6px_rgba(251,191,36,0.3)]"
              : "text-blue-700 bg-blue-50 border border-blue-200"
          }`}
          title={`ML ETA (most probable): ${mlTime}`}
        >
          {mlTime}
        </span>
        <span
          className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}
          title={`Upper bound (latest expected): ${upperTime}`}
        >
          {upperTime}
        </span>
      </div>

      {/* Visual Uncertainty Span Bar */}
      <div
        className={`relative w-full h-2 rounded-full flex items-center justify-center border overflow-hidden ${
          isDark
            ? "bg-slate-900 border-slate-700/80"
            : "bg-slate-100 border-slate-200"
        }`}
        title={`Prediction uncertainty range: ${lowerTime} to ${upperTime} (±${margin.toFixed(1)} min, ${segs} stop${segs > 1 ? "s" : ""} ahead)`}
      >
        {/* Dynamic Width Span (Widens as horizon increases) */}
        <div
          className={`h-full rounded-full transition-all duration-300 flex items-center justify-between px-0.5 ${
            isDark
              ? segs === 1
                ? "bg-emerald-500/80"
                : segs <= 3
                ? "bg-amber-500/80"
                : "bg-orange-500/80"
              : horizonBadge.barColor
          }`}
          style={{ width: `${visualSpanPercent}%` }}
        >
          {/* Left bracket */}
          <div className={`w-0.5 h-1.5 rounded-full ${isDark ? "bg-slate-950" : "bg-slate-700"}`} />
          {/* ML ETA Node */}
          <div className={`w-1.5 h-1.5 rounded-full ring-1 ${isDark ? "bg-amber-300 ring-black" : "bg-blue-900 ring-white"}`} />
          {/* Right bracket */}
          <div className={`w-0.5 h-1.5 rounded-full ${isDark ? "bg-slate-950" : "bg-slate-700"}`} />
        </div>
      </div>

      {/* Horizon Label & Margin */}
      {showHorizonLabel && (
        <div className="flex justify-between items-center text-[10px]">
          <span className={`font-mono ${isDark ? "text-slate-400" : "text-slate-600"}`}>
            &plusmn;{margin.toFixed(1)}m uncertainty
          </span>
          <span
            className={`px-1.5 py-0.2 text-[9px] font-semibold rounded border ${
              isDark ? horizonBadge.darkColor : horizonBadge.lightColor
            }`}
          >
            {segs === 1 ? "1 stop (narrow)" : `${segs} stops (${segs <= 3 ? "medium" : "wide"})`}
          </span>
        </div>
      )}
    </div>
  );
}
