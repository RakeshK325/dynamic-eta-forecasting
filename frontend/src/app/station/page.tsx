"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, formatDateTime, formatTime, formatDelay } from "@/lib/api";
import { StationArrivalsResponse, StationArrivalItem } from "@/types/api";
import UncertaintyRangeBar from "@/components/UncertaintyRangeBar";

function StationArrivalsBoardContent() {
  const searchParams = useSearchParams();
  const initialStationParam = searchParams.get("code") || "CNB";

  const [stationCode, setStationCode] = useState<string>(initialStationParam.toUpperCase());
  const [windowHours, setWindowHours] = useState<number | undefined>(24);
  const [data, setData] = useState<StationArrivalsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Live Digital Station Clock
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

  // Fetch station arrivals from backend
  const fetchArrivals = useCallback(
    async (code: string, hours?: number, isSilent = false) => {
      if (!code.trim()) return;

      if (!isSilent) setLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        const cleanCode = code.trim().toUpperCase();
        const res = await api.getStationArrivals(cleanCode, hours);
        setData(res);
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Failed to load station arrivals";
        setError(msg);
        setData(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  // Initial load on mount or station change
  useEffect(() => {
    if (stationCode) {
      fetchArrivals(stationCode, windowHours);
    }
  }, [stationCode, windowHours, fetchArrivals]);

  // Periodic Auto-refresh every 10 seconds for live board feel
  useEffect(() => {
    const interval = setInterval(() => {
      if (stationCode) {
        fetchArrivals(stationCode, windowHours, true);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [stationCode, windowHours, fetchArrivals]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchArrivals(stationCode, windowHours);
  };

  const majorStations = [
    { code: "CNB", name: "Kanpur Central" },
    { code: "PRYJ", name: "Prayagraj Junction" },
    { code: "DDU", name: "Pt. DD Upadhyaya" },
    { code: "NDLS", name: "New Delhi" },
    { code: "GAYA", name: "Gaya Junction" },
    { code: "DHN", name: "Dhanbad Junction" },
    { code: "HWH", name: "Howrah Terminus" },
    { code: "KOTA", name: "Kota Junction" },
    { code: "MMCT", name: "Mumbai Central" },
    { code: "SBC", name: "KSR Bengaluru" },
  ];

  return (
    <div className="space-y-6">
      {/* Top Navigation & Station Selection Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          &larr; Back to Control Room Dashboard
        </Link>

        <div className="flex items-center space-x-2">
          <Link
            href="/passenger"
            className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition-colors"
          >
            Passenger Lookup &rarr;
          </Link>
          <button
            onClick={() => fetchArrivals(stationCode, windowHours)}
            disabled={loading || refreshing}
            className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-md bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-colors disabled:opacity-50"
          >
            <span className={`mr-1.5 ${refreshing ? "animate-spin" : ""}`}>
              🔄
            </span>
            {refreshing ? "Refreshing..." : "Refresh Board"}
          </button>
        </div>
      </div>

      {/* Station Selector Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Select or Enter Station Code
            </label>
            <div className="relative">
              <input
                type="text"
                value={stationCode}
                onChange={(e) => setStationCode(e.target.value.toUpperCase())}
                placeholder="e.g. CNB, PRYJ, DDU, NDLS"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm font-mono font-bold uppercase tracking-wider text-slate-900 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                required
              />
              <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">
                CODE
              </span>
            </div>
          </div>

          <div className="w-full sm:w-48">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Forecast Window
            </label>
            <select
              value={windowHours === undefined ? "" : String(windowHours)}
              onChange={(e) => {
                const val = e.target.value === "" ? undefined : Number(e.target.value);
                setWindowHours(val);
                fetchArrivals(stationCode, val);
              }}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm font-medium bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
            >
              <option value="2">Next 2 Hours</option>
              <option value="4">Next 4 Hours</option>
              <option value="8">Next 8 Hours</option>
              <option value="24">Next 24 Hours</option>
              <option value="">All Approaching Trains</option>
            </select>
          </div>

          <div className="w-full sm:w-auto self-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto py-2.5 px-6 rounded-lg text-sm font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 disabled:bg-slate-300 transition-colors shadow-xs"
            >
              {loading ? "Loading..." : "View Arrivals"}
            </button>
          </div>
        </form>

        {/* Quick Station Hub Pills */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-400 font-medium mr-1">Major Junctions:</span>
          {majorStations.map((st) => {
            const isSelected = stationCode === st.code;
            return (
              <button
                key={st.code}
                type="button"
                onClick={() => {
                  setStationCode(st.code);
                  fetchArrivals(st.code, windowHours);
                }}
                className={`px-2.5 py-1 rounded-md transition-all font-mono text-xs ${
                  isSelected
                    ? "bg-slate-900 text-amber-400 font-bold border border-amber-400/40 shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                }`}
              >
                {st.code}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs space-y-1">
          <strong className="block font-semibold">Error Loading Station Board</strong>
          <span className="font-mono">{error}</span>
          <p className="text-[11px] text-slate-500 pt-1">
            Check station code or ensure FastAPI backend is running on <code>http://localhost:8000</code>.
          </p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RAILWAY ARRIVALS DISPLAY BOARD (FIDS LED THEME)                           */}
      {/* ========================================================================= */}
      <div className="bg-[#070b14] border-4 border-slate-800 rounded-2xl shadow-2xl overflow-hidden font-mono">
        {/* Chassis Top Plate: Station Title, LED Clock & Live Indicator */}
        <div className="px-5 py-4 bg-linear-to-r from-slate-950 via-[#0a0f1d] to-slate-950 border-b-2 border-amber-500/30 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Station Title */}
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded bg-amber-400/10 border border-amber-400/30 text-amber-400 font-extrabold text-sm tracking-widest">
                  [{data?.station_code || stationCode}]
                </span>
                <h1 className="text-xl md:text-2xl font-black tracking-wider text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.35)] uppercase">
                  {data?.station_name || "STATION ARRIVALS"}
                </h1>
              </div>
              <div className="text-[11px] text-slate-400 tracking-wider uppercase mt-0.5">
                LIVE TRAIN ARRIVALS DISPLAY &bull; आगमन सूचना पट्ट
              </div>
            </div>
          </div>

          {/* Live Digital Station Clock */}
          <div className="flex items-center space-x-4 self-end md:self-auto">
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase tracking-widest">
                STATION TIME (IST)
              </div>
              <div className="text-2xl font-black text-emerald-400 font-mono tracking-widest drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]">
                {clockTime || "--:--:--"}
              </div>
            </div>

            <div className="pl-3 border-l border-slate-800 text-right">
              <div className="text-[10px] text-slate-400 uppercase tracking-widest">
                APPROACHING
              </div>
              <div className="text-xl font-black text-amber-400 font-mono">
                {data?.total_arrivals ?? 0}
              </div>
            </div>
          </div>
        </div>

        {/* Board Sub-header / Status Bar */}
        <div className="px-5 py-2 bg-slate-950/80 border-b border-slate-800/80 flex flex-wrap items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center space-x-2">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span className="text-amber-300 font-semibold tracking-wider uppercase">
              XGBoost Real-Time Dynamic Forecasting Active
            </span>
          </div>
          <div>
            Observation:{" "}
            <span className="text-slate-300 font-mono">
              {formatTime(data?.current_timestamp)}
            </span>{" "}
            &bull; Window:{" "}
            <span className="text-amber-400 font-semibold">
              {windowHours ? `${windowHours}h` : "ALL"}
            </span>
          </div>
        </div>

        {/* Board Arrivals Content */}
        {loading && !data ? (
          <div className="p-16 text-center text-amber-400 space-y-2">
            <div className="text-3xl animate-bounce">⏳</div>
            <div className="text-sm font-bold tracking-widest uppercase">
              SYNCHRONIZING STATION ARRIVALS BOARD...
            </div>
          </div>
        ) : !data || data.arrivals.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="text-4xl text-amber-500/40 font-mono">---</div>
            <div className="text-base font-bold text-amber-400 tracking-widest uppercase drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]">
              NO TRAINS CURRENTLY APPROACHING WITHIN WINDOW
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              No active train journeys were found moving toward station{" "}
              <strong className="text-slate-300">{stationCode}</strong> in the
              selected {windowHours || 24}-hour window. Try expanding the time
              window or selecting another station.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              {/* LED Table Header */}
              <thead>
                <tr className="bg-slate-950 text-slate-400 text-xs font-bold uppercase tracking-wider border-b-2 border-slate-800">
                  <th className="px-4 py-3 text-amber-400">Train</th>
                  <th className="px-4 py-3">Origin</th>
                  <th className="px-4 py-3 text-amber-400">Destination</th>
                  <th className="px-4 py-3">Scheduled ETA</th>
                  <th className="px-4 py-3 bg-amber-400/5 text-amber-300 font-black min-w-[240px]">
                    Predicted ETA & Uncertainty Window
                  </th>
                  <th className="px-4 py-3">In</th>
                  <th className="px-4 py-3 text-center">Delay / Status</th>
                  <th className="px-4 py-3 text-right">Details</th>
                </tr>
              </thead>

              {/* LED Table Rows */}
              <tbody className="divide-y divide-slate-800/80 text-sm">
                {data.arrivals.map((item: StationArrivalItem, idx: number) => {
                  const delayMin = item.current_delay_minutes ?? 0;
                  const isDelayed = delayMin > 1.0;
                  const isHeavyDelay = delayMin > 15.0;

                  // Alternating LED row backgrounds
                  const rowBg =
                    idx % 2 === 0
                      ? "bg-[#090e1a]/95 hover:bg-slate-800/40"
                      : "bg-[#0c1220]/95 hover:bg-slate-800/40";

                  return (
                    <tr
                      key={item.train_id}
                      className={`${rowBg} transition-colors group`}
                    >
                      {/* 1. Train Number & Name */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-base font-black text-amber-400 tracking-wider drop-shadow-[0_0_6px_rgba(251,191,36,0.35)]">
                            {item.train_number}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                            {item.train_type}
                          </span>
                        </div>
                        <div className="text-xs text-slate-300 font-semibold tracking-wide truncate max-w-[200px] mt-0.5">
                          {item.train_name}
                        </div>
                      </td>

                      {/* 2. Origin */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-400 font-semibold">
                        {item.origin_station_code || "--"}
                      </td>

                      {/* 3. Destination */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-bold text-sm text-slate-100 tracking-wide">
                          {item.destination_station_code || "--"}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {item.segments_ahead} stop(s) ahead
                        </div>
                      </td>

                      {/* 4. Scheduled ETA */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-mono text-sm text-slate-300 font-semibold flex items-center space-x-1.5">
                          <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                            SCHED
                          </span>
                          <span>{formatTime(item.scheduled_eta)}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {formatDateTime(item.scheduled_eta).split(",")[0]}
                        </div>
                      </td>

                      {/* 5. Predicted ETA (ML) & Uncertainty Window */}
                      <td className="px-4 py-3.5 whitespace-nowrap bg-amber-400/5 border-x border-amber-500/20">
                        <UncertaintyRangeBar
                          mlEta={item.ml_eta || item.baseline_eta}
                          lowerBound={item.confidence_lower}
                          upperBound={item.confidence_upper}
                          marginMinutes={item.confidence_range?.margin_minutes}
                          segmentsAhead={item.segments_ahead}
                          variant="table"
                          theme="dark"
                        />
                      </td>

                      {/* Minutes to Arrival */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-mono text-sm font-bold text-slate-200">
                          {item.minutes_to_arrival !== undefined &&
                          item.minutes_to_arrival !== null
                            ? `${item.minutes_to_arrival.toFixed(0)} min`
                            : "--"}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {(item.distance_to_go_km ?? 0).toFixed(0)} km away
                        </div>
                      </td>

                      {/* 6. Delay / Operational Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-center">
                        {isDelayed ? (
                          <div
                            className={`inline-block px-3 py-1 rounded text-xs font-black uppercase tracking-wider ${
                              isHeavyDelay
                                ? "bg-rose-500/20 text-rose-400 border border-rose-500/40 drop-shadow-[0_0_6px_rgba(244,63,94,0.4)]"
                                : "bg-amber-500/20 text-amber-400 border border-amber-500/40 drop-shadow-[0_0_6px_rgba(251,191,36,0.4)]"
                            }`}
                          >
                            +{delayMin.toFixed(0)} MIN DELAY
                          </div>
                        ) : (
                          <div className="inline-block px-3 py-1 rounded text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 drop-shadow-[0_0_6px_rgba(52,211,153,0.4)]">
                            ON TIME
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          At {item.current_station || "Origin"}
                        </div>
                      </td>

                      {/* Track Details Link */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-right">
                        <Link
                          href={`/trains/${encodeURIComponent(item.train_number)}`}
                          className="inline-block px-2.5 py-1 rounded text-xs font-bold text-amber-400 border border-amber-400/30 hover:bg-amber-400 hover:text-slate-900 transition-colors uppercase"
                        >
                          TRACK &rarr;
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Board Bottom Bezel */}
        <div className="px-5 py-2.5 bg-slate-950 border-t border-slate-800 text-[10px] text-slate-500 flex flex-wrap items-center justify-between">
          <div>
            INDIAN RAILWAYS FIDS &bull; DYNAMIC ETA FORECASTING ENGINE
          </div>
          <div className="font-mono text-slate-400">
            SHOWING {data?.arrivals?.length || 0} TRAIN(S)
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StationArrivalsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-16 text-center text-sm text-slate-500">
          Loading Station Arrivals Board...
        </div>
      }
    >
      <StationArrivalsBoardContent />
    </Suspense>
  );
}
