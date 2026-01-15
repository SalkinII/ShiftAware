"use client";

import { useState, useEffect, useCallback } from "react";
import { useCacheContext } from "./CacheProvider";
import { CacheEntry } from "./types";

interface UseCacheOptions {
  key: string;
  fetchFn: () => Promise<any>;
  ttl?: number; // Time-to-live in milliseconds
  enabled?: boolean; // Whether to fetch if not in cache
}

interface UseCacheResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => void;
}

/**
 * Custom hook for fetching and caching data
 *
 * @example
 * const { data, loading, error, refetch } = useCache({
 *   key: 'shifts',
 *   fetchFn: () => fetch('/api/shifts').then(r => r.json())
 * });
 */
export function useCache<T = any>({
  key,
  fetchFn,
  ttl,
  enabled = true,
}: UseCacheOptions): UseCacheResult<T> {
  const cache = useCacheContext();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      cache.set(key, result, ttl);
      setData(result);
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error("Failed to fetch data");
      setError(error);
      console.error(`Cache fetch error for key "${key}":`, error);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ttl, cache]); // Exclude fetchFn from deps to prevent infinite loops

  const refetch = useCallback(async () => {
    // Invalidate cache and fetch fresh data
    cache.invalidate(key);
    await fetchData();
  }, [key, cache, fetchData]);

  const invalidate = useCallback(() => {
    cache.invalidate(key);
    setData(null);
  }, [key, cache]);

  useEffect(() => {
    // Check cache first
    const cached = cache.get(key);
    if (cached) {
      setData(cached.data);
      setLoading(false);
      return;
    }

    // If not in cache and enabled, fetch
    if (enabled) {
      fetchData();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, cache, enabled]); // Exclude fetchData to prevent infinite loops

  return {
    data: data as T | null,
    loading,
    error,
    refetch,
    invalidate,
  };
}
