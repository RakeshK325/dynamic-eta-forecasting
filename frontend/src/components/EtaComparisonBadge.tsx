"use client";

import { formatTime, formatDateTime } from "@/lib/api";

export type EtaType = "scheduled" | "baseline" | "ml";

interface EtaComparisonBadgeProps {
  type: EtaType;
  time: string | null | undefined;
  showDate?: boolean;
  uncertaintyMargin?: number | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * EtaComparisonBadge Component
 *
 * Implements strict, unambiguous visual distinction between the 3 ETA tiers:
 * 1. Scheduled ETA  -> Slate/Muted (Static published timetable)
 * 2. Baseline ETA   -> Amber/Warm Slate (Heuristic: speed & distance extrapolation)
 * 3. ML ETA         -> Indigo/Cobalt Blue (XGBoost chained ML prediction with uncertainty)
 */
export default function EtaComparisonBadge({
  type,
  time,
  showDate = false,
  uncertaintyMargin,
  size = "md",
  className = "",
}: EtaComparisonBadgeProps) {
  if (!time) {
    return <span className="text-slate-400 font-mono text-xs">--:--</span>;
  }

  const formattedTime = formatTime(time);
  const formattedDate = showDate ? formatDateTime(time).split(",")[0] : null;

  // Configurations for each ETA class
  const configs = {
    scheduled: {
      tag: "SCHED",
      fullName: "Timetable Schedule",
      color: "bg-slate-100 text-slate-700 border-slate-200",
      timeColor: "text-slate-700",
      tagColor: "bg-slate-200/80 text-slate-600 border-slate-300",
      icon: "🗓️",
    },
    baseline: {
      tag: "BASELINE",
      fullName: "Speed Heuristic",
      color: "bg-amber-50/60 text-amber-900 border-amber-200/80",
      timeColor: "text-amber-900 font-semibold",
      tagColor: "bg-amber-100 text-amber-800 border-amber-300/80",
      icon: "⏱️",
    },
    ml: {
      tag: "ML ETA",
      fullName: "XGBoost Forecast",
      color: "bg-blue-50 text-blue-900 border-blue-200/90 shadow-2xs",
      timeColor: "text-blue-700 font-bold",
      tagColor: "bg-blue-600 text-white font-bold",
      icon: "⚡",
    },
  };

  const cfg = configs[type];

  if (size === "sm") {
    return (
      <div className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded border text-xs ${cfg.color} ${className}`}>
        <span className={`px-1 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${cfg.tagColor}`}>
          {cfg.tag}
        </span>
        <span className={`font-mono text-xs ${cfg.timeColor}`}>{formattedTime}</span>
        {uncertaintyMargin !== undefined && uncertaintyMargin !== null && (
          <span className="text-[10px] text-blue-600 font-sans">(&plusmn;{uncertaintyMargin.toFixed(0)}m)</span>
        )}
      </div>
    );
  }

  if (size === "lg") {
    return (
      <div className={`p-3 rounded-xl border ${cfg.color} space-y-1.5 ${className}`}>
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="flex items-center space-x-1.5">
            <span>{cfg.icon}</span>
            <span className="uppercase tracking-wider">{cfg.fullName}</span>
          </span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.tagColor}`}>
            {cfg.tag}
          </span>
        </div>
        <div className={`text-2xl font-mono tracking-tight ${cfg.timeColor}`}>
          {formattedTime}
        </div>
        {formattedDate && (
          <div className="text-[11px] text-slate-500 font-sans">{formattedDate}</div>
        )}
        {uncertaintyMargin !== undefined && uncertaintyMargin !== null && (
          <div className="text-xs text-blue-700 font-medium">
            Uncertainty: &plusmn;{uncertaintyMargin.toFixed(1)} min
          </div>
        )}
      </div>
    );
  }

  // Default 'md' size
  return (
    <div className={`inline-block ${className}`}>
      <div className="flex items-center space-x-1.5">
        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider border ${cfg.tagColor}`}>
          {cfg.tag}
        </span>
        <span className={`font-mono text-sm ${cfg.timeColor}`}>{formattedTime}</span>
      </div>
      {formattedDate && (
        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{formattedDate}</div>
      )}
      {uncertaintyMargin !== undefined && uncertaintyMargin !== null && (
        <div className="text-[10px] text-blue-600 font-medium mt-0.5">
          &plusmn;{uncertaintyMargin.toFixed(0)}m window
        </div>
      )}
    </div>
  );
}
