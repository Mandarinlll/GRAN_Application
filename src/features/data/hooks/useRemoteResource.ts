"use client";

import { useCallback, useEffect, useState } from "react";

export const DEFAULT_TIMEOUT_MS = 10_000;

export interface UseRemoteResourceOptions {
  /** null の場合は取得しない（loading のまま待機） */
  url: string | null;
  /** 既定 10000ms */
  timeoutMs?: number;
  /** true: error 中も直前の成功データを保持する */
  keepStaleOnError?: boolean;
}

export interface RemoteResourceState<T> {
  status: "loading" | "success" | "error";
  data: T | null;
  consecutiveFailures: number;
  retry: () => void;
}

interface Settled<T> {
  /** どのリクエスト（url + retry回数）の結果か */
  key: string;
  url: string | null;
  status: "success" | "error";
  /** 直前までの成功データ */
  lastData: T | null;
  failures: number;
}

/**
 * 領域単位のデータ取得フック。
 * - url 変更・retry() 直後の同一レンダーで status は "loading" になる（要件10.1）
 * - AbortController による10秒タイムアウト（要件2.9, 10.2）
 * - 連続失敗回数を保持（要件10.4）
 */
export function useRemoteResource<T>(options: UseRemoteResourceOptions): RemoteResourceState<T> {
  const { url, timeoutMs = DEFAULT_TIMEOUT_MS, keepStaleOnError = false } = options;
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  const key = `${attempt}:${url ?? ""}`;

  useEffect(() => {
    if (url === null) return;
    const controller = new AbortController();
    let cancelled = false;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const finish = (ok: boolean, data?: T) => {
      if (cancelled) return;
      setSettled((prev) => {
        const sameUrl = prev?.url === url;
        const prevFailures = sameUrl ? (prev?.failures ?? 0) : 0;
        const prevData = sameUrl || keepStaleOnError ? (prev?.lastData ?? null) : null;
        return ok
          ? { key, url, status: "success", lastData: data as T, failures: 0 }
          : { key, url, status: "error", lastData: prevData, failures: prevFailures + 1 };
      });
    };

    (async () => {
      try {
        const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as T;
        finish(true, json);
      } catch {
        finish(false);
      } finally {
        clearTimeout(timer);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [url, key, timeoutMs, keepStaleOnError]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const isCurrent = settled !== null && settled.key === key;
  const sameUrl = settled !== null && settled.url === url;
  const status: RemoteResourceState<T>["status"] = isCurrent ? settled.status : "loading";
  const consecutiveFailures = sameUrl ? settled.failures : 0;
  const stale = sameUrl || keepStaleOnError ? (settled?.lastData ?? null) : null;

  let data: T | null;
  if (status === "success") data = stale;
  else data = keepStaleOnError ? stale : null;

  return { status, data, consecutiveFailures, retry };
}
