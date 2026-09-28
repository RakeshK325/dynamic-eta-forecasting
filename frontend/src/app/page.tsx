"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, formatDelay, formatDateTime, formatTime } from "@/lib/api";
import {
  TrainListItem,
  ModelMetricsResponse,
  EventInjectionResponse,
  DataSourceConfigResponse,
  DemoScenarioResponse,
  DemoActionResult,
} from "@/types/api";

/**
 * Pure SVG Sparkline Component visualizing historical delay progression & slope.
 */
function DelayTrendSparkline({
  history,
  trend,
}: {
  history: number[];
  trend: number;
}) {
  const dataPoints = history && history.length > 0 ? history : [0];
  const width = 84;
  const height = 24;

  const maxVal = Math.max(...dataPoints, 5);
  const minVal = Math.min(...dataPoints, 0);
  const range = maxVal - minVal || 1;

  const points = dataPoints
    .map((val, idx) => {
      const x =
        dataPoints.length > 1
          ? (idx / (dataPoints.length - 1)) * (width - 10) + 5
          : width / 2;
      const y = height - 5 - ((val - minVal) / range) * (height - 10);
      return `${x},${y}`;
    })
    .join(" ");

  const strokeColor =
    trend > 0 ? "#e11d48" : trend < 0 ? "#059669" : "#64748b";

  return (
    <div className="inline-flex items-center space-x-2">
      <svg width={width} height={height} className="overflow-visible bg-slate-50/50 rounded px-1">
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
              ? (idx / (dataPoints.length - 1)) * (width - 10) + 5
              : width / 2;
          const y = height - 5 - ((val - minVal) / range) * (height - 10);
          return (
            <circle
              key={idx}
              cx={x}
              cy={y}
              r={idx === dataPoints.length - 1 ? 3 : 1.5}
              fill={strokeColor}
            />
          );
        })}
      </svg>
      <div className="text-[11px] font-mono whitespace-nowrap">
        {trend > 0 ? (
          <span className="text-rose-700 font-semibold" title="Delay increasing">
            ↗ +{trend.toFixed(1)}m
          </span>
        ) : trend < 0 ? (
          <span className="text-emerald-700 font-semibold" title="Recovering time">
            ↘ {trend.toFixed(1)}m
          </span>
        ) : (
          <span className="text-slate-500 font-medium" title="Stable delay">
            → 0.0m
          </span>
        )}
      </div>
    </div>
  );
}

export default function ControlRoomDashboard() {
  const router = useRouter();

  // Data states
  const [trains, setTrains] = useState<TrainListItem[]>([]);
  const [metrics, setMetrics] = useState<ModelMetricsResponse | null>(null);
  const [dataSourceConfig, setDataSourceConfig] = useState<DataSourceConfigResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState<boolean>(false);
  const [staleError, setStaleError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Keep ref to trains to retain last successful state upon poll failure
  const trainsRef = useRef<TrainListItem[]>([]);
  trainsRef.current = trains;

  // View state: "table" | "cards"
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Configurable Polling (conservative default: 15s)
  const [pollingIntervalMs, setPollingIntervalMs] = useState<number>(15000);
  const [isPollingActive, setIsPollingActive] = useState<boolean>(true);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Disruption simulation form
  const [selectedTrain, setSelectedTrain] = useState<string>("");
  const [eventType, setEventType] = useState<string>("SIGNAL_HALT");
  const [delayMinutes, setDelayMinutes] = useState<number>(15);
  const [severity, setSeverity] = useState<string>("HIGH");
  const [locationNote, setLocationNote] = useState<string>("Interlocking signal aspect red");
  const [submittingEvent, setSubmittingEvent] = useState<boolean>(false);
  const [injectionResult, setInjectionResult] = useState<EventInjectionResponse | null>(null);
  const [injectionError, setInjectionError] = useState<string | null>(null);

  // Deterministic Hackathon Demo Mode states
  const [demoScenario, setDemoScenario] = useState<DemoScenarioResponse | null>(null);
  const [demoLoading, setDemoLoading] = useState<boolean>(false);
  const [demoActionActive, setDemoActionActive] = useState<string | null>(null);
  const [demoResult, setDemoResult] = useState<DemoActionResult | null>(null);
  const [demoError, setDemoError] = useState<string | null>(null);

  // Fetch all dashboard data from backend
  const fetchDashboardData = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setLoading(true);
      setError(null);
    } else {
      setIsUpdating(true);
    }

    try {
      const [trainsRes, metricsRes, configRes, demoRes] = await Promise.all([
        api.getTrains(),
        api.getModelMetrics().catch(() => null),
        api.getDataSourceConfig().catch(() => null),
        api.getDemoScenario().catch(() => null),
      ]);

      setTrains(trainsRes.trains);
      if (metricsRes) {
        setMetrics(metricsRes);
      }
      if (configRes) {
        setDataSourceConfig(configRes);
      }
      if (demoRes) {
        setDemoScenario(demoRes);
      }
      setLastRefreshed(new Date());
      setIsStale(false);
      setStaleError(null);
      setError(null);

      if (trainsRes.trains.length > 0 && !selectedTrain) {
        setSelectedTrain(trainsRes.trains[0].train_number);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load dashboard data";
      if (isInitial && trainsRef.current.length === 0) {
        setError(msg);
      } else {
        // Retain last successful state and display non-blocking stale warning
        setIsStale(true);
        setStaleError(msg);
      }
    } finally {
      if (isInitial) setLoading(false);
      else setIsUpdating(false);
    }
  }, [selectedTrain]);

  // Initial load
  useEffect(() => {
    fetchDashboardData(true);
  }, [fetchDashboardData]);

  // Configurable Polling Hook
  useEffect(() => {
    if (!isPollingActive || pollingIntervalMs <= 0) {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
      return;
    }

    pollingTimerRef.current = setInterval(() => {
      fetchDashboardData(false);
    }, pollingIntervalMs);

    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, [isPollingActive, pollingIntervalMs, fetchDashboardData]);

  // Event Injection Submission
  const handleInjectEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrain) return;

    setSubmittingEvent(true);
    setInjectionError(null);
    setInjectionResult(null);

    try {
      const res = await api.simulateEvent({
        train_id: selectedTrain,
        event_type: eventType,
        delay_minutes: Number(delayMinutes),
        severity: severity,
        metadata: {
          location: locationNote,
          source: "ControlRoomDashboard",
          timestamp: new Date().toISOString(),
        },
      });

      setInjectionResult(res);
      // Immediately pull fresh state
      await fetchDashboardData(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to inject disruption event";
      setInjectionError(msg);
    } finally {
      setSubmittingEvent(false);
    }
  };

  // Deterministic Hackathon Demo Mode Handlers (Seed 42)
  const handleResetDemo = async () => {
    setDemoLoading(true);
    setDemoError(null);
    setDemoResult(null);
    try {
      const res = await api.resetDemoScenario();
      setDemoScenario(res);
      await fetchDashboardData(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reset demo scenario";
      setDemoError(msg);
    } finally {
      setDemoLoading(false);
    }
  };

  const handleExecuteDemoAction = async (actionId: string) => {
    setDemoActionActive(actionId);
    setDemoError(null);
    try {
      const res = await api.executeDemoAction(actionId);
      setDemoResult(res);
      await fetchDashboardData(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Failed to execute demo action ${actionId}`;
      setDemoError(msg);
    } finally {
      setDemoActionActive(null);
    }
  };

  // Top Summary Calculations
  const runningTrainsCount = trains.filter(
    (t) => t.current_state?.status === "RUNNING"
  ).length;

  const activeDelays = trains
    .filter((t) => t.current_state && t.current_state.status !== "COMPLETED")
    .map((t) => t.current_delay_minutes ?? t.current_state?.current_delay_minutes ?? 0);

  const averageDelayMin =
    activeDelays.length > 0
      ? activeDelays.reduce((acc, d) => acc + d, 0) / activeDelays.length
      : 0.0;

  const modelMae = metrics?.ml_mae ?? metrics?.metrics_by_horizon?.["1_station_ahead"]?.ml_mae ?? null;
  const baselineMae = metrics?.baseline_mae ?? metrics?.metrics_by_horizon?.["1_station_ahead"]?.baseline_mae ?? null;

  return (
    <div className="space-y-8">
      {/* Page Header with Polling Control */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Railway Control Room Dashboard
            </h1>
            {dataSourceConfig && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                  dataSourceConfig.effective_mode === "LIVE_API"
                    ? "bg-purple-100 text-purple-800 border border-purple-300"
                    : "bg-blue-100 text-blue-800 border border-blue-300"
                }`}
                title={`Configured: ${dataSourceConfig.configured_mode} | Effective: ${dataSourceConfig.effective_mode}${dataSourceConfig.cache_active ? ` | Cache TTL: ${dataSourceConfig.cache_ttl_seconds}s` : ""}`}
              >
                <span
                  className={`w-1.5 h-1.5 mr-1.5 rounded-full ${
                    dataSourceConfig.effective_mode === "LIVE_API" ? "bg-purple-600" : "bg-blue-600"
                  }`}
                />
                {dataSourceConfig.effective_mode}
                {dataSourceConfig.fallback_to_simulator && (
                  <span className="ml-1 text-[10px] text-amber-700 font-normal">
                    (Fallback Active)
                  </span>
                )}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time fleet operations, delay trends, and XGBoost machine-learning ETA forecasting.
          </p>
        </div>

        {/* Polling & Refresh Controls */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Subtle Updating Indicator */}
          {isUpdating && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
              <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-blue-600 animate-ping" />
              Updating...
            </span>
          )}

          {/* Polling Status Toggle */}
          <button
            onClick={() => setIsPollingActive(!isPollingActive)}
            className={`px-3 py-1.5 rounded font-medium border transition-colors flex items-center space-x-1.5 ${
              isPollingActive
                ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                : "bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isPollingActive ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
              }`}
            />
            <span>{isPollingActive ? "Live Polling Active" : "Polling Paused"}</span>
          </button>

          {/* Configurable Interval Dropdown (Conservative Default) */}
          <div className="flex items-center space-x-1 bg-white border border-slate-300 rounded px-2 py-1">
            <span className="text-slate-500 font-medium">Interval:</span>
            <select
              value={pollingIntervalMs}
              onChange={(e) => setPollingIntervalMs(Number(e.target.value))}
              disabled={!isPollingActive}
              className="bg-transparent font-mono text-slate-800 font-semibold focus:outline-hidden cursor-pointer"
            >
              <option value="5000">5s (Rapid)</option>
              <option value="10000">10s (Standard)</option>
              <option value="15000">15s (Default)</option>
              <option value="30000">30s (Conservative)</option>
              <option value="60000">60s (Slow)</option>
            </select>
          </div>

          {/* Manual Refresh Button */}
          <button
            onClick={() => fetchDashboardData(false)}
            disabled={isUpdating}
            className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded shadow-2xs transition-colors flex items-center space-x-1 disabled:opacity-50"
          >
            <span className={isUpdating ? "animate-spin" : ""}>🔄</span>
            <span>Refresh Now</span>
          </button>

          {lastRefreshed && (
            <span className="text-slate-400 font-mono text-[11px] hidden sm:inline">
              Refreshed: {formatTime(lastRefreshed.toISOString())}
            </span>
          )}
        </div>
      </div>

      {/* TOP SUMMARY STATS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1: Running Trains */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Running Trains
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-slate-900 font-mono">
              {runningTrainsCount}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              / {trains.length} total managed
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Active in simulator</span>
          </div>
        </div>

        {/* Stat 2: Average Delay */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Average Delay
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span
              className={`text-3xl font-extrabold font-mono ${
                averageDelayMin > 15
                  ? "text-rose-600"
                  : averageDelayMin > 5
                  ? "text-amber-600"
                  : "text-emerald-700"
              }`}
            >
              +{averageDelayMin.toFixed(1)}m
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Across active network fleet
          </div>
        </div>

        {/* Stat 3: Model MAE */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="text-xs font-semibold text-blue-900 uppercase tracking-wider flex items-center justify-between">
            <span>Model MAE</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded font-bold">
              XGBoost
            </span>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-blue-700 font-mono">
              {modelMae !== null ? `${modelMae.toFixed(1)}m` : "--"}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Held-out test set accuracy
          </div>
        </div>

        {/* Stat 4: Baseline MAE */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Baseline MAE</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded font-bold">
              Heuristic
            </span>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-slate-700 font-mono">
              {baselineMae !== null ? `${baselineMae.toFixed(1)}m` : "--"}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {metrics?.overall?.percentage_improvement
              ? `ML improved by +${metrics.overall.percentage_improvement.toFixed(0)}%`
              : "Timetable + delay heuristic"}
          </div>
        </div>
      </div>

      {/* ERROR BANNER (Initial Load Failure) */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <strong className="font-semibold">Backend Connection Issue:</strong>
            <p className="font-mono text-xs mt-0.5">{error}</p>
            <p className="text-xs text-slate-600 mt-1">
              Ensure FastAPI backend is running on <code>http://localhost:8000</code>.
            </p>
          </div>
          <button
            onClick={() => fetchDashboardData(true)}
            className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white font-medium text-xs rounded transition-colors"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* NON-BLOCKING STALE DATA WARNING BANNER */}
      {isStale && (
        <div className="p-3 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="flex items-center space-x-2">
            <span className="text-amber-600 font-bold text-base">⚠️</span>
            <div>
              <span className="font-semibold">Live Polling Interrupted:</span> Retaining last known fleet telemetry
              {lastRefreshed && (
                <span> from <strong>{lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</strong></span>
              )}.
              {staleError && <span className="text-amber-700 ml-1">({staleError})</span>}
            </div>
          </div>
          <button
            onClick={() => fetchDashboardData(false)}
            className="px-3 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 font-semibold rounded text-xs transition-colors shrink-0"
          >
            Retry Sync
          </button>
        </div>
      )}

      {/* MAIN CONTENT: FLEET LIST & DISRUPTION CONTROLS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (2 Cols): Train Table / Cards */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
            {/* Table Header Bar */}
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Fleet Monitor & Next-Station ML ETAs
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Click any train row or card to open comprehensive multi-station predictions.
                </p>
              </div>

              {/* View Toggle */}
              <div className="inline-flex rounded-md shadow-2xs border border-slate-300 overflow-hidden text-xs">
                <button
                  onClick={() => setViewMode("table")}
                  className={`px-3 py-1 font-medium transition-colors ${
                    viewMode === "table"
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Table View
                </button>
                <button
                  onClick={() => setViewMode("cards")}
                  className={`px-3 py-1 font-medium transition-colors ${
                    viewMode === "cards"
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Cards View
                </button>
              </div>
            </div>

            {/* Loading State */}
            {loading && trains.length === 0 ? (
              <div className="p-12 text-center text-sm text-slate-500">
                <div className="inline-block animate-spin text-xl mb-2">⏳</div>
                <p>Loading fleet state and XGBoost forecasts from FastAPI...</p>
              </div>
            ) : trains.length === 0 ? (
              /* Empty Data State */
              <div className="p-12 text-center text-sm text-slate-500">
                <p className="font-semibold text-slate-700">No Trains Found</p>
                <p className="text-xs text-slate-400 mt-1">
                  The backend database has no trains seeded or the simulator is empty.
                </p>
              </div>
            ) : viewMode === "table" ? (
              /* Table View */
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider text-left">
                    <tr>
                      <th className="px-4 py-3">Train</th>
                      <th className="px-3 py-3">Source</th>
                      <th className="px-3 py-3">Current Station</th>
                      <th className="px-3 py-3">Current Delay</th>
                      <th className="px-3 py-3">Delay Trend</th>
                      <th className="px-3 py-3">Next Station</th>
                      <th className="px-3 py-3">Baseline ETA</th>
                      <th className="px-4 py-3 bg-blue-50/50 text-blue-900">Next ML ETA</th>
                      <th className="px-3 py-3">Last Updated</th>
                      <th className="px-3 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {trains.map((train) => {
                      const state = train.current_state;
                      const delayVal = train.current_delay_minutes ?? state?.current_delay_minutes ?? 0;
                      const delayInfo = formatDelay(delayVal);
                      const isHalted = state?.status === "HALTED";

                      return (
                        <tr
                          key={train.id}
                          onClick={() => router.push(`/trains/${encodeURIComponent(train.train_number)}`)}
                          className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                        >
                          {/* Train Number & Name */}
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                              <span>{train.train_number}</span>
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  isHalted
                                    ? "bg-rose-500"
                                    : state?.status === "RUNNING"
                                    ? "bg-emerald-500"
                                    : "bg-slate-400"
                                }`}
                              />
                            </div>
                            <div className="text-xs text-slate-500 truncate max-w-[140px]">
                              {train.name}
                            </div>
                          </td>

                          {/* Data Source Badge */}
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded border ${
                                train.data_source_mode === "LIVE_API" || train.data_source === "external_api"
                                  ? "bg-purple-50 text-purple-700 border-purple-200"
                                  : "bg-slate-100 text-slate-700 border-slate-200"
                              }`}
                            >
                              {train.data_source_mode === "LIVE_API" || train.data_source === "external_api"
                                ? "LIVE"
                                : "SIMULATOR"}
                              {train.is_fallback && (
                                <span className="ml-1 text-[9px] text-amber-600 font-bold" title="Fell back to simulator">
                                  (FB)
                                </span>
                              )}
                            </span>
                          </td>

                          {/* Current Station */}
                          <td className="px-3 py-3">
                            <div className="font-semibold text-slate-800">
                              {train.current_station || state?.current_station_code || "Origin"}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {state?.speed_kmh !== undefined ? `${state.speed_kmh.toFixed(0)} km/h` : "0 km/h"}
                            </div>
                          </td>

                          {/* Current Delay */}
                          <td className="px-3 py-3">
                            <span
                              className={`inline-block px-2.5 py-0.5 text-xs font-semibold border rounded ${delayInfo.colorClass}`}
                            >
                              {delayInfo.text}
                            </span>
                          </td>

                          {/* Delay Trend Sparkline */}
                          <td className="px-3 py-3">
                            <DelayTrendSparkline
                              history={train.delay_history || [delayVal]}
                              trend={train.delay_trend ?? 0}
                            />
                          </td>

                          {/* Next Station */}
                          <td className="px-3 py-3">
                            <div className="font-semibold text-slate-800">
                              {train.next_station || state?.next_station_code || "Terminus"}
                            </div>
                            {state?.next_station_distance_km !== null && state?.next_station_distance_km !== undefined && (
                              <div className="text-[11px] text-slate-400">
                                {state.next_station_distance_km.toFixed(1)} km to go
                              </div>
                            )}
                          </td>

                          {/* Baseline ETA */}
                          <td className="px-3 py-3 font-mono text-xs">
                            {train.baseline_eta ? (
                              <div>
                                <div className="font-semibold text-slate-700">
                                  {formatTime(train.baseline_eta)}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {formatDateTime(train.baseline_eta)}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400">--:--</span>
                            )}
                          </td>

                          {/* Next ML ETA */}
                          <td className="px-4 py-3 bg-blue-50/20">
                            {train.ml_eta ? (
                              <div>
                                <div className="font-bold text-sm text-blue-700 font-mono">
                                  {formatTime(train.ml_eta)}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {formatDateTime(train.ml_eta)}
                                </div>
                                {train.confidence_range && (
                                  <div className="text-[10px] text-blue-600 font-sans mt-0.5">
                                    &plusmn;{train.confidence_range.margin_minutes.toFixed(0)}m conf
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">--:--</span>
                            )}
                          </td>

                          {/* Last Updated */}
                          <td className="px-3 py-3 text-[11px] text-slate-500 font-mono whitespace-nowrap">
                            {train.last_updated
                              ? formatTime(train.last_updated)
                              : lastRefreshed
                              ? formatTime(lastRefreshed.toISOString())
                              : "--:--"}
                          </td>

                          {/* Action */}
                          <td className="px-3 py-3 text-right">
                            <span className="inline-block text-xs font-semibold text-blue-600 group-hover:underline">
                              View Details &rarr;
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Cards View */
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {trains.map((train) => {
                  const state = train.current_state;
                  const delayVal = train.current_delay_minutes ?? state?.current_delay_minutes ?? 0;
                  const delayInfo = formatDelay(delayVal);
                  const isHalted = state?.status === "HALTED";

                  return (
                    <div
                      key={train.id}
                      onClick={() => router.push(`/trains/${encodeURIComponent(train.train_number)}`)}
                      className="p-4 rounded-lg border border-slate-200 hover:border-blue-400 hover:shadow-xs transition-all cursor-pointer bg-white space-y-3"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-base text-slate-900 flex items-center space-x-1.5">
                            <span>{train.train_number}</span>
                            <span
                              className={`w-2.5 h-2.5 rounded-full ${
                                isHalted
                                  ? "bg-rose-500"
                                  : state?.status === "RUNNING"
                                  ? "bg-emerald-500"
                                  : "bg-slate-400"
                              }`}
                            />
                            <span
                              className={`inline-block px-1.5 py-0.2 text-[10px] font-semibold rounded border ${
                                train.data_source_mode === "LIVE_API" || train.data_source === "external_api"
                                  ? "bg-purple-50 text-purple-700 border-purple-200"
                                  : "bg-slate-100 text-slate-700 border-slate-200"
                              }`}
                            >
                              {train.data_source_mode === "LIVE_API" || train.data_source === "external_api"
                                ? "LIVE"
                                : "SIM"}
                              {train.is_fallback && <span className="text-amber-600 font-bold ml-0.5">(FB)</span>}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 line-clamp-1">
                            {train.name}
                          </div>
                        </div>
                        <span
                          className={`inline-block px-2 py-0.5 text-xs font-semibold border rounded ${delayInfo.colorClass}`}
                        >
                          {delayInfo.text}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100">
                        <div>
                          <span className="text-slate-400">Current:</span>{" "}
                          <strong className="text-slate-800">
                            {train.current_station || state?.current_station_code || "Origin"}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-400">Next:</span>{" "}
                          <strong className="text-slate-800">
                            {train.next_station || state?.next_station_code || "Terminus"}
                          </strong>
                        </div>
                      </div>

                      <div className="p-2.5 bg-blue-50/50 rounded border border-blue-100 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <div className="text-slate-500 font-medium text-[10px]">
                            Baseline ETA:
                          </div>
                          <div className="font-semibold text-slate-700 font-mono">
                            {train.baseline_eta ? formatTime(train.baseline_eta) : "--:--"}
                          </div>
                        </div>
                        <div>
                          <div className="text-blue-900 font-medium text-[10px]">
                            Next ML ETA:
                          </div>
                          <div className="font-bold text-blue-700 text-sm font-mono">
                            {train.ml_eta ? formatTime(train.ml_eta) : "--:--"}
                          </div>
                          {train.confidence_range && (
                            <div className="text-[10px] text-blue-600 font-sans">
                              &plusmn;{train.confidence_range.margin_minutes.toFixed(0)}m
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1 border-t border-slate-100 font-mono">
                        <span>
                          Updated: {train.last_updated ? formatTime(train.last_updated) : lastRefreshed ? formatTime(lastRefreshed.toISOString()) : "--:--"}
                        </span>
                        <DelayTrendSparkline
                          history={train.delay_history || [delayVal]}
                          trend={train.delay_trend ?? 0}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Operational Disruption Controls */}
        <div className="space-y-6">
          {/* Deterministic Hackathon Demo Mode Card */}
          <div className="bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/50 rounded-lg border-2 border-indigo-200 shadow-xs p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-lg">🎯</span>
                  <h2 className="text-base font-bold text-slate-900">
                    Hackathon Demo Mode
                  </h2>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                    SEED: 42
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Deterministic scenario with <strong>Train 12302</strong> on the NDLS-HWH trunk corridor.
                  Evaluates the full pipeline: <em>Simulator &rarr; State &rarr; Feature &rarr; Baseline &rarr; ML ETA &rarr; Views</em>.
                </p>
              </div>
            </div>

            {/* Current Demo Scenario State Summary */}
            {demoScenario && (
              <div className="p-3 bg-white/90 rounded-md border border-indigo-100 text-xs space-y-2 shadow-2xs">
                <div className="flex justify-between items-center text-slate-700">
                  <span>
                    Train: <strong>{demoScenario.train_number}</strong> ({demoScenario.current_station} &rarr; {demoScenario.next_station})
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-indigo-700">
                    {demoScenario.train_status} ({demoScenario.current_speed_kmh.toFixed(0)} km/h)
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] pt-1 border-t border-slate-100">
                  <div>
                    <span className="text-slate-500">Delay:</span>{" "}
                    <strong className="text-rose-600 font-mono">
                      +{demoScenario.current_delay_minutes.toFixed(1)}m
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Baseline:</span>{" "}
                    <strong className="text-slate-800 font-mono">
                      {formatTime(demoScenario.baseline_eta)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-indigo-600 font-medium">ML ETA:</span>{" "}
                    <strong className="text-indigo-700 font-mono font-bold">
                      {formatTime(demoScenario.ml_eta)}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* Demo Reset Button */}
            <button
              type="button"
              onClick={handleResetDemo}
              disabled={demoLoading}
              className="w-full py-2 px-3 rounded-md text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors flex items-center justify-center space-x-1.5 disabled:opacity-50"
            >
              <span>{demoLoading ? "⏳" : "🔄"}</span>
              <span>{demoLoading ? "Resetting Scenario..." : "Reset Demo Scenario (Seed 42)"}</span>
            </button>

            {/* 3 Prepared Demo Actions */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                Prepared Disruption Actions:
              </label>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => handleExecuteDemoAction("signal_halt")}
                  disabled={demoActionActive !== null}
                  className="w-full p-2.5 rounded-md text-left text-xs bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all flex items-center justify-between disabled:opacity-50 group"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-sm">🔴</span>
                    <div>
                      <div className="font-bold text-rose-900 group-hover:text-rose-950">
                        1. Signal Halt (+15m)
                      </div>
                      <div className="text-[10px] text-rose-700">
                        Signal red &bull; Speed drops to 0 km/h &bull; Status: HALTED
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-rose-600 font-mono font-semibold">
                    {demoActionActive === "signal_halt" ? "Running..." : "Inject &rarr;"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExecuteDemoAction("congestion")}
                  disabled={demoActionActive !== null}
                  className="w-full p-2.5 rounded-md text-left text-xs bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-all flex items-center justify-between disabled:opacity-50 group"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-sm">🟠</span>
                    <div>
                      <div className="font-bold text-amber-900 group-hover:text-amber-950">
                        2. Line Congestion (+10m)
                      </div>
                      <div className="text-[10px] text-amber-700">
                        Suburban block ahead &bull; Speed restricted to 49.5 km/h &bull; RUNNING
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-amber-600 font-mono font-semibold">
                    {demoActionActive === "congestion" ? "Running..." : "Inject &rarr;"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExecuteDemoAction("speed_restriction")}
                  disabled={demoActionActive !== null}
                  className="w-full p-2.5 rounded-md text-left text-xs bg-yellow-50 hover:bg-yellow-100 border border-yellow-300 transition-all flex items-center justify-between disabled:opacity-50 group"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-sm">🟡</span>
                    <div>
                      <div className="font-bold text-yellow-900 group-hover:text-yellow-950">
                        3. Speed Restriction (+8m)
                      </div>
                      <div className="text-[10px] text-yellow-700">
                        Track maintenance zone &bull; Speed restricted to 30.0 km/h &bull; RUNNING
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-yellow-700 font-mono font-semibold">
                    {demoActionActive === "speed_restriction" ? "Running..." : "Inject &rarr;"}
                  </span>
                </button>
              </div>
            </div>

            {/* Action Feedback Banner */}
            {demoResult && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs space-y-1.5 animate-fadeIn">
                <div className="font-bold text-emerald-800 flex items-center space-x-1">
                  <span>✓</span>
                  <span>{demoResult.action_name} Executed</span>
                </div>
                <div className="text-slate-700 text-[11px]">
                  <strong>New Delay:</strong> +{demoResult.new_delay_minutes.toFixed(1)}m &bull;{" "}
                  <strong>Status:</strong> {demoResult.new_status} &bull;{" "}
                  <strong>Speed:</strong> {demoResult.speed_kmh.toFixed(1)} km/h
                </div>
                <div className="text-[11px] font-mono text-slate-700 flex justify-between pt-1 border-t border-emerald-200/60">
                  <span>Baseline: <strong>{formatTime(demoResult.baseline_eta)}</strong></span>
                  <span className="text-indigo-800 font-bold">ML ETA: {formatTime(demoResult.ml_eta)}</span>
                </div>
              </div>
            )}

            {demoError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-md text-xs">
                <strong>Demo Error:</strong> {demoError}
              </div>
            )}

            {/* Quick View Links to verify all 3 views */}
            <div className="pt-2 border-t border-indigo-100">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Verify Across All Views:
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-center">
                <Link
                  href="/trains/12302"
                  className="p-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded text-[11px] font-semibold text-blue-700 hover:underline"
                >
                  Train 12302
                </Link>
                <Link
                  href="/station?code=PRYJ"
                  className="p-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded text-[11px] font-semibold text-blue-700 hover:underline"
                >
                  PRYJ Board
                </Link>
                <Link
                  href="/passenger?train=12302"
                  className="p-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded text-[11px] font-semibold text-blue-700 hover:underline"
                >
                  Passenger
                </Link>
              </div>
            </div>
          </div>

          {/* Disruption Event Injection Card */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-2xs p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-1 flex items-center">
              <span className="mr-2">⚡</span> Disruption Simulator
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Inject disruptions into the simulator (`POST /simulate/event`) to test real-time ETA re-forecasting.
            </p>

            <form onSubmit={handleInjectEvent} className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 uppercase">
                  Target Train
                </label>
                <select
                  value={selectedTrain}
                  onChange={(e) => setSelectedTrain(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                  required
                >
                  {trains.map((t) => (
                    <option key={t.id} value={t.train_number}>
                      {t.train_number} - {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 uppercase">
                  Event Disruption Type
                </label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="SIGNAL_HALT">SIGNAL_HALT (Signal Stop)</option>
                  <option value="CONGESTION">CONGESTION (Line Bottleneck)</option>
                  <option value="SPEED_RESTRICTION">SPEED_RESTRICTION (Track Maintenance)</option>
                  <option value="UNSCHEDULED_HALT">UNSCHEDULED_HALT (Ad-hoc Halt)</option>
                  <option value="WEATHER">WEATHER (Fog / Adverse Weather)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 uppercase">
                    Delay (Min)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={delayMinutes}
                    onChange={(e) => setDelayMinutes(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 uppercase">
                    Severity
                  </label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 uppercase">
                  Operational Reason / Note
                </label>
                <input
                  type="text"
                  value={locationNote}
                  onChange={(e) => setLocationNote(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                  placeholder="e.g. Signal failure at junction"
                />
              </div>

              <button
                type="submit"
                disabled={submittingEvent || !selectedTrain}
                className="w-full mt-2 py-2 px-4 rounded-md text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 transition-colors shadow-xs"
              >
                {submittingEvent ? "Injecting Disruption..." : "⚡ Inject Disruption Event"}
              </button>
            </form>

            {injectionError && (
              <div className="mt-3 p-3 text-xs bg-rose-50 border border-rose-200 text-rose-800 rounded">
                <strong>Error:</strong> {injectionError}
              </div>
            )}

            {injectionResult && (
              <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded text-xs space-y-1.5">
                <div className="font-semibold text-emerald-800">
                  ✓ {injectionResult.message}
                </div>
                <div className="text-slate-700">
                  <strong>Train:</strong> {injectionResult.train_state.train_number} &bull;{" "}
                  <strong>New Status:</strong> {injectionResult.train_state.status}
                </div>
                <div className="text-slate-700">
                  <strong>New Delay:</strong> +{injectionResult.train_state.current_delay_minutes.toFixed(1)}m
                </div>
                <div className="text-slate-700">
                  <strong>Updated ML ETA:</strong> {formatDateTime(injectionResult.ml_eta)}
                </div>
              </div>
            )}
          </div>

          {/* Model Metrics Breakdown Card */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-2xs p-5 space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-semibold text-slate-900">
                Model Evaluation Summary
              </h2>
              <span
                className={`text-[11px] px-2 py-0.5 font-bold rounded ${
                  metrics?.status === "AVAILABLE"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {metrics?.status || "UNKNOWN"}
              </span>
            </div>

            {metrics && metrics.is_available ? (
              <div className="space-y-3 text-xs">
                <div className="text-slate-600">
                  <strong>Model:</strong> {metrics.model_name} (v{metrics.model_version})
                </div>

                <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded border border-slate-200 text-center">
                  <div>
                    <div className="text-slate-400">Baseline MAE</div>
                    <div className="font-bold text-sm text-slate-700">
                      {metrics.baseline_mae !== null ? `${metrics.baseline_mae.toFixed(1)}m` : "--"}
                    </div>
                  </div>
                  <div>
                    <div className="text-blue-900 font-semibold">XGBoost ML MAE</div>
                    <div className="font-bold text-sm text-blue-700">
                      {metrics.ml_mae !== null ? `${metrics.ml_mae.toFixed(1)}m` : "--"}
                    </div>
                  </div>
                </div>

                {metrics.metrics_by_horizon && (
                  <div>
                    <div className="font-semibold text-slate-700 mb-1">
                      By Forecasting Horizon:
                    </div>
                    <div className="space-y-1">
                      {Object.entries(metrics.metrics_by_horizon).map(([key, val]) => (
                        <div
                          key={key}
                          className="flex justify-between items-center py-1 border-b border-slate-100 text-[11px]"
                        >
                          <span className="text-slate-600 capitalize">
                            {key.replace(/_/g, " ")}:
                          </span>
                          <span className="font-mono text-emerald-700 font-semibold">
                            {val.ml_mae.toFixed(1)}m ({val.percentage_improvement > 0 ? `+${val.percentage_improvement.toFixed(0)}%` : `${val.percentage_improvement.toFixed(0)}%`})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-[11px] text-slate-400 pt-1">
                  Evaluated on {metrics.test_samples} held-out samples.
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 py-2">
                Evaluation metrics currently unavailable.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
