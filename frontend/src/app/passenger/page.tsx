"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, formatTime, formatDelay } from "@/lib/api";
import {
  TrainListItem,
  TrainDetailResponse,
  UpcomingStationETA,
} from "@/types/api";
import UncertaintyRangeBar from "@/components/UncertaintyRangeBar";
import { StatusBadge } from "@/components/StatusBadge";
import EtaComparisonBadge from "@/components/EtaComparisonBadge";
import { CardSkeleton } from "@/components/LoadingSkeleton";

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

  // Target upcoming station forecast
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
    <div className="max-w-2xl mx-auto space-y-4 pb-10">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="text-xs font-medium text-[#66717A] hover:text-[#172026] flex items-center transition-colors"
        >
          &larr; Back to Control Room
        </Link>
        <div className="flex items-center space-x-2">
          {isRefreshing ? (
            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#EBF3FC] text-[#2563A8] border border-[#BFDBFE]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2563A8] animate-ping" />
              <span>Updating...</span>
            </span>
          ) : (
            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#EBF7EE] text-[#168A55] border border-[#B4E2C1]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#168A55]" />
              <span>Live Telemetry</span>
            </span>
          )}
          <button
            type="button"
            onClick={() => fetchSelectedTrain(selectedTrainNumber)}
            className="text-[11px] text-[#66717A] hover:text-[#172026] border border-[#D9DEE3] rounded px-1.5 py-0.5 bg-[#FFFFFF] hover:bg-[#F0F3F5] transition-colors cursor-pointer"
            title="Refresh now"
          >
            ↻
          </button>
          <span className="text-[11px] text-[#8A949C] font-mono">
            {formatTime(lastRefreshed.toISOString())}
          </span>
        </div>
      </div>

      {/* Train Selector Card */}
      <div className="bg-[#FFFFFF] p-4 rounded-lg border border-[#D9DEE3] shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[#66717A]">
            Select / Search Train
          </label>
          <span className="text-[10px] text-[#8A949C] font-mono">
            {trainsList.length} Active Trains
          </span>
        </div>

        {/* Dropdown Select */}
        <select
          value={selectedTrainNumber}
          onChange={(e) => {
            setSelectedTrainNumber(e.target.value);
            setSearchQuery("");
          }}
          className="w-full px-3 py-2 bg-[#F8FAFB] border border-[#D9DEE3] rounded-md text-xs sm:text-[13px] font-semibold text-[#172026] focus:bg-[#FFFFFF] focus:border-[#2563A8] focus:outline-none transition-all font-mono"
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
            className="w-full pl-7 pr-3 py-1.5 text-xs border border-[#D9DEE3] rounded-md bg-[#FFFFFF] focus:border-[#2563A8] focus:outline-none"
          />
          <span className="absolute left-2.5 top-2 text-[11px] text-[#8A949C]">
            🔍
          </span>
        </div>

        {/* Filtered suggestions list when typing */}
        {searchQuery.trim().length > 0 && (
          <div className="max-h-36 overflow-y-auto divide-y divide-[#D9DEE3]/70 border border-[#D9DEE3] rounded-md text-xs bg-[#FFFFFF] shadow-md">
            {filteredTrains.length === 0 ? (
              <div className="p-2 text-center text-[#8A949C]">
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
                  className="w-full text-left px-3 py-1.5 hover:bg-[#F0F3F5] flex items-center justify-between"
                >
                  <span className="font-semibold text-[#172026]">
                    {t.train_number} - {t.name}
                  </span>
                  <span className="text-[10px] text-[#8A949C] font-mono">
                    {t.current_station || "Origin"}
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {/* Quick Tap Pills */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {["12302", "12952", "12028", "12260"].map((num) => {
            const isCurrent = selectedTrainNumber === num;
            return (
              <button
                key={num}
                type="button"
                onClick={() => setSelectedTrainNumber(num)}
                className={`px-2 py-0.5 text-xs rounded border transition-all font-mono ${
                  isCurrent
                    ? "bg-[#172026] text-white border-[#172026] font-semibold shadow-2xs"
                    : "bg-[#F0F3F5] hover:bg-[#E2E8F0] text-[#66717A] border-[#D9DEE3]"
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
        <div className="space-y-3">
          <CardSkeleton />
        </div>
      )}

      {/* Error State */}
      {error && !loadingDetails && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-[#D64545] rounded-lg text-xs space-y-1">
          <div className="font-bold">Error Loading Train Information</div>
          <div>{error}</div>
          <button
            type="button"
            onClick={() => fetchSelectedTrain(selectedTrainNumber)}
            className="mt-1 text-xs font-semibold text-rose-900 underline"
          >
            Tap to retry
          </button>
        </div>
      )}

      {/* Main Passenger Card */}
      {trainDetails && !loadingDetails && (
        <div className="space-y-3">
          <div className="bg-[#FFFFFF] rounded-lg border border-[#D9DEE3] shadow-2xs overflow-hidden">
            {/* Train Info Header */}
            <div className="bg-[#F8FAFB] border-b border-[#D9DEE3] p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-bold text-base text-[#172026]">
                    {trainDetails.train_number}
                  </span>
                  <span className="text-xs font-semibold text-[#172026]">
                    &mdash; {trainName}
                  </span>
                </div>
                <div className="text-[11px] text-[#66717A] mt-0.5">
                  {trainDetails.train_type} &bull; Route #{trainDetails.route_id}
                </div>
              </div>
              <StatusBadge status={trainDetails.current_state?.status} size="sm" />
            </div>

            <div className="p-4 space-y-4">
              {/* Telemetry Strip: Current Station + Current Delay */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-[#F8FAFB] rounded-lg border border-[#D9DEE3]">
                {/* 1. Current Station */}
                <div>
                  <div className="text-[10px] font-bold text-[#8A949C] uppercase tracking-wider">
                    Current Location
                  </div>
                  <div className="text-sm font-bold font-mono text-[#172026] mt-0.5">
                    {currentStation}
                  </div>
                  <div className="text-[11px] text-[#66717A] mt-0.5 font-mono">
                    Speed: {trainDetails.current_state?.speed_kmh?.toFixed(0) ?? 0} km/h
                  </div>
                </div>

                {/* 2. Current Delay */}
                <div>
                  <div className="text-[10px] font-bold text-[#8A949C] uppercase tracking-wider">
                    Operational Status
                  </div>
                  <div className="mt-0.5">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs font-mono font-bold border rounded ${delayInfo.colorClass}`}
                    >
                      {delayInfo.text}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#8A949C] mt-0.5">
                    {currentDelayMinutes <= 0.5 ? "On schedule" : "Accumulated delay"}
                  </div>
                </div>
              </div>

              {/* 3. Upcoming Station Selector */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-[#66717A]">
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    Select Your Destination Station
                  </span>
                  {trainDetails.upcoming_stations &&
                    trainDetails.upcoming_stations.length > 1 && (
                      <span className="text-[11px] text-[#2563A8] font-normal">
                        Change stop &darr;
                      </span>
                    )}
                </div>

                {trainDetails.upcoming_stations &&
                trainDetails.upcoming_stations.length > 0 ? (
                  <select
                    value={selectedStationCode}
                    onChange={(e) => setSelectedStationCode(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F8FAFB] border border-[#D9DEE3] rounded-md text-xs sm:text-[13px] font-bold font-mono text-[#172026] focus:bg-[#FFFFFF] focus:border-[#2563A8] focus:outline-none"
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
                  <div className="p-3 bg-[#F8FAFB] rounded border border-[#D9DEE3] text-xs text-[#66717A] text-center font-medium">
                    Train has reached its final destination.
                  </div>
                )}
              </div>

              {/* 4. Expected Arrival & Uncertainty Window */}
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

                  {/* Supplemental Timetable Details */}
                  <div className="p-3 bg-[#F8FAFB] rounded-lg border border-[#D9DEE3] text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[#66717A]">Timetable Schedule:</span>
                      <EtaComparisonBadge type="scheduled" time={targetStationETA.scheduled_eta} size="sm" />
                    </div>
                    {targetStationETA.baseline_eta && (
                      <div className="flex items-center justify-between pt-1.5 border-t border-[#D9DEE3]/70">
                        <span className="text-[#66717A]">Baseline Extrapolation:</span>
                        <EtaComparisonBadge type="baseline" time={targetStationETA.baseline_eta} size="sm" />
                      </div>
                    )}
                    {targetStationETA.predicted_remaining_minutes !== undefined &&
                      targetStationETA.predicted_remaining_minutes !== null && (
                        <div className="flex items-center justify-between text-[#66717A] pt-1.5 border-t border-[#D9DEE3]/70 font-mono">
                          <span>Estimated Remaining Transit:</span>
                          <span className="font-bold text-[#2563A8]">
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
                  className="py-2 px-3 rounded-md bg-[#172026] hover:bg-[#2563A8] text-white font-semibold text-xs transition-colors flex items-center justify-center space-x-1.5 shadow-2xs cursor-pointer"
                >
                  <span>↻ Refresh</span>
                </button>

                <Link
                  href={`/trains/${encodeURIComponent(trainDetails.train_number)}`}
                  className="py-2 px-3 rounded-md bg-[#FFFFFF] hover:bg-[#F0F3F5] border border-[#D9DEE3] text-[#172026] font-semibold text-xs transition-colors flex items-center justify-center space-x-1"
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
        <div className="py-16 text-center text-xs text-[#8A949C]">
          Loading Passenger Lookup...
        </div>
      }
    >
      <PassengerViewContent />
    </Suspense>
  );
}
