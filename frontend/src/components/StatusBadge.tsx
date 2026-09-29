"use client";

interface StatusBadgeProps {
  status: string | null | undefined;
  size?: "sm" | "md";
}

/**
 * StatusBadge Component
 *
 * Professional railway operational status badge with restrained micro-animation.
 */
export function StatusBadge({ status = "RUNNING", size = "md" }: StatusBadgeProps) {
  const normStatus = (status || "RUNNING").toUpperCase();

  const isRunning = normStatus === "RUNNING";
  const isHalted = normStatus === "HALTED";
  const isCompleted = normStatus === "COMPLETED";

  const paddingClass = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";

  if (isHalted) {
    return (
      <span
        className={`inline-flex items-center space-x-1.5 font-bold uppercase tracking-wider rounded-full bg-rose-50 text-rose-800 border border-rose-300 ${paddingClass}`}
      >
        <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
        <span>Halted</span>
      </span>
    );
  }

  if (isRunning) {
    return (
      <span
        className={`inline-flex items-center space-x-1.5 font-semibold uppercase tracking-wider rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 ${paddingClass}`}
      >
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>Running</span>
      </span>
    );
  }

  if (isCompleted) {
    return (
      <span
        className={`inline-flex items-center space-x-1.5 font-medium uppercase tracking-wider rounded-full bg-slate-100 text-slate-700 border border-slate-300 ${paddingClass}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        <span>Arrived</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center space-x-1.5 font-medium uppercase tracking-wider rounded-full bg-slate-100 text-slate-600 border border-slate-200 ${paddingClass}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
      <span>{normStatus}</span>
    </span>
  );
}

interface DataSourceBadgeProps {
  source?: string | null;
  mode?: string | null;
  isFallback?: boolean;
}

/**
 * DataSourceBadge Component
 *
 * Displays telemetry origin (Live Railway API vs Simulator Engine) with fallback indicator.
 */
export function DataSourceBadge({ source, mode, isFallback }: DataSourceBadgeProps) {
  const isLive = mode === "LIVE_API" || source === "external_api";

  if (isLive) {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200"
        title="Live telemetry from external RailRadar API"
      >
        <span>📡 LIVE</span>
        {isFallback && (
          <span className="ml-1 text-[9px] text-amber-600 font-bold" title="Fell back to simulator">
            (FB)
          </span>
        )}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200"
      title="Synthesized operational trajectory from backend physics simulator"
    >
      <span>SIMULATOR</span>
      {isFallback && (
        <span className="ml-1 text-[9px] text-amber-600 font-bold" title="Fell back to simulator">
          (FB)
        </span>
      )}
    </span>
  );
}
