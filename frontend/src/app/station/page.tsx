"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, formatDateTime, formatTime } from "@/lib/api";
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
    <div className="space-y-4">
      {/* Top Navigation & Station Selection Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center text-xs font-semibold text-[#66717A] hover:text-[#172026] transition-colors"
        >
          &larr; Back to Control Room
        </Link>

        <div className="flex items-center space-x-2">
          <Link
            href="/passenger"
            className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-md border border-[#D9DEE3] bg-[#FFFFFF] hover:bg-[#F0F3F5] text-[#172026] shadow-2xs transition-colors"
          >
            Passenger Lookup &rarr;
          </Link>
          <button
            type="button"
            onClick={() => fetchArrivals(stationCode, windowHours)}
            disabled={loading || refreshing}
            className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-md bg-[#172026] hover:bg-[#2563A8] text-white shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            <span className={`mr-1.5 ${refreshing ? "animate-spin" : ""}`}>
              ↻
            </span>
            {refreshing ? "Refreshing..." : "Refresh Board"}
          </button>
        </div>
      </div>

      {/* Station Selector Bar */}
      <div className="bg-[#FFFFFF] p-3.5 sm:p-4 rounded-lg border border-[#D9DEE3] shadow-2xs space-y-3">
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-2.5">
          <div className="flex-1 w-full">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#66717A] mb-1">
              Station Code
            </label>
            <div className="relative">
              <input
                type="text"
                value={stationCode}
                onChange={(e) => setStationCode(e.target.value.toUpperCase())}
                placeholder="e.g. CNB, PRYJ, NDLS"
                maxLength={8}
                className="w-full px-3 py-1.5 text-xs font-mono font-bold uppercase bg-[#F8FAFB] border border-[#D9DEE3] rounded-md focus:bg-[#FFFFFF] focus:border-[#2563A8] focus:outline-none"
              />
            </div>
          </div>

          <div className="w-full sm:w-44">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#66717A] mb-1">
              Lookahead Window
            </label>
            <select
              value={windowHours || 24}
              onChange={(e) => setWindowHours(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 text-xs bg-[#F8FAFB] border border-[#D9DEE3] rounded-md focus:bg-[#FFFFFF] focus:border-[#2563A8] focus:outline-none"
            >
              <option value={2}>Next 2 Hours</option>
              <option value={4}>Next 4 Hours</option>
              <option value={8}>Next 8 Hours</option>
              <option value={24}>Next 24 Hours</option>
            </select>
          </div>

          <div className="w-full sm:w-auto self-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-4 py-1.5 bg-[#172026] hover:bg-[#2563A8] text-white font-semibold text-xs rounded-md shadow-2xs transition-colors cursor-pointer"
            >
              {loading ? "Loading..." : "Load Board"}
            </button>
          </div>
        </form>

        {/* Quick Station Select Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#D9DEE3]/70">
          <span className="text-[10px] text-[#8A949C] uppercase font-bold mr-1">
            Major Junctions:
          </span>
          {majorStations.map((stn) => {
            const isSelected = stationCode === stn.code;
            return (
              <button
                key={stn.code}
                type="button"
                onClick={() => {
                  setStationCode(stn.code);
                  fetchArrivals(stn.code, windowHours);
                }}
                className={`px-2 py-0.5 rounded text-xs font-mono transition-all ${
                  isSelected
                    ? "bg-[#172026] text-white border border-[#172026] font-bold shadow-2xs"
                    : "bg-[#F0F3F5] hover:bg-[#E2E8F0] text-[#66717A] border border-[#D9DEE3]"
                }`}
                title={stn.name}
              >
                {stn.code}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-[#D64545] rounded-lg text-xs space-y-1">
          <div className="font-bold">Error Loading Station Arrivals</div>
          <div>{error}</div>
        </div>
      )}

      {/* Main Station Board Card */}
      <div className="bg-[#FFFFFF] border border-[#D9DEE3] rounded-lg shadow-2xs overflow-hidden">
        {/* Board Header Bar */}
        <div className="p-4 border-b border-[#D9DEE3] bg-[#FFFFFF] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="px-2.5 py-1 rounded bg-[#172026] text-white font-mono font-bold text-sm tracking-wider">
              {stationCode}
            </div>
            <div>
              <h1 className="text-base font-bold text-[#172026]">
                {data?.station_name ? `${data.station_name} Arrivals` : `${stationCode} Station Arrivals`}
              </h1>
              <p className="text-xs text-[#66717A] mt-0.5">
                Dynamic arrival forecasts powered by machine learning.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4 self-start sm:self-auto">
            <div className="text-right">
              <div className="text-[9px] text-[#8A949C] uppercase tracking-wider font-bold">
                Station Time (IST)
              </div>
              <div className="text-sm font-bold text-[#172026] font-mono">
                {clockTime || "--:--:--"}
              </div>
            </div>

            <div className="pl-3 border-l border-[#D9DEE3] text-right">
              <div className="text-[9px] text-[#8A949C] uppercase tracking-wider font-bold">
                Approaching
              </div>
              <div className="text-sm font-bold text-[#2563A8] font-mono">
                {data?.total_arrivals ?? 0} trains
              </div>
            </div>
          </div>
        </div>

        {/* Board Sub-header / Status Bar */}
        <div className="px-4 py-2 bg-[#F8FAFB] border-b border-[#D9DEE3] flex flex-wrap items-center justify-between text-xs text-[#66717A]">
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#168A55] animate-pulse" />
            <span className="font-semibold text-[#168A55]">
              XGBoost Real-Time Dynamic Forecasting Active
            </span>
          </div>
          <div className="font-mono text-[11px] text-[#8A949C]">
            Observed: {formatTime(data?.current_timestamp)} &bull; Window: {windowHours ? `${windowHours}h` : "ALL"}
          </div>
        </div>

        {/* Board Arrivals Content */}
        {loading && !data ? (
          <div className="p-12 text-center text-[#66717A] space-y-1">
            <div className="text-2xl animate-spin">↻</div>
            <div className="text-xs font-semibold uppercase tracking-wider">
              Synchronizing Station Arrivals Board...
            </div>
          </div>
        ) : !data || data.arrivals.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <div className="text-2xl text-[#8A949C] font-mono">---</div>
            <div className="text-sm font-bold text-[#172026] uppercase">
              No trains currently approaching within window
            </div>
            <p className="text-xs text-[#66717A] max-w-md mx-auto">
              No active trains were found approaching station <strong>{stationCode}</strong> in the {windowHours || 24}-hour window. Try expanding the lookahead window or selecting another station.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs sm:text-[13px]">
              <thead>
                <tr className="bg-[#FFFFFF] text-[#66717A] text-[11px] font-semibold uppercase tracking-wider border-b border-[#D9DEE3]">
                  <th className="px-3.5 py-2.5">Train</th>
                  <th className="px-3.5 py-2.5">Origin</th>
                  <th className="px-3.5 py-2.5">Destination</th>
                  <th className="px-3.5 py-2.5">Scheduled</th>
                  <th className="px-3.5 py-2.5 min-w-[230px]">
                    Expected (ML) & Uncertainty
                  </th>
                  <th className="px-3.5 py-2.5">In</th>
                  <th className="px-3.5 py-2.5 text-center">Delay / Status</th>
                  <th className="px-3.5 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D9DEE3]/70 bg-[#FFFFFF]">
                {data.arrivals.map((item: StationArrivalItem) => {
                  const delayMin = item.current_delay_minutes ?? 0;
                  const isDelayed = delayMin > 1.0;

                  return (
                    <tr
                      key={item.train_id}
                      className="hover:bg-[#F8FAFB] transition-colors"
                    >
                      {/* 1. Train Number & Name */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono text-xs sm:text-[13px] font-bold text-[#172026]">
                            {item.train_number}
                          </span>
                          <span className="px-1 py-0.2 rounded text-[9px] font-mono font-medium bg-[#F0F3F5] text-[#66717A] border border-[#D9DEE3] uppercase">
                            {item.train_type}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#66717A] truncate max-w-[180px]">
                          {item.train_name}
                        </div>
                      </td>

                      {/* 2. Origin */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap text-xs font-mono font-medium text-[#66717A]">
                        {item.origin_station_code || "--"}
                      </td>

                      {/* 3. Destination */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <div className="font-mono font-bold text-xs text-[#172026]">
                          {item.destination_station_code || "--"}
                        </div>
                        <div className="text-[10px] text-[#8A949C]">
                          {item.segments_ahead} stop(s) ahead
                        </div>
                      </td>

                      {/* 4. Scheduled ETA */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <div className="font-mono text-xs text-[#66717A] font-semibold">
                          {formatTime(item.scheduled_eta)}
                        </div>
                      </td>

                      {/* 5. Expected (ML) & Uncertainty */}
                      <td className="px-3.5 py-2.5">
                        <UncertaintyRangeBar
                          mlEta={item.ml_eta || item.baseline_eta}
                          lowerBound={item.confidence_lower}
                          upperBound={item.confidence_upper}
                          marginMinutes={item.confidence_range?.margin_minutes}
                          segmentsAhead={item.segments_ahead}
                          variant="table"
                          theme="light"
                        />
                      </td>

                      {/* 6. Minutes to Arrival */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap font-mono">
                        <div className="font-bold text-xs text-[#172026]">
                          {item.minutes_to_arrival !== undefined &&
                          item.minutes_to_arrival !== null
                            ? `${item.minutes_to_arrival.toFixed(0)} min`
                            : "--"}
                        </div>
                        <div className="text-[10px] text-[#8A949C]">
                          {(item.distance_to_go_km ?? 0).toFixed(0)} km away
                        </div>
                      </td>

                      {/* 7. Delay Status */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap text-center">
                        {isDelayed ? (
                          <div className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#FDF2F2] text-[#D64545] border border-[#F5C2C2]">
                            +{delayMin.toFixed(0)} MIN
                          </div>
                        ) : (
                          <div className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#EBF7EE] text-[#168A55] border border-[#B4E2C1]">
                            ON TIME
                          </div>
                        )}
                        <div className="text-[10px] text-[#8A949C] mt-0.5">
                          At {item.current_station || "Origin"}
                        </div>
                      </td>

                      {/* 8. Action */}
                      <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                        <Link
                          href={`/trains/${item.train_number}`}
                          className="px-2 py-1 bg-[#F0F3F5] hover:bg-[#E2E8F0] border border-[#D9DEE3] text-[#172026] rounded text-[11px] font-semibold transition-colors"
                        >
                          Details &rarr;
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StationArrivalsBoardPage() {
  return (
    <Suspense
      fallback={
        <div className="py-16 text-center text-xs text-[#8A949C]">
          Loading Station Arrivals Board...
        </div>
      }
    >
      <StationArrivalsBoardContent />
    </Suspense>
  );
}
