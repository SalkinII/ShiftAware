export interface CacheEntry {
  data: any; // TODO(deploy-risk: low | owner: maintainer | expiry: 2026-Q3): type properly
  timestamp: number;
  ttl?: number; // optional time-to-live in milliseconds
}

export interface CacheContextValue {
  get: (key: string) => CacheEntry | null;
  set: (key: string, data: any, ttl?: number) => void; // TODO(deploy-risk: low | owner: maintainer | expiry: 2026-Q3): type properly
  invalidate: (key: string | string[]) => void;
  clear: () => void;
}
