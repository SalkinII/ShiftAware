"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl?: number;
}

interface CacheContextValue {
  get: (key: string) => CacheEntry | null;
  set: (key: string, data: any, ttl?: number) => void;
  invalidate: (key: string | string[]) => void;
  clear: () => void;
}

function isCacheEntryValid(entry: CacheEntry | null): boolean {
  if (!entry) return false;
  if (entry.ttl) {
    return Date.now() - entry.timestamp < entry.ttl;
  }
  return true;
}

const CacheContext = createContext<CacheContextValue | null>(null);

export function CacheProvider({ children }: { children: React.ReactNode }) {
  const [cache, setCache] = useState<Map<string, CacheEntry>>(new Map());

  const get = useCallback(
    (key: string): CacheEntry | null => {
      const entry = cache.get(key);
      if (entry && isCacheEntryValid(entry)) {
        return entry;
      }
      // Remove expired entry
      if (entry && !isCacheEntryValid(entry)) {
        setCache((prev) => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
      }
      return null;
    },
    [cache],
  );

  const set = useCallback((key: string, data: any, ttl?: number) => {
    setCache((prev) => {
      const next = new Map(prev);
      next.set(key, {
        data,
        timestamp: Date.now(),
        ttl,
      });
      return next;
    });
  }, []);

  const invalidate = useCallback((keyOrKeys: string | string[]) => {
    const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
    setCache((prev) => {
      const next = new Map(prev);
      keys.forEach((key) => {
        // Support wildcard patterns (e.g., "shifts*")
        if (key.endsWith("*")) {
          const prefix = key.slice(0, -1);
          const keysToDelete: string[] = [];
          next.forEach((_, cacheKey) => {
            if (cacheKey.startsWith(prefix)) {
              keysToDelete.push(cacheKey);
            }
          });
          keysToDelete.forEach((k) => next.delete(k));
        } else {
          next.delete(key);
        }
      });
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setCache(new Map());
  }, []);

  // Listen for custom cache invalidation events
  useEffect(() => {
    const handleCacheInvalidate = ((e: CustomEvent) => {
      const keys = e.detail?.keys || [];
      if (keys.length > 0) {
        invalidate(keys);
      }
    }) as EventListener;

    window.addEventListener(
      "shiftaware:cache-invalidate",
      handleCacheInvalidate,
    );
    return () => {
      window.removeEventListener(
        "shiftaware:cache-invalidate",
        handleCacheInvalidate,
      );
    };
  }, [invalidate]);

  const value: CacheContextValue = {
    get,
    set,
    invalidate,
    clear,
  };

  return (
    <CacheContext.Provider value={value}>{children}</CacheContext.Provider>
  );
}

export function useCacheContext(): CacheContextValue {
  const context = useContext(CacheContext);
  if (!context) {
    throw new Error("useCacheContext must be used within CacheProvider");
  }
  return context;
}
