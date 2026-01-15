export interface CacheEntry {
  data: any;
  timestamp: number;
  ttl?: number; // optional time-to-live in milliseconds
}

export interface CacheContextValue {
  get: (key: string) => CacheEntry | null;
  set: (key: string, data: any, ttl?: number) => void;
  invalidate: (key: string | string[]) => void;
  clear: () => void;
}
