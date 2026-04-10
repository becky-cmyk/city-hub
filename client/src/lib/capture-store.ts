import { createStore, get, set, del, keys, entries } from "idb-keyval";
import { useState, useEffect, useCallback, useRef } from "react";
import { apiRequest } from "@/lib/queryClient";

const captureStore = createStore("cch-captures", "captures");

export interface LocalCapture {
  localId: string;
  timestamp: number;
  synced: boolean;
  serverId?: number | string;
  syncedAt?: number;
  [key: string]: unknown;
}

function generateLocalId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export async function saveCaptureLocally(capture: Record<string, unknown>): Promise<LocalCapture> {
  const localId = generateLocalId();
  const record: LocalCapture = {
    ...capture,
    localId,
    timestamp: Date.now(),
    synced: false,
  };
  await set(localId, record, captureStore);
  return record;
}

export async function getPendingCaptures(): Promise<LocalCapture[]> {
  const allEntries = await entries<string, LocalCapture>(captureStore);
  return allEntries
    .map(([, value]) => value)
    .filter((c) => !c.synced);
}

export async function markCaptureSynced(localId: string, serverId: number | string): Promise<void> {
  const record = await get<LocalCapture>(localId, captureStore);
  if (record) {
    record.synced = true;
    record.serverId = serverId;
    record.syncedAt = Date.now();
    await set(localId, record, captureStore);
  }
}

export async function clearSyncedCaptures(): Promise<void> {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const allEntries = await entries<string, LocalCapture>(captureStore);
  const toDelete = allEntries
    .filter(([, value]) => value.synced && value.syncedAt && value.syncedAt < sevenDaysAgo);
  for (const [key] of toDelete) {
    await del(key, captureStore);
  }
}

export async function getCaptureCount(): Promise<number> {
  const pending = await getPendingCaptures();
  return pending.length;
}

export async function syncPendingCaptures(): Promise<boolean> {
  if (!navigator.onLine) return false;

  const pending = await getPendingCaptures();
  if (pending.length === 0) return true;

  try {
    const res = await apiRequest("POST", "/api/capture/sync-batch", { captures: pending });
    const result = await res.json();

    if (result.synced && Array.isArray(result.synced)) {
      for (const item of result.synced) {
        if (item.localId && item.serverId != null) {
          await markCaptureSynced(item.localId, item.serverId);
        }
      }
    }

    await clearSyncedCaptures();
    return true;
  } catch {
    return false;
  }
}

export function useCaptureSync() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const syncingRef = useRef(false);

  const refreshCount = useCallback(async () => {
    const count = await getCaptureCount();
    setPendingCount(count);
  }, []);

  const syncNow = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const success = await syncPendingCaptures();
      if (success) {
        setLastSyncTime(Date.now());
      }
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
      await refreshCount();
    }
  }, [refreshCount]);

  useEffect(() => {
    refreshCount();

    if (navigator.onLine) {
      syncNow();
    }

    const handleOnline = () => {
      syncNow();
    };

    const handleOffline = () => {
      refreshCount();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncNow, refreshCount]);

  return { pendingCount, isSyncing, lastSyncTime, syncNow };
}
