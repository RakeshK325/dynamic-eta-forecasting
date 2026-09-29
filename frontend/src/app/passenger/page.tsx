"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, formatDateTime, formatTime, formatDelay } from "@/lib/api";
import {
  TrainListItem,
  TrainDetailResponse,
  UpcomingStationETA,
} from "@/types/api";
import UncertaintyRangeBar from "@/components/UncertaintyRangeBar";
import { StatusBadge } from "@/components/StatusBadge";
import EtaComparisonBadge from "@/components/EtaComparisonBadge";
import { CardSkeleton, Skeleton } from "@/components/LoadingSkeleton";

function PassengerViewContent() {
  const searchParams = useSearchParams();
  const initialTrainParam = searchParams.get("train") || "12302";

  const [trainsList, setTrainsList] = useState<TrainListItem[]>([]);
  const [selectedTrainNumber, setSelectedTrainNumber] = useState<string>(initialTrainParam);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [trainDetails, setTrainDetails] = useState<TrainDetailResponse | null>(null);
  const [selectedStationCode, setSelectedStationCode] = useState<string>("");

  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // 1. Fetch available trains list
  useEffect(() => {
    async function loadTrains() {
      try {
        setLoadingList(true);
        const res = await api.getTrains();
        setTrainsList(res.trains);
      } catch (err: unknown) {
        console.error("Failed to load trains list", err);
      } finally {
        setLoadingList(false);
      }
    }
    loadTrains();
  }, []);

  // 2. Fetch train details for the selected train
  const fetchSelectedTrain = useCallback(
    async (trainNum: string, isSilent = false) => {
      if (!trainNum.trim()) return;
      if (!isSilent) setLoadingDetails(true);
      else setIsRefreshing(true);
      setError(null);
      try {
        const data = await api.getTrainDetails(trainNum.trim());
        setTrainDetails(data);
        setLastRefreshed(new Date());

        // Default selected station to immediate next upcoming station if not set or invalid
        if (data.upcoming_stations && data.upcoming_stations.length > 0) {
          const exists = data.upcoming_stations.some(
            (s) => s.station_code === selectedStationCode
          );
          if (!exists) {
            setSelectedStationCode(data.upcoming_stations[0].station_code);
          }
        } else {
          setSelectedStationCode("");
        }
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : "Unable to retrieve train running state";
        if (!isSilent) {
          setError(msg);
          setTrainDetails(null);
        }
      } finally {
        if (!isSilent) setLoadingDetails(false);
        else setIsRefreshing(false);
      }
    },
    [selectedStationCode]
  );

  useEffect(() => {
    if (selectedTrainNumber) {
      fetchSelectedTrain(selectedTrainNumber);
    }
  }, [selectedTrainNumber, fetchSelectedTrain]);

  // 3. Periodic Auto-refresh every 10 seconds for real-time passenger sync
  useEffect(() => {
    if (!selectedTrainNumber) return;
    const interval = setInterval(() => {
      fetchSelectedTrain(selectedTrainNumber, true);
    }, 10000);
    return () => clearInterval(interval);
  }, [selectedTrainNumber, fetchSelectedTrain]);

  // Filtered train search options
  const filteredTrains = useMemo(() => {
    if (!searchQuery.trim()) return trainsList;
    const q = searchQuery.toLowerCase().trim();
    return trainsList.filter(
      (t) =>
        t.train_number.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q)
    );
  }, [trainsList, searchQuery]);

  // Current target upcoming station forecast
  const targetStationETA: UpcomingStationETA | null = useMemo(() => {
    if (!trainDetails?.upcoming_stations || trainDetails.upcoming_stations.length === 0) {
      return null;
    }
    if (!selectedStationCode) {
      return trainDetails.upcoming_stations[0];
    }
    const found = trainDetails.upcoming_stations.find(
      (s) => s.station_code === selectedStationCode
    );
    return found || trainDetails.upcoming_stations[0];
  }, [trainDetails, selectedStationCode]);

  const trainName =
    trainDetails?.train_name ||
    trainDetails?.name ||
    trainsList.find((t) => t.train_number === selectedTrainNumber)?.name ||
    `Train ${selectedTrainNumber}`;

  const currentDelayMinutes =
    trainDetails?.current_delay_minutes ??
    trainDetails?.current_delay ??
    0;
  const delayInfo = formatDelay(currentDelayMinutes);
  const currentStation = trainDetails?.current_station || "Origin Station";

  return (
    <div className="max-w-xl mx-auto space-y-6 pb-12">
      {/* Top Mobile Bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="text-xs font-medium text-slate-500 hover:text-slate-800 flex items-center transition-colors"
        >
          &larr; Back to Control Room
        </Link>
        <div className="flex items-center space-x-2">
          {isRefreshing ? (
            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 animate-pulse border border-blue-200">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
              <span>Updating...</span>
            </span>
          ) : (
            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Live Sync (10s)</span>
            </span>
          )}
          <button
            type="button"
            onClick={() => fetchSelectedTrain(selectedTrainNumber)}
            className="text-[11px] text-slate-500 hover:text-slate-800 border border-slate-200 rounded px-1.5 py-0.5 bg-white hover:bg-slate-50 transition-colors"
            title="Refresh now"
          >
            ↻
          </button>
          <span className="text-[11px] text-slate-400 font-mono">
            {formatTime(lastRefreshed.toISOString())}
          </span>
        </div>
      </div>

      {/* Hero Title */}
      <div className="text-center space-y-1">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-700 text-xl mb-1 shadow-2xs">
          🚆
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Passenger Live ETA Lookup
        </h1>
        <p className="text-xs text-slate-500">
          Real-time dynamic arrival forecasts powered by machine learning.
        </p>
      </div>

      {/* Train Selector Card */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
          Select or Search Your Train
        </label>

        {/* Dropdown Select */}
        <select
          value={selectedTrainNumber}
          onChange={(e) => {
            setSelectedTrainNumber(e.target.value);
            setSearchQuery("");
          }}
          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition-all"
        >
          {loadingList ? (
            <option>Loading available trains...</option>
          ) : (
            trainsList.map((t) => (
              <option key={t.id} value={t.train_number}>
                {t.train_number} &mdash; {t.name} ({t.train_type})
              </option>
            ))
          )}
        </select>

        {/* Quick Search Input */}
        <div className="relative">
          <input
            type="text"
            placeholder="Type train number or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
          />
          <span className="absolute left-2.5 top-2.5 text-xs text-slate-400">
            🔍
          </span>
        </div>

        {/* Filtered suggestions list when typing */}
        {searchQuery.trim().length > 0 && (
          <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg text-xs bg-white shadow-lg">
            {filteredTrains.length === 0 ? (
              <div className="p-2 text-center text-slate-400">
                No matching trains found
              </div>
            ) : (
              filteredTrains.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setSelectedTrainNumber(t.train_number);
                    setSearchQuery("");
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center justify-between"
                >
                  <span className="font-semibold text-slate-800">
                    {t.train_number} - {t.name}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {t.current_station || "Origin"}
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {/* Quick Tap Pills for Mobile */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {["12302", "12952", "12028", "12260"].map((num) => {
            const isCurrent = selectedTrainNumber === num;
            return (
              <button
                key={num}
                type="button"
                onClick={() => setSelectedTrainNumber(num)}
                className={`px-2.5 py-1 text-xs rounded-full border transition-all ${
                  isCurrent
                    ? "bg-blue-600 text-white border-blue-600 font-semibold shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                }`}
              >
                #{num}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading Details State */}
      {loadingDetails && (
        <div className="space-y-4">
          <CardSkeleton />
        </div>
      )}

      {/* Error State */}
      {error && !loadingDetails && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs space-y-1">
          <div className="font-bold">Error Loading Train Information</div>
          <div>{error}</div>
          <button
            onClick={() => fetchSelectedTrain(selectedTrainNumber)}
            className="mt-2 text-xs font-semibold text-rose-900 underline"
          >
            Tap to retry
          </button>
        </div>
      )}

      {/* PASSENGER CARD: Current Station, Delay, Upcoming Station, Expected Arrival, Confidence Range */}
      {trainDetails && !loadingDetails && (
        <div className="space-y-4">
          {/* Main Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
            {/* Train Info Header */}
            <div className="bg-linear-to-r from-slate-900 to-slate-800 text-white p-5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-wider text-blue-300 uppercase">
                  {trainDetails.train_type} &bull; Route #{trainDetails.route_id}
                </span>
                <StatusBadge status={trainDetails.current_state?.status} size="sm" />
              </div>
              <h2 className="text-xl font-bold mt-1 tracking-tight">
                {trainDetails.train_number} &mdash; {trainName}
              </h2>
            </div>

            <div className="p-5 space-y-5">
              {/* Telemetry Strip: Current Station + Current Delay */}
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                {/* 1. Current Station */}
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Current Station
                  </div>
                  <div className="text-base font-bold text-slate-900 mt-0.5 flex items-center space-x-1.5">
                    <span className="text-blue-600">📍</span>
                    <span>{currentStation}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Speed: {trainDetails.current_state?.speed_kmh?.toFixed(0) ?? 0} km/h
                  </div>
                </div>

                {/* 2. Current Delay */}
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Current Delay
                  </div>
                  <div className="mt-1">
                    <span
                      className={`inline-block px-2.5 py-0.5 text-xs font-bold border rounded-md ${delayInfo.colorClass}`}
                    >
                      {delayInfo.text}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {currentDelayMinutes <= 0.5 ? "Running smoothly" : "Behind schedule"}
                  </div>
                </div>
              </div>

              {/* 3. Upcoming Station Selector */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span className="uppercase tracking-wider">
                    Upcoming Station
                  </span>
                  {trainDetails.upcoming_stations &&
                    trainDetails.upcoming_stations.length > 1 && (
                      <span className="text-[11px] text-blue-600 font-normal">
                        Select stop &darr;
                      </span>
                    )}
                </div>

                {trainDetails.upcoming_stations &&
                trainDetails.upcoming_stations.length > 0 ? (
                  <select
                    value={selectedStationCode}
                    onChange={(e) => setSelectedStationCode(e.target.value)}
                    className="w-full px-3 py-2 bg-blue-50/50 border border-blue-200 rounded-xl text-sm font-bold text-blue-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    {trainDetails.upcoming_stations.map((stn, idx) => (
                      <option key={stn.station_code} value={stn.station_code}>
                        {idx === 0 ? "👉 NEXT: " : "Upcoming: "}
                        {stn.station_code} &mdash; {stn.station_name || stn.station_code}{" "}
                        ({(stn.distance_to_go_km ?? 0).toFixed(0)} km away)
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-500 text-center font-medium">
                    Train has reached its final destination.
                  </div>
                )}
              </div>

              {/* 4. Expected Arrival & Prediction Uncertainty Window */}
              {targetStationETA ? (
                <div className="space-y-3">
                  <UncertaintyRangeBar
                    mlEta={targetStationETA.ml_eta || targetStationETA.predicted_eta}
                    lowerBound={targetStationETA.confidence_lower_bound}
                    upperBound={targetStationETA.confidence_upper_bound}
                    marginMinutes={targetStationETA.confidence_range?.margin_minutes}
                    segmentsAhead={targetStationETA.segments_ahead}
                    variant="card"
                  />

                  {/* Supplemental Timetable & Distance Details */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Timetable Schedule:</span>
                      <EtaComparisonBadge type="scheduled" time={targetStationETA.scheduled_eta} size="sm" />
                    </div>
                    {targetStationETA.baseline_eta && (
                      <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/60">
                        <span className="text-slate-500 font-medium">Speed Heuristic Baseline:</span>
                        <EtaComparisonBadge type="baseline" time={targetStationETA.baseline_eta} size="sm" />
                      </div>
                    )}
                    {targetStationETA.predicted_remaining_minutes !== undefined &&
                      targetStationETA.predicted_remaining_minutes !== null && (
                        <div className="flex items-center justify-between text-slate-600 pt-1.5 border-t border-slate-200/60">
                          <span>Estimated Remaining Transit:</span>
                          <span className="font-mono font-bold text-blue-700">
                            ~{(targetStationETA.predicted_remaining_minutes ?? 0).toFixed(0)} min away ({(targetStationETA.distance_to_go_km ?? 0).toFixed(1)} km)
                          </span>
                        </div>
                      )}
                  </div>
                </div>
              ) : null}

              {/* Action Buttons: Refresh & View All Stops */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => fetchSelectedTrain(selectedTrainNumber)}
                  className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors flex items-center justify-center space-x-1.5 shadow-2xs"
                >
                  <span>🔄</span>
                  <span>Refresh Now</span>
                </button>

                <Link
                  href={`/trains/${encodeURIComponent(trainDetails.train_number)}`}
                  className="py-2.5 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-semibold text-xs transition-colors flex items-center justify-center space-x-1"
                >
                  <span>Full Route &rarr;</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PassengerLookupPage() {
  return (
    <Suspense
      fallback={
        <div className="py-16 text-center text-sm text-slate-500">
          Loading Passenger View...
        </div>
      }
    >
      <PassengerViewContent />
    </Suspense>
  );
}
