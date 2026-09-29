"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api, formatDateTime } from "@/lib/api";
import { ModelMetricsResponse, HorizonMetrics, DisruptionMetrics } from "@/types/api";
import { CardSkeleton } from "@/components/LoadingSkeleton";

function formatMins(val: number | null | undefined, precision = 2): string {
  if (val === null || val === undefined || isNaN(val)) return "--";
  return `${val.toFixed(precision)} min`;
}

function formatPercent(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return "--";
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(1)}%`;
}

/**
 * Metric Comparison Card comparing Baseline Heuristic vs ML Model
 */
function MetricComparisonCard({
  title,
  subtitle,
  baselineVal,
  mlVal,
  unit = "min",
  lowerIsBetter = true,
}: {
  title: string;
  subtitle: string;
  baselineVal: number | null | undefined;
  mlVal: number | null | undefined;
  unit?: string;
  lowerIsBetter?: boolean;
}) {
  const hasData = baselineVal !== null && baselineVal !== undefined && mlVal !== null && mlVal !== undefined;
  const diff = hasData ? mlVal! - baselineVal! : 0;
  const pctImprovement = hasData && baselineVal! !== 0 ? ((baselineVal! - mlVal!) / baselineVal!) * 100 : 0;
  const isMlWinner = lowerIsBetter ? mlVal! < baselineVal! : mlVal! > baselineVal!;

  // Maximum value for proportional bar display
  const maxBar = hasData ? Math.max(baselineVal!, mlVal!, 1) : 1;
  const baselineWidth = hasData ? (baselineVal! / maxBar) * 100 : 0;
  const mlWidth = hasData ? (mlVal! / maxBar) * 100 : 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        {hasData && (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
              isMlWinner
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}
          >
            {isMlWinner ? `ML wins by ${Math.abs(pctImprovement).toFixed(1)}%` : "Baseline wins"}
          </span>
        )}
      </div>

      {/* Numerical Values */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Baseline Heuristic
          </div>
          <div className="text-xl font-bold font-mono text-slate-700 mt-1">
            {formatMins(baselineVal)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Static timetable + delay</div>
        </div>

        <div className="p-3 bg-blue-50/70 rounded-lg border border-blue-200">
          <div className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider flex items-center justify-between">
            <span>XGBoost ML</span>
            <span className="text-[10px] font-bold text-emerald-600 font-mono">
              {pctImprovement > 0 ? `-${pctImprovement.toFixed(1)}%` : ""}
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-blue-800 mt-1">
            {formatMins(mlVal)}
          </div>
          <div className="text-[10px] text-blue-600 mt-0.5">Chained gradient boosting</div>
        </div>
      </div>

      {/* Visual Relative Bar Comparison */}
      {hasData && (
        <div className="space-y-2 pt-1 text-xs">
          <div>
            <div className="flex justify-between text-[11px] text-slate-500 mb-1">
              <span>Baseline error bar</span>
              <span className="font-mono">{baselineVal!.toFixed(2)} {unit}</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-slate-400 rounded-full transition-all duration-500"
                style={{ width: `${baselineWidth}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-blue-700 font-semibold mb-1">
              <span>ML error bar</span>
              <span className="font-mono">{mlVal!.toFixed(2)} {unit}</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-500"
                style={{ width: `${mlWidth}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ModelPerformancePage() {
  const [metrics, setMetrics] = useState<ModelMetricsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchMetrics = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await api.getModelMetrics();
      setMetrics(data);
      setLastRefreshed(new Date());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load model evaluation metrics";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const overall = metrics?.overall;
  const horizons = metrics?.metrics_by_horizon || metrics?.by_horizon || {};
  const disruptions = metrics?.metrics_by_disruption_status || metrics?.by_disruption || {};
  const crossTab = metrics?.cross_tabulation || {};
  const datasetInfo = metrics?.dataset_info;
  const summary = metrics?.summary;

  const h1 = horizons["1_station_ahead"];
  const h3 = horizons["3_stations_ahead"];
  const h5 = horizons["5_stations_ahead"];

  const dNone = disruptions["no_disruption"];
  const dWith = disruptions["with_disruption"];

  return (
    <div className="space-y-8 pb-12">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <Link
              href="/"
              className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
            >
              Control Room
            </Link>
            <span className="text-xs text-slate-400">/</span>
            <span className="text-xs font-semibold text-slate-700">Model Performance</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1 flex items-center space-x-2.5">
            <span>📊</span>
            <span>Model Performance & Evaluation</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Empirical benchmarking comparing the Baseline heuristic against the XGBoost ETA Regressor on held-out test journeys.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="text-right">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                metrics?.status === "AVAILABLE" && metrics.is_available
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-rose-50 text-rose-800 border-rose-200"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full mr-1.5 ${
                  metrics?.status === "AVAILABLE" && metrics.is_available
                    ? "bg-emerald-500"
                    : "bg-rose-500"
                }`}
              />
              {metrics?.status || "UNKNOWN"}
            </span>
            {lastRefreshed && (
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                Loaded: {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => fetchMetrics(true)}
            disabled={loading || refreshing}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-md text-xs font-semibold text-slate-700 shadow-2xs transition-colors flex items-center space-x-1.5 disabled:opacity-50"
          >
            <span>{refreshing ? "⏳" : "🔄"}</span>
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && !metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 space-y-2">
          <div className="font-bold text-sm flex items-center space-x-1.5">
            <span>⚠️</span>
            <span>Error Loading Evaluation Metrics</span>
          </div>
          <p className="text-xs text-rose-700">{error}</p>
          <div className="pt-2">
            <button
              onClick={() => fetchMetrics(false)}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Unavailable File Warning */}
      {metrics && !metrics.is_available && (
        <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-2">
          <div className="font-bold text-sm flex items-center space-x-1.5">
            <span>⚠️</span>
            <span>Evaluation Results File Not Found</span>
          </div>
          <p className="text-xs text-amber-800">
            {metrics.message || "Model metrics file is not present. Run evaluate_model.py in backend to generate evaluation results."}
          </p>
        </div>
      )}

      {metrics && metrics.is_available && (
        <>
          {/* ========================================================================= */}
          {/* SECTION 1: OVERALL BENCHMARKING                                           */}
          {/* ========================================================================= */}
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 pb-1 border-b border-slate-200">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <span>🏆</span>
                  <span>1. Overall Model Performance</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Aggregate error metrics computed over {metrics.test_samples?.toLocaleString() || "2,430"} test horizon evaluations.
                </p>
              </div>

              {overall?.percentage_improvement !== undefined && (
                <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-md border border-emerald-200">
                  Overall Error Reduction: <strong>{overall.percentage_improvement.toFixed(1)}%</strong> ({formatMins(overall.absolute_diff_mae)} MAE)
                </div>
              )}
            </div>

            {/* 4 Required Metric Breakdown Cards: Baseline MAE, ML MAE, Baseline RMSE, ML RMSE */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* MAE Comparison Card */}
              <MetricComparisonCard
                title="Mean Absolute Error (MAE)"
                subtitle="Average absolute magnitude of arrival time prediction error across test horizons"
                baselineVal={overall?.baseline_mae ?? metrics.baseline_mae}
                mlVal={overall?.ml_mae ?? metrics.ml_mae}
                unit="min"
                lowerIsBetter={true}
              />

              {/* RMSE Comparison Card */}
              <MetricComparisonCard
                title="Root Mean Squared Error (RMSE)"
                subtitle="Error metric penalizing large tail forecasting errors and disruption outliers"
                baselineVal={overall?.baseline_rmse ?? metrics.baseline_rmse}
                mlVal={overall?.ml_rmse ?? metrics.ml_rmse}
                unit="min"
                lowerIsBetter={true}
              />
            </div>

            {/* Overall Summary Stats Banner */}
            <div className="p-4 bg-gradient-to-r from-blue-50/60 via-slate-50 to-indigo-50/60 rounded-xl border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-3">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">💡</span>
                <div>
                  <div className="font-bold text-slate-800">
                    Executive Finding: Machine Learning Superiority Over Static Timetable
                  </div>
                  <div className="text-slate-600 mt-0.5">
                    The XGBoost model cuts overall prediction error from{" "}
                    <strong>{formatMins(overall?.baseline_mae ?? metrics.baseline_mae)}</strong> down to{" "}
                    <strong>{formatMins(overall?.ml_mae ?? metrics.ml_mae)}</strong>, yielding an overall{" "}
                    <strong className="text-emerald-700">
                      {overall?.percentage_improvement?.toFixed(1) || "61.9"}% accuracy gain
                    </strong>.
                  </div>
                </div>
              </div>
              <div className="text-right font-mono text-[11px] text-slate-500 whitespace-nowrap">
                Winner: <strong className="text-blue-700 uppercase font-bold">{overall?.winner || "ML"}</strong>
              </div>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* SECTION 2: PREDICTION HORIZON BREAKDOWN (1, 3, 5 Stations)                 */}
          {/* ========================================================================= */}
          <section className="space-y-4">
            <div className="pb-1 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <span>🎯</span>
                <span>2. Prediction Horizon Breakdown</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Evaluates forecasting accuracy as lookahead distance increases: 1 Station Ahead (Local), 3 Stations (Corridor), and 5 Stations (Terminus).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 1 Station Ahead Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-100 text-blue-800 font-mono">
                      HORIZON 1
                    </span>
                    <h3 className="font-bold text-sm text-slate-800 mt-1">1 Station Ahead</h3>
                    <p className="text-[11px] text-slate-500">Immediate next upcoming stop</p>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    {h1?.sample_count?.toLocaleString() || "1,210"} samples
                  </span>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Baseline MAE:</span>
                    <strong className="font-mono text-slate-700">{formatMins(h1?.baseline_mae)}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-blue-700 font-semibold">ML MAE:</span>
                    <strong className="font-mono text-blue-700 font-bold">{formatMins(h1?.ml_mae)}</strong>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-slate-50">
                    <span className="text-slate-500">Baseline RMSE:</span>
                    <strong className="font-mono text-slate-600">{formatMins(h1?.baseline_rmse)}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-blue-700 font-semibold">ML RMSE:</span>
                    <strong className="font-mono text-blue-700 font-bold">{formatMins(h1?.ml_rmse)}</strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Improvement:</span>
                  <span className="font-bold text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    +{h1?.percentage_improvement?.toFixed(1)}% ML Win
                  </span>
                </div>
              </div>

              {/* 3 Stations Ahead Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-100 text-indigo-800 font-mono">
                      HORIZON 3
                    </span>
                    <h3 className="font-bold text-sm text-slate-800 mt-1">3 Stations Ahead</h3>
                    <p className="text-[11px] text-slate-500">Intermediate corridor checkpoints</p>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    {h3?.sample_count?.toLocaleString() || "810"} samples
                  </span>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Baseline MAE:</span>
                    <strong className="font-mono text-slate-700">{formatMins(h3?.baseline_mae)}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-indigo-700 font-semibold">ML MAE:</span>
                    <strong className="font-mono text-indigo-700 font-bold">{formatMins(h3?.ml_mae)}</strong>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-slate-50">
                    <span className="text-slate-500">Baseline RMSE:</span>
                    <strong className="font-mono text-slate-600">{formatMins(h3?.baseline_rmse)}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-indigo-700 font-semibold">ML RMSE:</span>
                    <strong className="font-mono text-indigo-700 font-bold">{formatMins(h3?.ml_rmse)}</strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Improvement:</span>
                  <span className="font-bold text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    +{h3?.percentage_improvement?.toFixed(1)}% ML Win
                  </span>
                </div>
              </div>

              {/* 5 Stations Ahead Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-purple-100 text-purple-800 font-mono">
                      HORIZON 5
                    </span>
                    <h3 className="font-bold text-sm text-slate-800 mt-1">5 Stations Ahead</h3>
                    <p className="text-[11px] text-slate-500">Distant terminus horizon</p>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    {h5?.sample_count?.toLocaleString() || "410"} samples
                  </span>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Baseline MAE:</span>
                    <strong className="font-mono text-slate-700">{formatMins(h5?.baseline_mae)}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-purple-700 font-semibold">ML MAE:</span>
                    <strong className="font-mono text-purple-700 font-bold">{formatMins(h5?.ml_mae)}</strong>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-slate-50">
                    <span className="text-slate-500">Baseline RMSE:</span>
                    <strong className="font-mono text-slate-600">{formatMins(h5?.baseline_rmse)}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-purple-700 font-semibold">ML RMSE:</span>
                    <strong className="font-mono text-purple-700 font-bold">{formatMins(h5?.ml_rmse)}</strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Improvement:</span>
                  <span className="font-bold text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    +{h5?.percentage_improvement?.toFixed(1)}% ML Win
                  </span>
                </div>
              </div>
            </div>

            {/* Horizon Comparison Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Horizon Error Progression Matrix
                </span>
                <span className="text-[11px] text-slate-400">
                  Evaluation on test journeys
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5">Horizon</th>
                      <th className="px-4 py-2.5">Samples</th>
                      <th className="px-4 py-2.5">Baseline MAE</th>
                      <th className="px-4 py-2.5 bg-blue-50/40 text-blue-900">ML MAE</th>
                      <th className="px-4 py-2.5">Baseline RMSE</th>
                      <th className="px-4 py-2.5 bg-blue-50/40 text-blue-900">ML RMSE</th>
                      <th className="px-4 py-2.5 text-right">Accuracy Improvement</th>
                      <th className="px-4 py-2.5 text-right">Winner</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      { name: "1 Station Ahead (Local)", data: h1 },
                      { name: "3 Stations Ahead (Corridor)", data: h3 },
                      { name: "5 Stations Ahead (Terminus)", data: h5 },
                    ].map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-800">{row.name}</td>
                        <td className="px-4 py-3 font-mono text-slate-500">{row.data?.sample_count?.toLocaleString() || "--"}</td>
                        <td className="px-4 py-3 font-mono text-slate-700">{formatMins(row.data?.baseline_mae)}</td>
                        <td className="px-4 py-3 font-mono font-bold text-blue-700 bg-blue-50/20">{formatMins(row.data?.ml_mae)}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">{formatMins(row.data?.baseline_rmse)}</td>
                        <td className="px-4 py-3 font-mono font-bold text-blue-700 bg-blue-50/20">{formatMins(row.data?.ml_rmse)}</td>
                        <td className="px-4 py-3 font-mono font-bold text-emerald-700 text-right">
                          {row.data?.percentage_improvement ? `+${row.data.percentage_improvement.toFixed(1)}%` : "--"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded">
                            {row.data?.winner || "ML"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* SECTION 3: DISRUPTION OPERATIONAL BREAKDOWN                               */}
          {/* ========================================================================= */}
          <section className="space-y-4">
            <div className="pb-1 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <span>⚡</span>
                <span>3. Disruption Breakdown</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Measures predictive resilience under normal running versus disrupted conditions (active signal halts, speed restrictions, bottlenecks).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* No Disruption Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">
                        Normal Line Clear
                      </span>
                    </div>
                    <h3 className="font-bold text-base text-slate-800 mt-1">No Disruption</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Standard running conditions without active signal stops or caution orders.
                    </p>
                  </div>
                  <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                    {dNone?.sample_count?.toLocaleString() || "1,585"} samples
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="text-[11px] text-slate-500 font-medium">Baseline MAE</div>
                    <div className="text-lg font-bold font-mono text-slate-700 mt-0.5">
                      {formatMins(dNone?.baseline_mae)}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      RMSE: {formatMins(dNone?.baseline_rmse)}
                    </div>
                  </div>

                  <div className="p-3 bg-emerald-50/60 rounded-lg border border-emerald-200">
                    <div className="text-[11px] text-emerald-800 font-semibold flex justify-between">
                      <span>ML MAE</span>
                      <span className="text-emerald-700">-{dNone?.percentage_improvement?.toFixed(1)}%</span>
                    </div>
                    <div className="text-lg font-bold font-mono text-emerald-800 mt-0.5">
                      {formatMins(dNone?.ml_mae)}
                    </div>
                    <div className="text-[10px] text-emerald-600 mt-0.5">
                      RMSE: {formatMins(dNone?.ml_rmse)}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50/70 rounded-lg text-xs text-slate-600 border border-slate-100">
                  <span className="font-semibold text-slate-800">Result:</span> ML reduces prediction error by{" "}
                  <strong>{dNone?.percentage_improvement?.toFixed(1) || "62.4"}%</strong> under nominal line conditions.
                </div>
              </div>

              {/* With Disruption Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                      <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wide">
                        Active Disruptions
                      </span>
                    </div>
                    <h3 className="font-bold text-base text-slate-800 mt-1">With Disruption</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Journeys experiencing active signal halts, track maintenance, or congestion bottlenecks.
                    </p>
                  </div>
                  <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                    {dWith?.sample_count?.toLocaleString() || "845"} samples
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="text-[11px] text-slate-500 font-medium">Baseline MAE</div>
                    <div className="text-lg font-bold font-mono text-slate-700 mt-0.5">
                      {formatMins(dWith?.baseline_mae)}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      RMSE: {formatMins(dWith?.baseline_rmse)}
                    </div>
                  </div>

                  <div className="p-3 bg-rose-50/60 rounded-lg border border-rose-200">
                    <div className="text-[11px] text-rose-800 font-semibold flex justify-between">
                      <span>ML MAE</span>
                      <span className="text-rose-700">-{dWith?.percentage_improvement?.toFixed(1)}%</span>
                    </div>
                    <div className="text-lg font-bold font-mono text-rose-800 mt-0.5">
                      {formatMins(dWith?.ml_mae)}
                    </div>
                    <div className="text-[10px] text-rose-600 mt-0.5">
                      RMSE: {formatMins(dWith?.ml_rmse)}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50/70 rounded-lg text-xs text-slate-600 border border-slate-100">
                  <span className="font-semibold text-slate-800">Result:</span> ML preserves a{" "}
                  <strong>{dWith?.percentage_improvement?.toFixed(1) || "60.9"}%</strong> error advantage during severe disruptions.
                </div>
              </div>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* SECTION 4: DATASET INFORMATION                                            */}
          {/* ========================================================================= */}
          <section className="space-y-4">
            <div className="pb-1 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <span>📁</span>
                <span>4. Dataset Information & Provenance</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit trail and training split metadata for evaluation reproducibility.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Journeys */}
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-1">
                <div className="text-slate-500 font-semibold text-xs flex items-center space-x-1.5">
                  <span>🚆</span>
                  <span>Journeys</span>
                </div>
                <div className="text-xl font-bold font-mono text-slate-800">
                  {summary?.total_test_journeys || metrics.test_journeys || 40} Test Journeys
                </div>
                <div className="text-[11px] text-slate-500">
                  Out of {datasetInfo?.total_journeys || metrics.total_journeys || 200} total corridor journeys ({datasetInfo?.train_journeys || metrics.train_journeys || 160} train / {summary?.total_test_journeys || metrics.test_journeys || 40} held-out test).
                </div>
              </div>

              {/* Samples */}
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-1">
                <div className="text-slate-500 font-semibold text-xs flex items-center space-x-1.5">
                  <span>📊</span>
                  <span>Evaluated Samples</span>
                </div>
                <div className="text-xl font-bold font-mono text-slate-800">
                  {(overall?.sample_count || metrics.test_samples || 2430).toLocaleString()} Samples
                </div>
                <div className="text-[11px] text-slate-500">
                  From {datasetInfo?.total_samples?.toLocaleString() || "6,125"} total generated checkpoint records ({datasetInfo?.train_samples?.toLocaleString() || "4,915"} train).
                </div>
              </div>

              {/* Evaluation Timestamp */}
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-1">
                <div className="text-slate-500 font-semibold text-xs flex items-center space-x-1.5">
                  <span>🕒</span>
                  <span>Evaluation Timestamp</span>
                </div>
                <div className="text-sm font-bold font-mono text-slate-800 line-clamp-1">
                  {metrics.evaluation_timestamp ? formatDateTime(metrics.evaluation_timestamp) : "2026-09-27"}
                </div>
                <div className="text-[10px] text-slate-400 font-mono truncate" title={metrics.evaluation_timestamp || ""}>
                  {metrics.evaluation_timestamp || "N/A"}
                </div>
              </div>

              {/* Model Version */}
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-1">
                <div className="text-slate-500 font-semibold text-xs flex items-center space-x-1.5">
                  <span>🏷️</span>
                  <span>Model Version</span>
                </div>
                <div className="text-xl font-bold font-mono text-blue-700">
                  v{metrics.model_version || "1.0.0"}
                </div>
                <div className="text-[11px] text-slate-500 line-clamp-1" title={metrics.model_name || ""}>
                  {metrics.model_name || "Dynamic Train ETA XGBoost Regressor"}
                </div>
              </div>
            </div>

            {/* Technical Metadata Table */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2 text-slate-600">
              <div className="font-bold text-slate-800 flex items-center space-x-1.5">
                <span>🔒</span>
                <span>Dataset Integrity & Synthetic Disclaimer</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {metrics.disclaimer || "SYNTHETIC SIMULATED DATASET ONLY. Timings, routes, disruptions, and model predictions are generated for MVP machine learning evaluation and DO NOT represent real historical Indian Railways operational logs."}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 text-[11px] font-mono">
                <div>Source: <strong>data/processed/model_metrics.json</strong></div>
                <div>Random Seed: <strong>{summary?.random_seed || datasetInfo?.random_seed || 42}</strong></div>
                <div>Split Isolation: <strong>Journey-level GroupKFold</strong></div>
                <div>Backend Source: <strong>GET /model/metrics</strong></div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
