"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { api, formatDateTime, formatTime, formatDelay } from "@/lib/api";
import {
  TrainDetailResponse,
  RouteStationInfo,
  UpcomingStationETA,
  EventDetails,
  EventInjectionResponse,
} from "@/types/api";

interface PageProps {
  params: Promise<{ id: string }>;
}

// Sparkline Visualization for Delay Trend
function DelayTrendSparkline({
  history,
  trend,
  width = 120,
  height = 34,
}: {
  history: number[];
  trend: number;
  width?: number;
  height?: number;
}) {
  const dataPoints = history && history.length > 0 ? history : [0];
  const minVal = Math.min(...dataPoints);
  const maxVal = Math.max(...dataPoints);
  const range = maxVal - minVal > 0 ? maxVal - minVal : 1;

  const points = dataPoints
    .map((val, idx) => {
      const x =
        dataPoints.length > 1
          ? (idx / (dataPoints.length - 1)) * (width - 12) + 6
          : width / 2;
      const y = height - 6 - ((val - minVal) / range) * (height - 12);
      return `${x},${y}`;
    })
    .join(" ");

  const strokeColor =
    trend > 0 ? "#e11d48" : trend < 0 ? "#059669" : "#64748b";

  return (
    <div className="flex items-center space-x-2">
      <svg
        width={width}
        height={height}
        className="overflow-visible bg-slate-50 border border-slate-200 rounded px-1"
      >
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
        {dataPoints.map((val, idx) => {
          const x =
            dataPoints.length > 1
              ? (idx / (dataPoints.length - 1)) * (width - 12) + 6
              : width / 2;
          const y = height - 6 - ((val - minVal) / range) * (height - 12);
          return (
            <circle
              key={idx}
              cx={x}
              cy={y}
              r={idx === dataPoints.length - 1 ? 3.5 : 1.5}
              fill={strokeColor}
            />
          );
        })}
      </svg>
      <div className="text-xs font-mono whitespace-nowrap">
        {trend > 0 ? (
          <span className="text-rose-700 font-semibold" title="Delay accumulating (+min/checkpoint)">
            ↗ +{trend.toFixed(1)}m
          </span>
        ) : trend < 0 ? (
          <span className="text-emerald-700 font-semibold" title="Recovering time (-min/checkpoint)">
            ↘ {trend.toFixed(1)}m
          </span>
        ) : (
          <span className="text-slate-500 font-medium" title="Delay stable">
            → 0.0m
          </span>
        )}
      </div>
    </div>
  );
}

// Route Progress Bar Component
function RouteProgressBar({
  routeStations,
  currentStationCode,
  nextStationCode,
  segmentProgress = 0,
}: {
  routeStations: RouteStationInfo[];
  currentStationCode: string | null;
  nextStationCode: string | null;
  segmentProgress?: number;
}) {
  if (!routeStations || routeStations.length === 0) return null;

  const currentIdx = routeStations.findIndex(
    (s) => s.station_code === currentStationCode
  );
  const effectiveCurrentIdx = currentIdx >= 0 ? currentIdx : 0;
  const totalStops = routeStations.length;

  const totalDistance =
    routeStations[totalStops - 1]?.distance_from_source_km || 1;
  const currentStnDist =
    routeStations[effectiveCurrentIdx]?.distance_from_source_km || 0;
  const nextStnDist =
    effectiveCurrentIdx < totalStops - 1
      ? routeStations[effectiveCurrentIdx + 1]?.distance_from_source_km
      : currentStnDist;

  const estimatedCurrentKm =
    currentStnDist + (nextStnDist - currentStnDist) * (segmentProgress || 0);
  const progressPercent = Math.min(
    100,
    Math.max(0, (estimatedCurrentKm / totalDistance) * 100)
  );

  return (
    <div className="space-y-4">
      {/* Top progress metrics */}
      <div className="flex items-center justify-between text-xs text-slate-600">
        <div>
          <span className="font-semibold text-slate-800">
            {routeStations[0].station_code}
          </span>{" "}
          &rarr;{" "}
          <span className="font-semibold text-slate-800">
            {routeStations[totalStops - 1].station_code}
          </span>{" "}
          <span className="text-slate-400">({totalDistance.toFixed(0)} km total)</span>
        </div>
        <div className="font-mono font-medium text-blue-700">
          {progressPercent.toFixed(1)}% Completed ({estimatedCurrentKm.toFixed(0)} km)
        </div>
      </div>

      {/* Progress Track Bar */}
      <div className="relative w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
        <div
          className="h-full bg-linear-to-r from-blue-600 to-indigo-600 transition-all duration-500 rounded-full"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Route Stops Step Nodes */}
      <div className="overflow-x-auto pb-2">
        <div className="flex items-start justify-between min-w-[560px] gap-2 pt-1">
          {routeStations.map((stn, idx) => {
            const isPassed = idx < effectiveCurrentIdx;
            const isCurrent = idx === effectiveCurrentIdx;
            const isNext =
              nextStationCode && stn.station_code === nextStationCode;

            return (
              <div
                key={stn.sequence}
                className="flex-1 flex flex-col items-center text-center relative group"
              >
                {/* Node icon */}
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                    isCurrent
                      ? "bg-blue-600 text-white ring-4 ring-blue-100 shadow-sm"
                      : isPassed
                      ? "bg-emerald-500 text-white"
                      : isNext
                      ? "bg-amber-500 text-white ring-2 ring-amber-100"
                      : "bg-slate-200 text-slate-600 border border-slate-300"
                  }`}
                >
                  {isPassed ? "✓" : stn.sequence}
                </div>

                {/* Station code */}
                <div
                  className={`mt-1.5 text-xs font-bold ${
                    isCurrent
                      ? "text-blue-700 underline underline-offset-2"
                      : isPassed
                      ? "text-slate-700"
                      : "text-slate-500"
                  }`}
                >
                  {stn.station_code}
                </div>

                {/* Station name snippet */}
                <div className="text-[10px] text-slate-400 truncate max-w-[80px]">
                  {stn.station_name}
                </div>

                {/* Distance & Scheduled Arr */}
                <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                  {stn.scheduled_arrival || "--:--"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function TrainDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const trainId = resolvedParams.id;

  const [train, setTrain] = useState<TrainDetailResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Event Injection State
  const [selectedDelay, setSelectedDelay] = useState<number>(15);
  const [customDelay, setCustomDelay] = useState<string>("15");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("MEDIUM");
  const [injecting, setInjecting] = useState<boolean>(false);
  const [injectSuccess, setInjectSuccess] = useState<string | null>(null);
  const [injectError, setInjectError] = useState<string | null>(null);

  // Fetch train data from backend
  const fetchTrainDetails = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true);
      try {
        setError(null);
        const data = await api.getTrainDetails(trainId);
        setTrain(data);
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Failed to load train details";
        setError(msg);
      } finally {
        setLoading(false);
        if (isManualRefresh) setRefreshing(false);
      }
    },
    [trainId]
  );

  // Initial load and periodic refresh
  useEffect(() => {
    fetchTrainDetails();
    const interval = setInterval(() => {
      fetchTrainDetails();
    }, 8000);
    return () => clearInterval(interval);
  }, [fetchTrainDetails]);

  // Handler for Event Injection
  // Calls POST /simulate/event, then immediately refreshes train state & ETAs
  const handleInjectDisruption = async (
    eventType: string,
    defaultMins: number
  ) => {
    if (!train) return;

    const delayToUse =
      customDelay && !isNaN(Number(customDelay)) && Number(customDelay) >= 0
        ? Number(customDelay)
        : defaultMins;

    setInjecting(true);
    setInjectSuccess(null);
    setInjectError(null);

    try {
      const payload = {
        train_id: train.train_number,
        event_type: eventType,
        delay_minutes: delayToUse,
        severity: selectedSeverity,
        metadata: {
          injected_from: "train_details_dashboard",
          timestamp: new Date().toISOString(),
          station: train.current_station,
        },
      };

      const result: EventInjectionResponse = await api.simulateEvent(payload);

      setInjectSuccess(
        `Disruption '${eventType}' injected successfully: +${delayToUse} min delay applied. Updated status: ${result.train_state.status}. Recalculating ML ETAs...`
      );

      // Immediately refresh train state, ETA predictions, and upcoming stations
      await fetchTrainDetails(true);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to inject operational disruption event";
      setInjectError(msg);
    } finally {
      setInjecting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="inline-block animate-spin text-2xl text-blue-600">⏳</div>
        <p className="text-sm font-medium text-slate-600">
          Loading live telemetry and XGBoost multi-station ETA predictions...
        </p>
      </div>
    );
  }

  if (error || !train) {
    return (
      <div className="space-y-4 max-w-3xl">
        <Link
          href="/"
          className="inline-flex items-center text-xs font-semibold text-blue-600 hover:underline"
        >
          &larr; Back to Control Room Dashboard
        </Link>
        <div className="p-6 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-sm shadow-xs space-y-2">
          <p className="font-bold text-base">Train Not Found or Backend Error</p>
          <p className="font-mono text-xs text-rose-700">{error}</p>
          <p className="text-xs text-slate-600 pt-2">
            Please verify the train ID or make sure the FastAPI backend is running on{" "}
            <code>http://localhost:8000</code>.
          </p>
          <button
            onClick={() => fetchTrainDetails(true)}
            className="mt-3 px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white font-medium text-xs rounded transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const state = train.current_state;
  const trainDisplayName =
    train.train_name || train.name || `Train ${train.train_number}`;
  const currentDelayMin =
    train.current_delay_minutes ?? train.current_delay ?? 0;
  const delayInfo = formatDelay(currentDelayMin);
  const upcomingCount =
    train.upcoming_stations?.length ?? train.total_upcoming_stations ?? 0;
  const activeEvents: EventDetails[] = (train.active_events || []) as EventDetails[];
  const delayTrendValue = train.delay_trend ?? 0;
  const delayHistoryValues = train.delay_history || [currentDelayMin];

  return (
    <div className="space-y-8">
      {/* 1. Header & Navigation */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Link
            href="/"
            className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            &larr; Back to Control Room Dashboard
          </Link>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => fetchTrainDetails(true)}
              disabled={refreshing}
              className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition-colors disabled:opacity-60"
            >
              <span className={`mr-1.5 ${refreshing ? "animate-spin" : ""}`}>
                🔄
              </span>
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <Link
              href={`/passenger?train=${encodeURIComponent(train.train_number)}`}
              className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-md border border-blue-600 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
            >
              Passenger View &rarr;
            </Link>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Train {train.train_number} &mdash; {trainDisplayName}
              </h1>
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-slate-800 text-white tracking-wide">
                {train.train_type}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Route #{train.route_id} &bull; Telemetry Observed:{" "}
              <span className="font-mono text-slate-700">
                {formatDateTime(train.current_timestamp)}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${delayInfo.colorClass}`}
            >
              {delayInfo.text}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Key Telemetry Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Running Status
          </div>
          <div className="mt-1 text-base font-bold text-slate-900 flex items-center space-x-2">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full ${
                state?.status === "HALTED"
                  ? "bg-rose-500 animate-pulse"
                  : state?.status === "RUNNING"
                  ? "bg-emerald-500"
                  : "bg-slate-400"
              }`}
            />
            <span>{state?.status || "RUNNING"}</span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5 font-mono">
            Speed: {state?.speed_kmh?.toFixed(0) ?? 0} km/h
          </div>
        </div>

        {/* Current Station */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Current Station
          </div>
          <div className="mt-1 text-base font-bold text-slate-900">
            {train.current_station || "Origin Station"}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Next:{" "}
            <span className="font-semibold text-slate-700">
              {state?.next_station_code || "Terminus"}
            </span>{" "}
            {state?.next_station_distance_km !== null &&
            state?.next_station_distance_km !== undefined ? (
              <span className="font-mono text-slate-400">
                ({state.next_station_distance_km.toFixed(1)} km)
              </span>
            ) : null}
          </div>
        </div>

        {/* Current Delay & Badge */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Current Delay
          </div>
          <div className="mt-1">
            <span
              className={`inline-block px-2.5 py-0.5 text-sm font-bold border rounded ${delayInfo.colorClass}`}
            >
              {delayInfo.text}
            </span>
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            At checkpoint {train.current_station || "--"}
          </div>
        </div>

        {/* Delay Trend */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Delay Trend
          </div>
          <DelayTrendSparkline
            history={delayHistoryValues}
            trend={delayTrendValue}
          />
          <div className="text-[11px] text-slate-400 mt-1">
            Trajectory across recent checkpoints
          </div>
        </div>
      </div>

      {/* 3. Route Progress Visualization */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-slate-100 gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center">
              <span className="mr-2">🛤️</span> Route Progress & Station Checkpoints
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live journey tracking across {train.route_stations?.length || 0} scheduled route stops.
            </p>
          </div>
          <div className="text-xs text-slate-500 font-mono">
            {upcomingCount} stops remaining to terminus
          </div>
        </div>

        <RouteProgressBar
          routeStations={train.route_stations || []}
          currentStationCode={train.current_station}
          nextStationCode={state?.next_station_code || null}
          segmentProgress={state?.segment_progress || 0}
        />
      </div>

      {/* 4. Active Disruptions & Event Controls (Side by Side) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Active Events */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-2xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h2 className="text-base font-semibold text-slate-900 flex items-center">
                <span className="mr-2">🚨</span> Active Disruptions
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Current operational events affecting train motion and delay.
              </p>
            </div>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                activeEvents.length > 0
                  ? "bg-rose-100 text-rose-800 border border-rose-200"
                  : "bg-emerald-100 text-emerald-800 border border-emerald-200"
              }`}
            >
              {activeEvents.length} Active
            </span>
          </div>

          {activeEvents.length === 0 ? (
            <div className="p-5 bg-slate-50 rounded-lg border border-slate-100 text-center space-y-1">
              <div className="text-xl">🟢</div>
              <div className="text-xs font-semibold text-slate-700">
                No Active Operational Disruptions
              </div>
              <div className="text-[11px] text-slate-400">
                Train is running under normal line conditions without injected halts or speed restrictions.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {activeEvents.map((evt, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs font-mono text-amber-900 px-2 py-0.5 bg-amber-200/60 rounded">
                      {evt.event_type}
                    </span>
                    <span className="text-xs font-bold text-rose-700">
                      +{evt.delay_minutes.toFixed(0)} min delay
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>
                      Severity:{" "}
                      <strong className="text-slate-800">{evt.severity}</strong>
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Injected: {formatDateTime(evt.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Operational Event Controls */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-2xs p-5 space-y-4">
          <div className="pb-2 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900 flex items-center">
              <span className="mr-2">⚡</span> Operational Disruption Controls
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Simulate operational events via backend <code>POST /simulate/event</code>.
              State and ML ETAs recalculate deterministically.
            </p>
          </div>

          {/* Configurable Delay & Severity Controls */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Delay Duration (Minutes):
              </label>
              <div className="flex items-center space-x-1.5">
                {[5, 10, 15, 25].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setSelectedDelay(preset);
                      setCustomDelay(String(preset));
                    }}
                    className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                      Number(customDelay) === preset
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    +{preset}m
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="1"
                max="180"
                value={customDelay}
                onChange={(e) => setCustomDelay(e.target.value)}
                className="mt-1.5 w-full px-2.5 py-1 text-xs border border-slate-300 rounded font-mono focus:ring-1 focus:ring-blue-500"
                placeholder="Custom delay (min)"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Event Severity:
              </label>
              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded bg-white focus:ring-1 focus:ring-blue-500"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
              </select>
              <div className="text-[11px] text-slate-400 mt-1">
                Affects dwell buffer and speed recovery profile.
              </div>
            </div>
          </div>

          {/* Event Trigger Action Buttons */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              onClick={() => handleInjectDisruption("SIGNAL_HALT", 15)}
              disabled={injecting}
              className="flex items-center justify-center p-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 font-semibold text-xs rounded-md shadow-2xs transition-colors disabled:opacity-50"
            >
              <span className="mr-1.5 text-sm">🔴</span>
              Signal Halt
            </button>

            <button
              onClick={() => handleInjectDisruption("CONGESTION", 10)}
              disabled={injecting}
              className="flex items-center justify-center p-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-semibold text-xs rounded-md shadow-2xs transition-colors disabled:opacity-50"
            >
              <span className="mr-1.5 text-sm">🟠</span>
              Congestion
            </button>

            <button
              onClick={() => handleInjectDisruption("SPEED_RESTRICTION", 8)}
              disabled={injecting}
              className="flex items-center justify-center p-2.5 bg-yellow-50 hover:bg-yellow-100 border border-yellow-300 text-yellow-900 font-semibold text-xs rounded-md shadow-2xs transition-colors disabled:opacity-50"
            >
              <span className="mr-1.5 text-sm">🟡</span>
              Speed Restriction
            </button>

            <button
              onClick={() => handleInjectDisruption("UNSCHEDULED_HALT", 12)}
              disabled={injecting}
              className="flex items-center justify-center p-2.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-900 font-semibold text-xs rounded-md shadow-2xs transition-colors disabled:opacity-50"
            >
              <span className="mr-1.5 text-sm">🛑</span>
              Unscheduled Halt
            </button>
          </div>

          {injecting && (
            <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 p-2.5 rounded flex items-center space-x-2">
              <span className="animate-spin text-sm">⚙️</span>
              <span>Sending disruption to backend simulator and recalculating ML ETAs...</span>
            </div>
          )}

          {injectSuccess && (
            <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 p-2.5 rounded space-y-1">
              <div className="font-bold">✓ Disruption Applied</div>
              <div>{injectSuccess}</div>
            </div>
          )}

          {injectError && (
            <div className="text-xs text-rose-800 bg-rose-50 border border-rose-200 p-2.5 rounded space-y-1">
              <div className="font-bold">Error Injecting Event</div>
              <div className="font-mono text-[11px]">{injectError}</div>
            </div>
          )}
        </div>
      </div>

      {/* 5. Multi-Station ETA Forecasts (XGBoost Chained Inference Table) */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Upcoming Station ETA Forecasts
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              XGBoost multi-segment chaining compared with Scheduled Timetable and Heuristic Baseline.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
            {upcomingCount} Upcoming Stations
          </span>
        </div>

        {train.upcoming_stations.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Train has reached the final destination. No upcoming stations.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider text-left">
                <tr>
                  <th className="px-4 py-3">Stop</th>
                  <th className="px-4 py-3">Station</th>
                  <th className="px-4 py-3">Distance & Segments</th>
                  <th className="px-4 py-3">Scheduled ETA</th>
                  <th className="px-4 py-3">Baseline ETA</th>
                  <th className="px-4 py-3 bg-blue-50/70 text-blue-900 font-bold">
                    XGBoost ML ETA
                  </th>
                  <th className="px-4 py-3">Confidence Window</th>
                  <th className="px-4 py-3 text-right">Remaining Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {train.upcoming_stations.map((stn: UpcomingStationETA, idx: number) => {
                  const isImmediateNext = idx === 0;

                  return (
                    <tr
                      key={stn.station_code}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isImmediateNext ? "bg-blue-50/15" : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-xs text-slate-400 font-mono">
                        #{stn.station_sequence}
                        {isImmediateNext && (
                          <span className="block text-[10px] text-blue-600 font-bold">
                            NEXT
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">
                          {stn.station_code}
                        </div>
                        <div className="text-xs text-slate-500">
                          {stn.station_name || stn.station_code}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 font-mono">
                        {stn.distance_to_go_km.toFixed(1)} km
                        <span className="text-slate-400 block text-[11px]">
                          +{stn.segments_ahead} seg ahead
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 font-mono">
                        {formatDateTime(stn.scheduled_eta)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700 font-mono">
                        {formatDateTime(stn.baseline_eta)}
                      </td>
                      <td className="px-4 py-3 bg-blue-50/30">
                        <div className="font-bold text-sm text-blue-700 font-mono">
                          {formatDateTime(stn.ml_eta || stn.predicted_eta)}
                        </div>
                        <div className="text-[11px] text-blue-600 font-medium">
                          {stn.predicted_remaining_minutes !== undefined &&
                          stn.predicted_remaining_minutes !== null
                            ? `~${stn.predicted_remaining_minutes.toFixed(0)} min away`
                            : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="font-mono text-slate-700 font-medium">
                          {formatTime(stn.confidence_lower_bound)} &ndash;{" "}
                          {formatTime(stn.confidence_upper_bound)}
                        </div>
                        <div className="text-slate-400 text-[11px]">
                          &plusmn;
                          {stn.confidence_range?.margin_minutes?.toFixed(1) || "0.0"}m uncertainty
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-slate-700 font-semibold">
                        {stn.predicted_remaining_minutes !== undefined &&
                        stn.predicted_remaining_minutes !== null
                          ? `${stn.predicted_remaining_minutes.toFixed(1)}m`
                          : "--"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. Chained Segment Predictions Breakdown */}
      {train.segment_predictions && train.segment_predictions.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50">
            <h2 className="text-base font-semibold text-slate-900">
              Chained Segment Predictions Breakdown
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Sequential inter-station segment transit durations evaluated by the trained XGBoost model.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider text-left">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Segment (From &rarr; To)</th>
                  <th className="px-4 py-3">Distance</th>
                  <th className="px-4 py-3">Scheduled Time</th>
                  <th className="px-4 py-3">Baseline Heuristic</th>
                  <th className="px-4 py-3 text-blue-900 bg-blue-50/50 font-bold">
                    ML Predicted Transit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {train.segment_predictions.map((seg) => (
                  <tr key={seg.segment_order} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono">
                      Segment #{seg.segment_order}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {seg.from_station_code} &rarr; {seg.to_station_code}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 font-mono">
                      {seg.distance_km.toFixed(1)} km
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 font-mono">
                      {seg.scheduled_minutes.toFixed(1)} min
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700 font-mono">
                      {seg.baseline_minutes.toFixed(1)} min
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-blue-700 font-mono bg-blue-50/30">
                      {seg.predicted_minutes.toFixed(1)} min
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. Full Route Timetable Schedule */}
      {train.route_stations && train.route_stations.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50">
            <h2 className="text-base font-semibold text-slate-900">
              Timetable Route Schedule
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Fixed published timetable for Route #{train.route_id}.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider text-left">
                <tr>
                  <th className="px-4 py-3">Seq</th>
                  <th className="px-4 py-3">Station Code</th>
                  <th className="px-4 py-3">Station Name</th>
                  <th className="px-4 py-3">Distance from Origin</th>
                  <th className="px-4 py-3">Scheduled Arrival</th>
                  <th className="px-4 py-3">Scheduled Departure</th>
                  <th className="px-4 py-3">Scheduled Stop</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {train.route_stations.map((rs) => (
                  <tr key={rs.sequence} className="hover:bg-slate-50/80">
                    <td className="px-4 py-2.5 text-xs text-slate-400 font-mono">
                      #{rs.sequence}
                    </td>
                    <td className="px-4 py-2.5 font-bold text-slate-800">
                      {rs.station_code}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">
                      {rs.station_name || rs.station_code}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono text-slate-600">
                      {rs.distance_from_source_km.toFixed(1)} km
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono text-slate-600">
                      {rs.scheduled_arrival || "--:--"}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono text-slate-600">
                      {rs.scheduled_departure || "--:--"}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono text-slate-500">
                      {rs.scheduled_stop_minutes} min
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
