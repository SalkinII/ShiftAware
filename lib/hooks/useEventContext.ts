// lib/hooks/useEventContext.ts
// Re-export everything from the context module for backward compatibility
export {
  useEventContext,
  formatEventDateRange,
  EventContextProvider,
} from "@/lib/contexts/EventContext";
export type {
  EventContextState,
  EventContextEvent,
} from "@/lib/contexts/EventContext";
