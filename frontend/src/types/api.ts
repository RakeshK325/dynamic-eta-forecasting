/**
 * TypeScript type definitions for the Dynamic Train ETA Forecasting Engine API.
 * Mirrors FastAPI Pydantic response and request models.
 */

export interface TrainRunningState {
  train_number: string;
  journey_date: string;
  train_name: string;
  status: string; // "RUNNING" | "HALTED" | "COMPLETED" | "NOT-STARTED"
  current_station_code: string | null;
  current_station_sequence: number | null;
  current_delay_minutes: number;
  previous_station_code: string | null;
  next_station_code: string | null;
  next_station_distance_km: number | null;
  segment_progress: number;
  speed_kmh: number;
  timestamp: string;
  source: "simulator" | "external_api";
}

export interface RouteStationInfo {
  sequence: number;
  station_code: string;
  station_name: string;
  distance_from_source_km: number;
  scheduled_arrival: string | null;
  scheduled_departure: string | null;
  scheduled_stop_minutes: number;
}

export interface ConfidenceRange {
  lower_bound: string;
  upper_bound: string;
  margin_minutes: number;
  lower_bound_minutes: number | null;
  upper_bound_minutes: number | null;
}

export interface UpcomingStationETA {
  station_code: string;
  station_name: string | null;
  station_sequence: number;
  distance_to_go_km: number;
  segments_ahead: number;
  intermediate_halts: number;
  scheduled_eta: string;
  baseline_eta: string;
  ml_eta: string;
  predicted_eta?: string | null;
  scheduled_remaining_minutes?: number | null;
  baseline_remaining_minutes: number;
  predicted_remaining_minutes: number;
  confidence_lower_bound: string;
  confidence_upper_bound: string;
  confidence_range: ConfidenceRange;
}

export interface SegmentPrediction {
  segment_order: number;
  from_station_code: string;
  to_station_code: string;
  distance_km: number;
  scheduled_minutes: number;
  baseline_minutes: number;
  predicted_minutes: number;
}

export interface TrainDetailResponse {
  id?: number;
  train_id?: number;
  train_number: string;
  name?: string;
  train_name?: string;
  train_type: string;
  route_id: number;
  current_station: string | null;
  current_delay?: number;
  current_delay_minutes: number;
  current_timestamp: string;
  current_state: TrainRunningState | null;
  route_stations: RouteStationInfo[];
  total_upcoming_stations?: number;
  upcoming_stations: UpcomingStationETA[];
  scheduled_eta?: string | null;
  baseline_eta?: string | null;
  ml_eta?: string | null;
  confidence_range?: ConfidenceRange | null;
  segment_predictions: SegmentPrediction[];
  active_events?: EventDetails[];
  delay_trend?: number;
  delay_history?: number[];
}

export interface TrainListItem {
  id: number;
  train_number: string;
  name: string;
  train_type: string;
  route_id: number;
  current_state: TrainRunningState | null;
  current_station: string | null;
  next_station: string | null;
  current_delay_minutes: number;
  ml_eta: string | null;
  baseline_eta: string | null;
  confidence_range: ConfidenceRange | null;
  delay_trend: number;
  delay_history: number[];
}

export interface TrainListResponse {
  total: number;
  trains: TrainListItem[];
}

export interface SingleStationETAResponse {
  train_id: number;
  train_number: string;
  train_name: string;
  target_station: string;
  target_station_name: string | null;
  current_station: string | null;
  current_delay_minutes: number;
  prediction_timestamp: string;
  model_version: string;
  scheduled_eta: string | null;
  baseline_eta: string | null;
  ml_eta: string | null;
  confidence_lower: string | null;
  confidence_upper: string | null;
  confidence_margin_minutes: number | null;
  confidence_range: ConfidenceRange | null;
  distance_to_go_km: number;
  segments_ahead: number;
  ml_status: "AVAILABLE" | "UNAVAILABLE";
  disclaimer?: string;
}

export interface StationArrivalItem {
  train_id: number;
  train_number: string;
  train_name: string;
  train_type: string;
  origin_station_code: string | null;
  destination_station_code: string | null;
  current_station: string | null;
  current_delay_minutes: number;
  distance_to_go_km: number;
  segments_ahead: number;
  scheduled_eta: string | null;
  baseline_eta: string | null;
  ml_eta: string | null;
  confidence_lower: string | null;
  confidence_upper: string | null;
  confidence_range: ConfidenceRange | null;
  ml_status: string;
  minutes_to_arrival: number;
}

export interface StationArrivalsResponse {
  station_code: string;
  station_name: string | null;
  current_timestamp: string;
  window_hours: number | null;
  total_arrivals: number;
  arrivals: StationArrivalItem[];
}

export interface EventDetails {
  event_type: string;
  delay_minutes: number;
  severity: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export interface EventInjectionRequest {
  train_id: string | number;
  event_type: "SIGNAL_HALT" | "CONGESTION" | "SPEED_RESTRICTION" | "UNSCHEDULED_HALT" | "WEATHER" | string;
  delay_minutes: number;
  severity?: "LOW" | "MEDIUM" | "HIGH" | string;
  metadata?: Record<string, unknown>;
}

export interface EventInjectionResponse {
  event: EventDetails;
  train_state: TrainRunningState;
  target_station: string | null;
  baseline_eta: string | null;
  updated_baseline_eta: string | null;
  ml_eta: string | null;
  updated_ml_eta: string | null;
  confidence_range: ConfidenceRange | null;
  ml_status: string;
  message: string;
}

export interface HorizonMetrics {
  sample_count: number;
  baseline_mae: number;
  baseline_rmse: number;
  ml_mae: number;
  ml_rmse: number;
  absolute_diff_mae: number;
  percentage_improvement: number;
  winner: string;
}

export interface DisruptionMetrics {
  sample_count: number;
  baseline_mae: number;
  baseline_rmse: number;
  ml_mae: number;
  ml_rmse: number;
  absolute_diff_mae: number;
  percentage_improvement: number;
  winner: string;
}

export interface ModelMetricsResponse {
  status: "AVAILABLE" | "UNAVAILABLE" | string;
  is_available: boolean;
  model_name: string | null;
  model_version: string | null;
  training_timestamp: string | null;
  total_training_samples: number | null;
  test_samples: number | null;
  baseline_mae: number | null;
  ml_mae: number | null;
  baseline_rmse: number | null;
  ml_rmse: number | null;
  metrics_by_horizon: Record<string, HorizonMetrics> | null;
  by_horizon?: Record<string, HorizonMetrics> | null;
  metrics_by_disruption_status: Record<string, DisruptionMetrics> | null;
  by_disruption?: Record<string, DisruptionMetrics> | null;
  overall?: HorizonMetrics | null;
  evaluation_timestamp: string | null;
  message?: string | null;
  disclaimer?: string | null;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
}
