"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { unwrapApiResponse } from "@/lib/api-errors";

export interface EnvironmentSummary {
  id: string;
  festivalId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  config?: {
    bufferDaysBefore?: number;
    bufferDaysAfter?: number;
    minShiftsPerPerson?: number;
    [key: string]: unknown;
  };
  _count?: {
    shifts?: number;
    [key: string]: unknown;
  };
}

export interface EnvironmentContextState {
  selectedEnvironmentId: string | null;
  selectedEnvironment: EnvironmentSummary | null;
  environments: EnvironmentSummary[];
  loading: boolean;
  setSelectedEnvironmentId: (id: string | null) => void;
  refreshEnvironments: () => Promise<void>;
}

const EnvironmentContext = createContext<EnvironmentContextState | null>(null);

const STORAGE_KEY_USER = "selectedEnvironmentId";
const STORAGE_KEY_ADMIN = "adminSelectedEnvironmentId";

interface EnvironmentContextProviderProps {
  isAdmin: boolean;
  children: React.ReactNode;
}

export function EnvironmentContextProvider({
  isAdmin,
  children,
}: EnvironmentContextProviderProps) {
  const storageKey = isAdmin ? STORAGE_KEY_ADMIN : STORAGE_KEY_USER;

  const [selectedEnvironmentId, setSelectedEnvironmentIdState] = useState<string | null>(
    null,
  );
  const [selectedEnvironment, setSelectedEnvironment] = useState<EnvironmentSummary | null>(
    null,
  );
  const [environments, setEnvironments] = useState<EnvironmentSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const setSelectedEnvironmentId = useCallback(
    (id: string | null) => {
      setSelectedEnvironmentIdState(id);
      if (id) {
        localStorage.setItem(storageKey, id);
      } else {
        localStorage.removeItem(storageKey);
      }
    },
    [storageKey],
  );

  const refreshEnvironments = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("/api/environments");
      if (res.ok) {
        const data = await res.json();
        const environmentsList = unwrapApiResponse<EnvironmentSummary[]>(data) || [];
        setEnvironments(environmentsList);
      }
    } catch (error) {
      console.error("Failed to load events:", error);
    }
  }, []);

  // Load events on mount
  useEffect(() => {
    async function init() {
      setLoading(true);
      await refreshEnvironments();
      setLoading(false);
    }
    init();
  }, [refreshEnvironments]);

  // Restore selection after events are loaded
  useEffect(() => {
    if (environments.length > 0 && !selectedEnvironmentId) {
      const savedId = localStorage.getItem(storageKey);
      if (savedId && environments.some((e) => e.id === savedId)) {
        setSelectedEnvironmentIdState(savedId);
      }
    }
  }, [environments, storageKey, selectedEnvironmentId]);

  // Update selectedEnvironment when ID or events list changes
  useEffect(() => {
    if (selectedEnvironmentId) {
      const event = environments.find((e) => e.id === selectedEnvironmentId);
      setSelectedEnvironment(event || null);
    } else {
      setSelectedEnvironment(null);
    }
  }, [selectedEnvironmentId, environments]);

  return (
    <EnvironmentContext.Provider
      value={{
        selectedEnvironmentId,
        selectedEnvironment,
        environments,
        loading,
        setSelectedEnvironmentId,
        refreshEnvironments,
      }}
    >
      {children}
    </EnvironmentContext.Provider>
  );
}

/**
 * Consumer hook — must be used within EnvironmentContextProvider.
 * The `isAdmin` parameter is accepted for backward compatibility but ignored;
 * admin vs user behavior is determined by the provider wrapping the layout.
 */
export function useEnvironmentContext(): EnvironmentContextState {
  const context = useContext(EnvironmentContext);
  if (!context) {
    throw new Error(
      "useEnvironmentContext must be used within an EnvironmentContextProvider",
    );
  }
  return context;
}

/**
 * Format event dates for display (e.g., "Jun 26-29")
 */
export function formatEnvironmentDateRange(
  startDate: string,
  endDate: string,
): string {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const startMonth = start.toLocaleDateString("en-US", { month: "short" });
  const endMonth = end.toLocaleDateString("en-US", { month: "short" });
  const startDay = start.getDate();
  const endDay = end.getDate();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}-${endDay}`;
  }
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
}
