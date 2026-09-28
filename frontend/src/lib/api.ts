/**
 * Reusable FastAPI Client for Dynamic Train ETA Forecasting Engine.
 * Single source of truth communicating directly with the backend.
 * No business or prediction logic is duplicated on the client.
 */

import {
  HealthResponse,
  TrainListResponse,
  TrainDetailResponse,
  SingleStationETAResponse,
  StationArrivalsResponse,
  EventInjectionRequest,
  EventInjectionResponse,
  ModelMetricsResponse,
  DataSourceConfigResponse,
  DemoScenarioResponse,
  DemoActionResult,
} from "@/types/api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...options.headers,
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
      let errorBody: unknown;
      try {
        errorBody = await res.json();
      } catch {
        errorBody = await res.text();
      }

      const errorMessage =
        typeof errorBody === "object" && errorBody !== null && "detail" in errorBody
          ? String((errorBody as { detail: unknown }).detail)
          : `HTTP error ${res.status}: ${res.statusText}`;

      throw new ApiError(errorMessage, res.status, errorBody);
    }

    return (await res.json()) as T;
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : "Network error";
    throw new ApiError(`Failed to connect to API at ${url}: ${message}`, 0, err);
  }
}

export const api = {
  /**
   * Health check to test backend connection.
   */
  async getHealth(): Promise<HealthResponse> {
    return request<HealthResponse>("/health");
  },

  /**
   * List all trains and active simulated states.
   */
  async getTrains(): Promise<TrainListResponse> {
    return request<TrainListResponse>("/trains");
  },

  /**
   * Fetch complete train running details, route stops, and multi-station ETA predictions.
   */
  async getTrainDetails(trainId: string | number): Promise<TrainDetailResponse> {
    return request<TrainDetailResponse>(`/train/${encodeURIComponent(String(trainId))}`);
  },

  /**
   * Fetch single-station ETA prediction for a specific train and station.
   */
  async getStationETA(
    trainId: string | number,
    stationCode: string
  ): Promise<SingleStationETAResponse> {
    return request<SingleStationETAResponse>(
      `/train/${encodeURIComponent(String(trainId))}/eta/${encodeURIComponent(stationCode.toUpperCase().trim())}`
    );
  },

  /**
   * Fetch upcoming train arrivals for a specific station.
   */
  async getStationArrivals(
    stationCode: string,
    windowHours?: number
  ): Promise<StationArrivalsResponse> {
    const query = windowHours !== undefined ? `?window_hours=${windowHours}` : "";
    return request<StationArrivalsResponse>(
      `/station/${encodeURIComponent(stationCode.toUpperCase().trim())}/arrivals${query}`
    );
  },

  /**
   * Inject operational disruption event into the simulator.
   */
  async simulateEvent(payload: EventInjectionRequest): Promise<EventInjectionResponse> {
    return request<EventInjectionResponse>("/simulate/event", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /**
   * Fetch latest evaluation metrics comparing Baseline heuristic vs XGBoost ML.
   */
  async getModelMetrics(): Promise<ModelMetricsResponse> {
    return request<ModelMetricsResponse>("/model/metrics");
  },

  /**
   * Fetch current system data-source telemetry mode and cache stats.
   */
  async getDataSourceConfig(): Promise<DataSourceConfigResponse> {
    return request<DataSourceConfigResponse>("/system/data-source");
  },

  /**
   * Reset deterministic hackathon demo scenario (Seed 42).
   */
  async resetDemoScenario(): Promise<DemoScenarioResponse> {
    return request<DemoScenarioResponse>("/demo/reset", {
      method: "POST",
    });
  },

  /**
   * Fetch current state of the deterministic hackathon demo scenario.
   */
  async getDemoScenario(): Promise<DemoScenarioResponse> {
    return request<DemoScenarioResponse>("/demo/scenario");
  },

  /**
   * Execute prepared hackathon demo action deterministically.
   */
  async executeDemoAction(actionId: string): Promise<DemoActionResult> {
    return request<DemoActionResult>(`/demo/action/${encodeURIComponent(actionId)}`, {
      method: "POST",
    });
  },
};

/**
 * Utility display formatters
 */
export function formatTime(isoString: string | null | undefined): string {
  if (!isoString) return "--:--";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return isoString;
  }
}

export function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return "N/A";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return isoString;
  }
}

export function formatDelay(delayMinutes: number | null | undefined): {
  text: string;
  isDelayed: boolean;
  colorClass: string;
} {
  const d = delayMinutes ?? 0;
  if (d <= 0.5) {
    return {
      text: "On Time",
      isDelayed: false,
      colorClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
    };
  }
  return {
    text: `+${d.toFixed(1)} min`,
    isDelayed: true,
    colorClass:
      d > 15
        ? "bg-rose-100 text-rose-800 border-rose-300 font-semibold"
        : "bg-amber-100 text-amber-800 border-amber-300",
  };
}
